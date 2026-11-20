package edge

import (
	"encoding/json"
	"log/slog"
	"net/http"
	"strconv"

	"fuel-station-backend/internal/shared/apperr"
	"fuel-station-backend/internal/shared/httpx"
	"github.com/go-chi/chi/v5"
)

type Handler struct {
	service Service
	log     *slog.Logger
}

func NewHandler(service Service, log *slog.Logger) *Handler {
	return &Handler{
		service: service,
		log:     log,
	}
}

// RegisterRoutes mounts all 4 Edge Agent API endpoints.
func (h *Handler) RegisterRoutes(r chi.Router, authMiddleware func(http.Handler) http.Handler) {
	r.Group(func(er chi.Router) {
		er.Use(authMiddleware)

		er.Get("/catalog/changes", h.GetCatalogChanges)
		er.Post("/dispense-sessions", h.CreateDispenseSession)
		er.Post("/access-events", h.ReceiveAccessEvents)
		er.Post("/heartbeat", h.Heartbeat)
	})
}

func (h *Handler) GetCatalogChanges(w http.ResponseWriter, r *http.Request) {
	var cursor int64
	if cStr := r.URL.Query().Get("cursor"); cStr != "" {
		if c, err := strconv.ParseInt(cStr, 10, 64); err == nil {
			cursor = c
		}
	}

	limit := 100
	if lStr := r.URL.Query().Get("limit"); lStr != "" {
		if l, err := strconv.Atoi(lStr); err == nil {
			limit = l
		}
	}

	resp, err := h.service.GetCatalogChanges(r.Context(), cursor, limit)
	if err != nil {
		httpx.Error(w, r, h.log, err)
		return
	}

	httpx.JSON(w, http.StatusOK, resp)
}

func (h *Handler) CreateDispenseSession(w http.ResponseWriter, r *http.Request) {
	var req CreateDispenseSessionRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httpx.Error(w, r, h.log, apperr.ErrInvalidInput)
		return
	}

	resp, err := h.service.ReceiveDispenseSession(r.Context(), req)
	if err != nil {
		httpx.Error(w, r, h.log, err)
		return
	}

	httpx.JSON(w, http.StatusOK, resp)
}

func (h *Handler) ReceiveAccessEvents(w http.ResponseWriter, r *http.Request) {
	var events []AccessEventInput
	if err := json.NewDecoder(r.Body).Decode(&events); err != nil {
		httpx.Error(w, r, h.log, apperr.ErrInvalidInput)
		return
	}

	resp, err := h.service.ReceiveAccessEvents(r.Context(), events)
	if err != nil {
		httpx.Error(w, r, h.log, err)
		return
	}

	httpx.JSON(w, http.StatusOK, resp)
}

func (h *Handler) Heartbeat(w http.ResponseWriter, r *http.Request) {
	var req HeartbeatRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httpx.Error(w, r, h.log, apperr.ErrInvalidInput)
		return
	}

	resp, err := h.service.Heartbeat(r.Context(), req)
	if err != nil {
		httpx.Error(w, r, h.log, err)
		return
	}

	httpx.JSON(w, http.StatusOK, resp)
}
