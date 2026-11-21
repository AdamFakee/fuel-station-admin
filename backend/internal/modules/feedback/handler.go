package feedback

import (
	"log/slog"
	"net/http"
	"strconv"

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

// RegisterRoutes mounts the feedback endpoints.
func (h *Handler) RegisterRoutes(r chi.Router, authMiddleware func(http.Handler) http.Handler) {
	r.Group(func(protected chi.Router) {
		protected.Use(authMiddleware)
		protected.With(authz.RequirePermission("feedback.item:create", h.log)).Post("/feedback", h.Create)
		protected.With(authz.RequirePermission("feedback.item:view", h.log)).Get("/feedback", h.List)
		protected.With(authz.RequirePermission("feedback.item:view", h.log)).Get("/feedback/{id}", h.Get)
		protected.With(authz.RequirePermission("feedback.item:update", h.log)).Patch("/feedback/{id}/status", h.UpdateStatus)
		protected.With(authz.RequirePermission("feedback.item:delete", h.log)).Delete("/feedback/{id}", h.Delete)
	})
}

func (h *Handler) Create(w http.ResponseWriter, r *http.Request) {
	var req CreateRequest
	if err := httpx.DecodeJSON(r, &req); err != nil {
		httpx.Error(w, r, h.log, err)
		return
	}
	f, err := h.service.Create(r.Context(), req)
	if err != nil {
		httpx.Error(w, r, h.log, err)
		return
	}
	httpx.JSON(w, http.StatusCreated, f)
}

func (h *Handler) List(w http.ResponseWriter, r *http.Request) {
	query := r.URL.Query()
	page, _ := strconv.Atoi(query.Get("page"))
	pageSize, _ := strconv.Atoi(query.Get("page_size"))
	res, err := h.service.List(r.Context(), ListQuery{
		Kind: query.Get("kind"), Status: query.Get("status"), Search: query.Get("q"), Page: page, PageSize: pageSize,
	})
	if err != nil {
		httpx.Error(w, r, h.log, err)
		return
	}
	httpx.JSON(w, http.StatusOK, res)
}

func (h *Handler) Get(w http.ResponseWriter, r *http.Request) {
	f, err := h.service.Get(r.Context(), chi.URLParam(r, "id"))
	if err != nil {
		httpx.Error(w, r, h.log, err)
		return
	}
	httpx.JSON(w, http.StatusOK, f)
}

func (h *Handler) UpdateStatus(w http.ResponseWriter, r *http.Request) {
	var req UpdateStatusRequest
	if err := httpx.DecodeJSON(r, &req); err != nil {
		httpx.Error(w, r, h.log, err)
		return
	}
	f, err := h.service.UpdateStatus(r.Context(), chi.URLParam(r, "id"), req)
	if err != nil {
		httpx.Error(w, r, h.log, err)
		return
	}
	httpx.JSON(w, http.StatusOK, f)
}

func (h *Handler) Delete(w http.ResponseWriter, r *http.Request) {
	if err := h.service.Delete(r.Context(), chi.URLParam(r, "id")); err != nil {
		httpx.Error(w, r, h.log, err)
		return
	}
	httpx.JSON(w, http.StatusOK, map[string]string{"message": "deleted"})
}
