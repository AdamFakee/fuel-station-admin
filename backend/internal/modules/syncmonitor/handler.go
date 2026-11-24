package syncmonitor

import (
	"log/slog"
	"net"
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

	// Cấp, cấp lại, thu hồi khóa API của trạm Edge: chỉ vai trò có quyền sync.monitor:update (ADMIN)
	r.Group(func(pr chi.Router) {
		pr.Use(authMiddleware)
		pr.Use(authz.RequirePermission("sync.monitor:update", h.log))

		pr.Post("/sync-monitor/branches/{branchId}/api-key", h.IssueAPIKey)
		pr.Delete("/sync-monitor/branches/{branchId}/api-key", h.RevokeAPIKey)
	})
}

func (h *Handler) IssueAPIKey(w http.ResponseWriter, r *http.Request) {
	resp, err := h.service.IssueAPIKey(r.Context(), chi.URLParam(r, "branchId"), clientIP(r.RemoteAddr))
	if err != nil {
		httpx.Error(w, r, h.log, err)
		return
	}
	// Khóa không được lưu ở bộ nhớ đệm của trình duyệt hay proxy
	w.Header().Set("Cache-Control", "no-store")
	httpx.JSON(w, http.StatusOK, resp)
}

func (h *Handler) RevokeAPIKey(w http.ResponseWriter, r *http.Request) {
	if err := h.service.RevokeAPIKey(r.Context(), chi.URLParam(r, "branchId"), clientIP(r.RemoteAddr)); err != nil {
		httpx.Error(w, r, h.log, err)
		return
	}
	httpx.JSON(w, http.StatusOK, map[string]string{"message": "Đã thu hồi khóa API, trạm ngừng hoạt động"})
}

func (h *Handler) GetStations(w http.ResponseWriter, r *http.Request) {
	resp, err := h.service.GetStations(r.Context())
	if err != nil {
		httpx.Error(w, r, h.log, err)
		return
	}

	httpx.JSON(w, http.StatusOK, resp)
}

// clientIP bỏ cổng khỏi RemoteAddr; không phải địa chỉ IP hợp lệ thì trả rỗng (cột nhật ký kiểm toán là kiểu inet).
func clientIP(remoteAddr string) string {
	host, _, err := net.SplitHostPort(remoteAddr)
	if err != nil {
		host = remoteAddr
	}
	if net.ParseIP(host) == nil {
		return ""
	}
	return host
}
