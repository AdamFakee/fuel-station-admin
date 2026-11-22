package reports

import (
	"log/slog"
	"net/http"
	"strconv"
	"time"

	"fuel-station-backend/internal/shared/authz"
	"fuel-station-backend/internal/shared/httpx"
	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
)

type Handler struct {
	service *Service
	log     *slog.Logger
}

func NewHandler(service *Service, log *slog.Logger) *Handler {
	return &Handler{
		service: service,
		log:     log,
	}
}

// RegisterRoutes mounts report endpoints onto the chi router under /reports.
func (h *Handler) RegisterRoutes(r chi.Router, authMiddleware func(http.Handler) http.Handler) {
	r.Group(func(pr chi.Router) {
		pr.Use(authMiddleware)
		pr.Use(authz.RequirePermission("report:view", h.log))

		pr.Get("/reports/stock-ledger", h.GetStockLedger)
		pr.Get("/reports/receipts", h.GetReceipts)
		pr.Get("/reports/dispenses", h.GetDispenses)
		pr.Get("/reports/vehicle-consumption", h.GetVehicleConsumption)
		pr.Get("/reports/driver-dispense", h.GetDriverDispense)
	})
}

func parseUUID(s string) *uuid.UUID {
	if s == "" {
		return nil
	}
	id, err := uuid.Parse(s)
	if err != nil {
		return nil
	}
	return &id
}

func parseDate(s string, endOfDay bool) *time.Time {
	if s == "" {
		return nil
	}
	// Try RFC3339 first
	if t, err := time.Parse(time.RFC3339, s); err == nil {
		return &t
	}
	// Try YYYY-MM-DD
	if t, err := time.Parse("2006-01-02", s); err == nil {
		if endOfDay {
			t = t.Add(23*time.Hour + 59*time.Minute + 59*time.Second)
		}
		return &t
	}
	return nil
}

func (h *Handler) GetStockLedger(w http.ResponseWriter, r *http.Request) {
	q := StockLedgerQuery{
		BranchID: parseUUID(r.URL.Query().Get("branch_id")),
		TankID:   parseUUID(r.URL.Query().Get("tank_id")),
		FromDate: parseDate(r.URL.Query().Get("from_date"), false),
		ToDate:   parseDate(r.URL.Query().Get("to_date"), true),
	}
	q.Page, _ = strconv.Atoi(r.URL.Query().Get("page"))
	q.PageSize, _ = strconv.Atoi(r.URL.Query().Get("page_size"))

	resp, err := h.service.GetStockLedgerReport(r.Context(), q)
	if err != nil {
		httpx.Error(w, r, h.log, err)
		return
	}

	httpx.JSON(w, http.StatusOK, resp)
}

func (h *Handler) GetReceipts(w http.ResponseWriter, r *http.Request) {
	var status *string
	if s := r.URL.Query().Get("status"); s != "" {
		status = &s
	}

	q := ReceiptReportQuery{
		BranchID:   parseUUID(r.URL.Query().Get("branch_id")),
		SupplierID: parseUUID(r.URL.Query().Get("supplier_id")),
		TankID:     parseUUID(r.URL.Query().Get("tank_id")),
		Status:     status,
		FromDate:   parseDate(r.URL.Query().Get("from_date"), false),
		ToDate:     parseDate(r.URL.Query().Get("to_date"), true),
	}

	resp, err := h.service.GetReceiptReport(r.Context(), q)
	if err != nil {
		httpx.Error(w, r, h.log, err)
		return
	}

	httpx.JSON(w, http.StatusOK, resp)
}

func (h *Handler) GetDispenses(w http.ResponseWriter, r *http.Request) {
	var status *string
	if s := r.URL.Query().Get("status"); s != "" {
		status = &s
	}

	page, _ := strconv.Atoi(r.URL.Query().Get("page"))
	pageSize, _ := strconv.Atoi(r.URL.Query().Get("page_size"))

	q := DispenseReportQuery{
		BranchID:  parseUUID(r.URL.Query().Get("branch_id")),
		PumpID:    parseUUID(r.URL.Query().Get("pump_id")),
		TankID:    parseUUID(r.URL.Query().Get("tank_id")),
		VehicleID: parseUUID(r.URL.Query().Get("vehicle_id")),
		DriverID:  parseUUID(r.URL.Query().Get("driver_id")),
		Status:    status,
		FromDate:  parseDate(r.URL.Query().Get("from_date"), false),
		ToDate:    parseDate(r.URL.Query().Get("to_date"), true),
		Page:      page,
		PageSize:  pageSize,
	}

	resp, err := h.service.GetDispenseReport(r.Context(), q)
	if err != nil {
		httpx.Error(w, r, h.log, err)
		return
	}

	httpx.JSON(w, http.StatusOK, resp)
}

func (h *Handler) GetVehicleConsumption(w http.ResponseWriter, r *http.Request) {
	q := VehicleConsumptionQuery{
		BranchID:  parseUUID(r.URL.Query().Get("branch_id")),
		VehicleID: parseUUID(r.URL.Query().Get("vehicle_id")),
		FromDate:  parseDate(r.URL.Query().Get("from_date"), false),
		ToDate:    parseDate(r.URL.Query().Get("to_date"), true),
	}

	resp, err := h.service.GetVehicleConsumptionReport(r.Context(), q)
	if err != nil {
		httpx.Error(w, r, h.log, err)
		return
	}

	httpx.JSON(w, http.StatusOK, resp)
}

func (h *Handler) GetDriverDispense(w http.ResponseWriter, r *http.Request) {
	q := DriverDispenseQuery{
		BranchID: parseUUID(r.URL.Query().Get("branch_id")),
		DriverID: parseUUID(r.URL.Query().Get("driver_id")),
		FromDate: parseDate(r.URL.Query().Get("from_date"), false),
		ToDate:   parseDate(r.URL.Query().Get("to_date"), true),
	}

	resp, err := h.service.GetDriverDispenseReport(r.Context(), q)
	if err != nil {
		httpx.Error(w, r, h.log, err)
		return
	}

	httpx.JSON(w, http.StatusOK, resp)
}
