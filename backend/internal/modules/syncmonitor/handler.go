package syncmonitor

import (
	"log/slog"
	"net/http"

	"fuel-station-backend/internal/shared/authz"
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

// RegisterRoutes registers sync monitor endpoints into chi.Router.
func (h *Handler) RegisterRoutes(r chi.Router, authMiddleware func(http.Handler) http.Handler) {
	r.Group(func(pr chi.Router) {
		pr.Use(authMiddleware)
		pr.Use(authz.RequirePermission("sync.monitor:view", h.log))

		pr.Get("/sync-monitor/stations", h.GetStations)
	})
}

func (h *Handler) GetStations(w http.ResponseWriter, r *http.Request) {
	resp, err := h.service.GetStations(r.Context())
	if err != nil {
		httpx.Error(w, r, h.log, err)
		return
	}

	httpx.JSON(w, http.StatusOK, resp)
}
