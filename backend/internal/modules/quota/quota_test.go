package quota_test

import (
	"bytes"
	"encoding/json"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"testing"

	"fuel-station-backend/internal/modules/quota"
	"fuel-station-backend/internal/shared/authz"
	"fuel-station-backend/internal/shared/middleware"
	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
)

func TestQuotaConversion(t *testing.T) {
	liters := 125.5
	ml := int64(liters * 1000.0)
	if ml != 125500 {
		t.Errorf("expected 125500 ml, got %d", ml)
	}

	convertedLiters := float64(ml) / 1000.0
	if convertedLiters != liters {
		t.Errorf("expected %f liters, got %f", liters, convertedLiters)
	}
}

func TestQuotaRoutes_PermissionChecks(t *testing.T) {
	logger := slog.New(slog.NewTextHandler(io.Discard, nil))
	service := quota.NewService(nil)
	handler := quota.NewHandler(service, logger)

	r := chi.NewRouter()
	fakeAuthMiddleware := func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
			next.ServeHTTP(w, req)
		})
	}
	handler.RegisterRoutes(r, fakeAuthMiddleware)

	// Case 1: Unauthenticated -> 401
	req1 := httptest.NewRequest(http.MethodGet, "/quotas/rules", nil)
	rr1 := httptest.NewRecorder()
	r.ServeHTTP(rr1, req1)
	if rr1.Code != http.StatusUnauthorized {
		t.Errorf("expected 401 Unauthorized for unauthenticated request, got %d", rr1.Code)
	}

	// Case 2: Authenticated without master.quota:view -> 403
	pWithoutPerm := authz.NewPrincipal("u1", "t1", "GUEST", nil, []authz.Permission{"other:view"})
	req2 := httptest.NewRequest(http.MethodGet, "/quotas/rules", nil)
	req2 = req2.WithContext(authz.WithPrincipal(req2.Context(), pWithoutPerm))
	req2 = req2.WithContext(middleware.WithTenantID(req2.Context(), "t1"))
	rr2 := httptest.NewRecorder()
	r.ServeHTTP(rr2, req2)
	if rr2.Code != http.StatusForbidden {
		t.Errorf("expected 403 Forbidden for missing permission, got %d", rr2.Code)
	}

	// Case 3: Authenticated with master.quota:view on targets endpoint
	pWithPerm := authz.NewPrincipal("u1", "t1", "MANAGER", nil, []authz.Permission{"master.quota:view"})
	req3 := httptest.NewRequest(http.MethodGet, "/quotas/targets", nil)
	req3 = req3.WithContext(authz.WithPrincipal(req3.Context(), pWithPerm))
	req3 = req3.WithContext(middleware.WithTenantID(req3.Context(), "t1"))
	rr3 := httptest.NewRecorder()
	r.ServeHTTP(rr3, req3)
	// Even without db pool, should not return 401 or 403
	if rr3.Code == http.StatusUnauthorized || rr3.Code == http.StatusForbidden {
		t.Errorf("did not expect 401/403 with valid permission, got %d", rr3.Code)
	}
}

func TestCreateQuotaRuleRequest_Validation(t *testing.T) {
	req := quota.CreateQuotaRuleRequest{
		Code:               "DM-TEST-01",
		TargetType:         "vehicle",
		TargetID:           uuid.NewString(),
		Period:             "day",
		MaxVolumeLiters:    50.0,
		MinIntervalMinutes: 30,
		EffectiveFrom:      "2026-11-20",
	}

	data, err := json.Marshal(req)
	if err != nil {
		t.Fatalf("marshal error: %v", err)
	}

	var parsed quota.CreateQuotaRuleRequest
	if err := json.Unmarshal(data, &parsed); err != nil {
		t.Fatalf("unmarshal error: %v", err)
	}

	if parsed.MaxVolumeLiters != 50.0 {
		t.Errorf("expected 50.0 liters, got %f", parsed.MaxVolumeLiters)
	}
	if parsed.Period != "day" {
		t.Errorf("expected period 'day', got %s", parsed.Period)
	}
}

func TestCreateQuotaExtraRequest_Validation(t *testing.T) {
	req := quota.CreateQuotaExtraRequest{
		VehicleID:         uuid.NewString(),
		ExtraVolumeLiters: 100.0,
		Reason:            "Xe chạy tăng bo công trình đột xuất",
	}

	var buf bytes.Buffer
	if err := json.NewEncoder(&buf).Encode(req); err != nil {
		t.Fatalf("encode error: %v", err)
	}

	var parsed quota.CreateQuotaExtraRequest
	if err := json.NewDecoder(&buf).Decode(&parsed); err != nil {
		t.Fatalf("decode error: %v", err)
	}

	if parsed.ExtraVolumeLiters != 100.0 {
		t.Errorf("expected 100.0 liters, got %f", parsed.ExtraVolumeLiters)
	}
}
