package dispense

import (
	"log/slog"
	"net/http"
	"strconv"
	"time"

	"fuel-station-backend/internal/shared/authz"
	"fuel-station-backend/internal/shared/httpx"
	"github.com/go-chi/chi/v5"
)

type Handler struct {
	service *Service
	log     *slog.Logger
}

func NewHandler(service *Service, log *slog.Logger) *Handler {
	return &Handler{service: service, log: log}
}

func (h *Handler) RegisterRoutes(r chi.Router, authMiddleware func(http.Handler) http.Handler) {
	r.Group(func(protected chi.Router) {
		protected.Use(authMiddleware)

		protected.With(authz.RequirePermission("dispense.session:view", h.log)).Get("/dispense/sessions", h.ListSessions)
		protected.With(authz.RequirePermission("dispense.session:view", h.log)).Get("/dispense/sessions/{id}", h.GetSession)
		protected.With(authz.RequirePermission("dispense.session:view", h.log)).Get("/dispense/access-events", h.ListAccessEvents)
		protected.With(authz.RequirePermission("dispense.session:view", h.log)).Get("/dispense/summary", h.GetSummary)
	})
}

func (h *Handler) ListSessions(w http.ResponseWriter, r *http.Request) {
	page, _ := strconv.Atoi(r.URL.Query().Get("page"))
	pageSize, _ := strconv.Atoi(r.URL.Query().Get("page_size"))

	var fromDate, toDate *time.Time
	if fromStr := r.URL.Query().Get("from_date"); fromStr != "" {
		if t, err := time.Parse(time.RFC3339, fromStr); err == nil {
			fromDate = &t
		}
	}
	if toStr := r.URL.Query().Get("to_date"); toStr != "" {
		if t, err := time.Parse(time.RFC3339, toStr); err == nil {
			toDate = &t
		}
	}

	q := SessionListQuery{
		Page:      page,
		PageSize:  pageSize,
		Search:    r.URL.Query().Get("q"),
		BranchID:  r.URL.Query().Get("branch_id"),
		PumpID:    r.URL.Query().Get("pump_id"),
		VehicleID: r.URL.Query().Get("vehicle_id"),
		DriverID:  r.URL.Query().Get("driver_id"),
		Status:    r.URL.Query().Get("status"),
		FromDate:  fromDate,
		ToDate:    toDate,
	}

	res, err := h.service.ListSessions(r.Context(), q)
	if err != nil {
		httpx.Error(w, r, h.log, err)
		return
	}

	httpx.JSON(w, http.StatusOK, res)
}

func (h *Handler) GetSession(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	res, err := h.service.GetSession(r.Context(), id)
	if err != nil {
		httpx.Error(w, r, h.log, err)
		return
	}

	httpx.JSON(w, http.StatusOK, res)
}

func (h *Handler) ListAccessEvents(w http.ResponseWriter, r *http.Request) {
	page, _ := strconv.Atoi(r.URL.Query().Get("page"))
	pageSize, _ := strconv.Atoi(r.URL.Query().Get("page_size"))

	var fromDate, toDate *time.Time
	if fromStr := r.URL.Query().Get("from_date"); fromStr != "" {
		if t, err := time.Parse(time.RFC3339, fromStr); err == nil {
			fromDate = &t
		}
	}
	if toStr := r.URL.Query().Get("to_date"); toStr != "" {
		if t, err := time.Parse(time.RFC3339, toStr); err == nil {
			toDate = &t
		}
	}

	q := AccessEventListQuery{
		Page:     page,
		PageSize: pageSize,
		Search:   r.URL.Query().Get("q"),
		BranchID: r.URL.Query().Get("branch_id"),
		Decision: r.URL.Query().Get("decision"),
		Method:   r.URL.Query().Get("method"),
		FromDate: fromDate,
		ToDate:   toDate,
	}

	res, err := h.service.ListAccessEvents(r.Context(), q)
	if err != nil {
		httpx.Error(w, r, h.log, err)
		return
	}

	httpx.JSON(w, http.StatusOK, res)
}

func (h *Handler) GetSummary(w http.ResponseWriter, r *http.Request) {
	branchID := r.URL.Query().Get("branch_id")
	res, err := h.service.GetSummary(r.Context(), branchID)
	if err != nil {
		httpx.Error(w, r, h.log, err)
		return
	}

	httpx.JSON(w, http.StatusOK, res)
}
