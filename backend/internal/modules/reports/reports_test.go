package reports

import (
	"encoding/json"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"fuel-station-backend/internal/shared/authz"
	"fuel-station-backend/internal/shared/middleware"
	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestMLToLiters(t *testing.T) {
	tests := []struct {
		name     string
		ml       int64
		expected float64
	}{
		{"Zero", 0, 0.0},
		{"1 Liter", 1000, 1.0},
		{"1.5 Liters", 1500, 1.5},
		{"1.234 Liters rounded to 2 decimals", 1234, 1.23},
		{"1.236 Liters rounded to 2 decimals", 1236, 1.24},
		{"50000 Liters", 50000000, 50000.0},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := mlToLiters(tt.ml)
			assert.Equal(t, tt.expected, got)
		})
	}
}

func TestKindToLabel(t *testing.T) {
	assert.Equal(t, "Tồn đầu kỳ", kindToLabel("opening"))
	assert.Equal(t, "Nhập bể", kindToLabel("receipt"))
	assert.Equal(t, "Cấp phát", kindToLabel("dispense"))
	assert.Equal(t, "Xuất khác", kindToLabel("issue"))
	assert.Equal(t, "Điều chuyển xuất", kindToLabel("transfer_out"))
	assert.Equal(t, "Điều chuyển nhập", kindToLabel("transfer_in"))
	assert.Equal(t, "Điều chỉnh", kindToLabel("adjust"))
	assert.Equal(t, "custom_kind", kindToLabel("custom_kind"))
}

func TestParseHelpers(t *testing.T) {
	// UUID
	validUUID := uuid.New()
	parsed := parseUUID(validUUID.String())
	require.NotNil(t, parsed)
	assert.Equal(t, validUUID, *parsed)

	assert.Nil(t, parseUUID(""))
	assert.Nil(t, parseUUID("invalid-uuid"))

	// Date YYYY-MM-DD
	d1 := parseDate("2026-11-20", false)
	require.NotNil(t, d1)
	assert.Equal(t, 2026, d1.Year())
	assert.Equal(t, time.Month(11), d1.Month())
	assert.Equal(t, 20, d1.Day())
	assert.Equal(t, 0, d1.Hour())

	d2 := parseDate("2026-11-20", true)
	require.NotNil(t, d2)
	assert.Equal(t, 23, d2.Hour())
	assert.Equal(t, 59, d2.Minute())
	assert.Equal(t, 59, d2.Second())

	// Date RFC3339
	rfcStr := "2026-11-20T14:30:00Z"
	d3 := parseDate(rfcStr, false)
	require.NotNil(t, d3)
	assert.Equal(t, 14, d3.Hour())

	// Invalid date
	assert.Nil(t, parseDate("", false))
	assert.Nil(t, parseDate("not-a-date", false))
}

func TestReportsRBACProtection(t *testing.T) {
	log := slog.New(slog.NewTextHandler(io.Discard, nil))
	handler := NewHandler(nil, log)

	r := chi.NewRouter()

	mockAuthMiddleware := func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			// Mock user with NO report permissions (e.g. IT user with only dashboard:view)
			principal := authz.NewPrincipal(
				uuid.New().String(),
				uuid.New().String(),
				"IT",
				nil,
				[]authz.Permission{"dashboard:view"},
			)
			ctx := authz.WithPrincipal(r.Context(), principal)
			ctx = middleware.WithTenantID(ctx, principal.TenantID)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}

	handler.RegisterRoutes(r, mockAuthMiddleware)

	endpoints := []string{
		"/reports/stock-ledger",
		"/reports/receipts",
		"/reports/dispenses",
		"/reports/vehicle-consumption",
		"/reports/driver-dispense",
	}

	for _, ep := range endpoints {
		t.Run("Forbidden without report:view "+ep, func(t *testing.T) {
			req := httptest.NewRequest(http.MethodGet, ep, nil)
			rec := httptest.NewRecorder()
			r.ServeHTTP(rec, req)
			assert.Equal(t, http.StatusForbidden, rec.Code)
		})
	}
}

func TestReportsZeroMoneyFieldCompliance(t *testing.T) {
	// Verify JSON representation of all report structs contains NO money / price / vat / cost fields
	// 1. StockLedger
	sl := StockLedgerReportResponse{
		Summary: []TankSummaryItem{{
			TankID:         uuid.New(),
			TankCode:       "B01",
			TankName:       "Bể DO 01",
			FuelTypeName:   "DO 0.05S",
			BranchName:     "Trạm 1",
			CapacityLiters: 25000,
			OpeningLiters:  5000,
			ReceiptLiters:  10000,
			DispenseLiters: 3000,
			IssueLiters:    100,
			AdjustLiters:   0,
			ClosingLiters:  11900,
		}},
		Ledger: []LedgerLineItem{{
			ID:            1,
			TankID:        uuid.New(),
			TankCode:      "B01",
			TankName:      "Bể DO 01",
			Seq:           1,
			OccurredAt:    time.Now(),
			Kind:          "receipt",
			KindLabel:     "Nhập bể",
			InLiters:      10000,
			OutLiters:     0,
			BalanceLiters: 15000,
		}},
	}
	bytes, err := json.Marshal(sl)
	require.NoError(t, err)
	jsonStr := string(bytes)
	assert.NotContains(t, jsonStr, "price")
	assert.NotContains(t, jsonStr, "cost")
	assert.NotContains(t, jsonStr, "money")
	assert.NotContains(t, jsonStr, "amount")
	assert.NotContains(t, jsonStr, "vat")
	assert.Contains(t, jsonStr, "opening_liters")
	assert.Contains(t, jsonStr, "receipt_liters")
	assert.Contains(t, jsonStr, "dispense_liters")
	assert.Contains(t, jsonStr, "closing_liters")

	// 2. Receipt
	rr := ReceiptReportResponse{
		TotalDocumentLiters: 10000,
		TotalActualLiters:   9980,
		TotalVarianceLiters: -20,
		TotalCount:          1,
	}
	b2, err := json.Marshal(rr)
	require.NoError(t, err)
	assert.NotContains(t, string(b2), "price")
	assert.NotContains(t, string(b2), "cost")
	assert.NotContains(t, string(b2), "vat")
	assert.Contains(t, string(b2), "total_actual_liters")

	// 3. VehicleConsumption
	vr := VehicleConsumptionResponse{
		TotalVehicles:        10,
		TotalSessions:        50,
		TotalDispensedLiters: 1250.5,
	}
	b3, err := json.Marshal(vr)
	require.NoError(t, err)
	assert.NotContains(t, string(b3), "price")
	assert.Contains(t, string(b3), "total_dispensed_liters")
}
