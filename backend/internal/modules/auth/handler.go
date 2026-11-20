package auth

import (
	"encoding/json"
	"log/slog"
	"net/http"
	"time"

	"fuel-station-backend/internal/shared/apperr"
	"fuel-station-backend/internal/shared/httpx"
	"fuel-station-backend/internal/shared/middleware"
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

// RegisterRoutes registers auth endpoints into chi.Router.
func (h *Handler) RegisterRoutes(r chi.Router, authMiddleware func(http.Handler) http.Handler) {
	// Public routes
	r.Post("/login", h.Login)

	// Protected routes
	r.Group(func(pr chi.Router) {
		pr.Use(authMiddleware)
		pr.Get("/me", h.Me)
		pr.Post("/change-password", h.ChangePassword)
		pr.Post("/logout", h.Logout)
	})
}

func (h *Handler) Login(w http.ResponseWriter, r *http.Request) {
	var req LoginRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httpx.Error(w, r, h.log, apperr.ErrInvalidInput)
		return
	}

	ip := r.RemoteAddr
	userAgent := r.UserAgent()

	resp, err := h.service.Login(r.Context(), req, ip, userAgent)
	if err != nil {
		httpx.Error(w, r, h.log, err)
		return
	}

	// Set session_token cookie (HttpOnly, SameSite=Lax)
	maxAge := int(time.Until(resp.ExpiresAt).Seconds())
	if maxAge < 0 {
		maxAge = 86400
	}

	http.SetCookie(w, &http.Cookie{
		Name:     "session_token",
		Value:    resp.Token,
		Path:     "/",
		MaxAge:   maxAge,
		HttpOnly: true,
		SameSite: http.SameSiteLaxMode,
		Secure:   false, // local development mode, true if TLS
	})

	httpx.JSON(w, http.StatusOK, resp)
}

func (h *Handler) Me(w http.ResponseWriter, r *http.Request) {
	resp, err := h.service.Me(r.Context())
	if err != nil {
		httpx.Error(w, r, h.log, err)
		return
	}

	httpx.JSON(w, http.StatusOK, resp)
}

func (h *Handler) ChangePassword(w http.ResponseWriter, r *http.Request) {
	var req ChangePasswordRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httpx.Error(w, r, h.log, apperr.ErrInvalidInput)
		return
	}

	if err := h.service.ChangePassword(r.Context(), req); err != nil {
		httpx.Error(w, r, h.log, err)
		return
	}

	httpx.JSON(w, http.StatusOK, map[string]string{
		"message": "Đổi mật khẩu thành công",
	})
}

func (h *Handler) Logout(w http.ResponseWriter, r *http.Request) {
	rawToken := middleware.ExtractToken(r)
	_ = h.service.Logout(r.Context(), rawToken)

	// Clear session cookie
	http.SetCookie(w, &http.Cookie{
		Name:     "session_token",
		Value:    "",
		Path:     "/",
		MaxAge:   -1,
		HttpOnly: true,
		SameSite: http.SameSiteLaxMode,
	})

	httpx.JSON(w, http.StatusOK, map[string]string{
		"message": "Đăng xuất thành công",
	})
}
