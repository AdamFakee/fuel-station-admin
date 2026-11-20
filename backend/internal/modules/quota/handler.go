package quota

import (
	"encoding/json"
	"log/slog"
	"net/http"
	"strconv"

	"fuel-station-backend/internal/shared/apperr"
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

// RegisterRoutes registers Quota module endpoints into router.
func (h *Handler) RegisterRoutes(r chi.Router, authMiddleware func(http.Handler) http.Handler) {
	r.Group(func(protected chi.Router) {
		protected.Use(authMiddleware)

		// Quota Rules endpoints
		protected.With(authz.RequirePermission("master.quota:view", h.log)).Get("/quotas/rules", h.ListRules)
		protected.With(authz.RequirePermission("master.quota:create", h.log)).Post("/quotas/rules", h.CreateRule)
		protected.With(authz.RequirePermission("master.quota:view", h.log)).Get("/quotas/rules/{id}", h.GetRule)
		protected.With(authz.RequirePermission("master.quota:update", h.log)).Put("/quotas/rules/{id}", h.UpdateRule)
		protected.With(authz.RequirePermission("master.quota:delete", h.log)).Post("/quotas/rules/{id}/cancel", h.CancelRule)

		// Quota Extras endpoints (emergency quota grant)
		protected.With(authz.RequirePermission("master.quota:view", h.log)).Get("/quotas/extras", h.ListExtras)
		protected.With(authz.RequirePermission("master.quota:create", h.log)).Post("/quotas/extras", h.CreateExtra)

		// Targets options helper (vehicles, groups, routes)
		protected.With(authz.RequirePermission("master.quota:view", h.log)).Get("/quotas/targets", h.GetTargets)
	})
}

func (h *Handler) ListRules(w http.ResponseWriter, r *http.Request) {
	status := r.URL.Query().Get("status")
	targetType := r.URL.Query().Get("target_type")
	q := r.URL.Query().Get("q")
	page, _ := strconv.Atoi(r.URL.Query().Get("page"))
	pageSize, _ := strconv.Atoi(r.URL.Query().Get("page_size"))

	items, total, err := h.service.ListRules(r.Context(), status, q, targetType, page, pageSize)
	if err != nil {
		httpx.Error(w, r, h.log, err)
		return
	}

	httpx.JSON(w, http.StatusOK, map[string]any{
		"data":      items,
		"total":     total,
		"page":      page,
		"page_size": pageSize,
	})
}

func (h *Handler) GetRule(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	item, err := h.service.GetRule(r.Context(), id)
	if err != nil {
		httpx.Error(w, r, h.log, err)
		return
	}

	httpx.JSON(w, http.StatusOK, item)
}

func (h *Handler) CreateRule(w http.ResponseWriter, r *http.Request) {
	var req CreateQuotaRuleRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httpx.Error(w, r, h.log, apperr.ErrInvalidInput)
		return
	}

	created, err := h.service.CreateRule(r.Context(), req)
	if err != nil {
		httpx.Error(w, r, h.log, err)
		return
	}

	httpx.JSON(w, http.StatusCreated, created)
}

func (h *Handler) UpdateRule(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	var req UpdateQuotaRuleRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httpx.Error(w, r, h.log, apperr.ErrInvalidInput)
		return
	}

	updated, err := h.service.UpdateRule(r.Context(), id, req)
	if err != nil {
		httpx.Error(w, r, h.log, err)
		return
	}

	httpx.JSON(w, http.StatusOK, updated)
}

func (h *Handler) CancelRule(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if err := h.service.CancelRule(r.Context(), id); err != nil {
		httpx.Error(w, r, h.log, err)
		return
	}

	httpx.JSON(w, http.StatusOK, map[string]any{
		"message": "Đã hủy hiệu lực quy tắc định mức thành công",
	})
}

func (h *Handler) ListExtras(w http.ResponseWriter, r *http.Request) {
	vehicleID := r.URL.Query().Get("vehicle_id")
	page, _ := strconv.Atoi(r.URL.Query().Get("page"))
	pageSize, _ := strconv.Atoi(r.URL.Query().Get("page_size"))

	items, total, err := h.service.ListExtras(r.Context(), vehicleID, page, pageSize)
	if err != nil {
		httpx.Error(w, r, h.log, err)
		return
	}

	httpx.JSON(w, http.StatusOK, map[string]any{
		"data":      items,
		"total":     total,
		"page":      page,
		"page_size": pageSize,
	})
}

func (h *Handler) CreateExtra(w http.ResponseWriter, r *http.Request) {
	var req CreateQuotaExtraRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httpx.Error(w, r, h.log, apperr.ErrInvalidInput)
		return
	}

	created, err := h.service.CreateExtra(r.Context(), req)
	if err != nil {
		httpx.Error(w, r, h.log, err)
		return
	}

	httpx.JSON(w, http.StatusCreated, created)
}

func (h *Handler) GetTargets(w http.ResponseWriter, r *http.Request) {
	targets, err := h.service.GetTargets(r.Context())
	if err != nil {
		httpx.Error(w, r, h.log, err)
		return
	}

	httpx.JSON(w, http.StatusOK, targets)
}
