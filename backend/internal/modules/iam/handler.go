package iam

import (
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

func (h *Handler) RegisterRoutes(r chi.Router, authMiddleware func(http.Handler) http.Handler) {
	r.Group(func(protected chi.Router) {
		protected.Use(authMiddleware)

		// Users API
		protected.With(authz.RequirePermission("iam.user:view", h.log)).Get("/iam/users", h.ListUsers)
		protected.With(authz.RequirePermission("iam.user:create", h.log)).Post("/iam/users", h.CreateUser)
		protected.With(authz.RequirePermission("iam.user:view", h.log)).Get("/iam/users/{id}", h.GetUser)
		protected.With(authz.RequirePermission("iam.user:update", h.log)).Put("/iam/users/{id}", h.UpdateUser)
		protected.With(authz.RequirePermission("iam.user:update", h.log)).Patch("/iam/users/{id}/status", h.UpdateUserStatus)
		protected.With(authz.RequirePermission("iam.user:update", h.log)).Post("/iam/users/{id}/reset-password", h.ResetPassword)
		protected.With(authz.RequirePermission("iam.user:delete", h.log)).Delete("/iam/users/{id}", h.DeleteUser)

		// Roles API
		protected.With(authz.RequirePermission("iam.role:view", h.log)).Get("/iam/roles", h.ListRoles)
		protected.With(authz.RequirePermission("iam.role:create", h.log)).Post("/iam/roles", h.CreateRole)
		protected.With(authz.RequirePermission("iam.role:view", h.log)).Get("/iam/roles/{id}", h.GetRole)
		protected.With(authz.RequirePermission("iam.role:update", h.log)).Put("/iam/roles/{id}", h.UpdateRole)
		protected.With(authz.RequirePermission("iam.role:delete", h.log)).Delete("/iam/roles/{id}", h.DeleteRole)

		// Metadata API
		protected.With(authz.RequirePermission("iam.role:view", h.log)).Get("/iam/permissions", h.ListPermissions)
		protected.With(authz.RequirePermission("iam.user:view", h.log)).Get("/iam/branches", h.ListBranches)
	})
}

// ------------------------------------------------------------------------------------------------
// USER HANDLERS
// ------------------------------------------------------------------------------------------------

func (h *Handler) ListUsers(w http.ResponseWriter, r *http.Request) {
	page, _ := strconv.Atoi(r.URL.Query().Get("page"))
	pageSize, _ := strconv.Atoi(r.URL.Query().Get("page_size"))

	q := UserListQuery{
		Page:     page,
		PageSize: pageSize,
		Search:   r.URL.Query().Get("q"),
		RoleID:   r.URL.Query().Get("role_id"),
		Status:   r.URL.Query().Get("status"),
	}

	res, err := h.service.ListUsers(r.Context(), q)
	if err != nil {
		httpx.Error(w, r, h.log, err)
		return
	}

	httpx.JSON(w, http.StatusOK, res)
}

func (h *Handler) GetUser(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	res, err := h.service.GetUser(r.Context(), id)
	if err != nil {
		httpx.Error(w, r, h.log, err)
		return
	}

	httpx.JSON(w, http.StatusOK, res)
}

func (h *Handler) CreateUser(w http.ResponseWriter, r *http.Request) {
	var req CreateUserRequest
	if err := httpx.DecodeJSON(r, &req); err != nil {
		httpx.Error(w, r, h.log, apperr.ErrInvalidInput)
		return
	}

	res, err := h.service.CreateUser(r.Context(), req)
	if err != nil {
		httpx.Error(w, r, h.log, err)
		return
	}

	httpx.JSON(w, http.StatusCreated, res)
}

func (h *Handler) UpdateUser(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	var req UpdateUserRequest
	if err := httpx.DecodeJSON(r, &req); err != nil {
		httpx.Error(w, r, h.log, apperr.ErrInvalidInput)
		return
	}

	res, err := h.service.UpdateUser(r.Context(), id, req)
	if err != nil {
		httpx.Error(w, r, h.log, err)
		return
	}

	httpx.JSON(w, http.StatusOK, res)
}

func (h *Handler) UpdateUserStatus(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	var req UpdateUserStatusRequest
	if err := httpx.DecodeJSON(r, &req); err != nil {
		httpx.Error(w, r, h.log, apperr.ErrInvalidInput)
		return
	}

	err := h.service.UpdateUserStatus(r.Context(), id, req.Status)
	if err != nil {
		httpx.Error(w, r, h.log, err)
		return
	}

	httpx.JSON(w, http.StatusOK, map[string]string{"message": "user status updated successfully"})
}

func (h *Handler) ResetPassword(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	var req ResetPasswordRequest
	if err := httpx.DecodeJSON(r, &req); err != nil {
		httpx.Error(w, r, h.log, apperr.ErrInvalidInput)
		return
	}

	err := h.service.ResetPassword(r.Context(), id, req.NewPassword)
	if err != nil {
		httpx.Error(w, r, h.log, err)
		return
	}

	httpx.JSON(w, http.StatusOK, map[string]string{"message": "password reset successfully"})
}

func (h *Handler) DeleteUser(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	err := h.service.DeleteUser(r.Context(), id)
	if err != nil {
		httpx.Error(w, r, h.log, err)
		return
	}

	httpx.JSON(w, http.StatusOK, map[string]string{"message": "user deleted successfully"})
}

// ------------------------------------------------------------------------------------------------
// ROLE HANDLERS
// ------------------------------------------------------------------------------------------------

func (h *Handler) ListRoles(w http.ResponseWriter, r *http.Request) {
	roles, err := h.service.ListRoles(r.Context())
	if err != nil {
		httpx.Error(w, r, h.log, err)
		return
	}

	httpx.JSON(w, http.StatusOK, roles)
}

func (h *Handler) GetRole(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	res, err := h.service.GetRole(r.Context(), id)
	if err != nil {
		httpx.Error(w, r, h.log, err)
		return
	}

	httpx.JSON(w, http.StatusOK, res)
}

func (h *Handler) CreateRole(w http.ResponseWriter, r *http.Request) {
	var req CreateRoleRequest
	if err := httpx.DecodeJSON(r, &req); err != nil {
		httpx.Error(w, r, h.log, apperr.ErrInvalidInput)
		return
	}

	res, err := h.service.CreateRole(r.Context(), req)
	if err != nil {
		httpx.Error(w, r, h.log, err)
		return
	}

	httpx.JSON(w, http.StatusCreated, res)
}

func (h *Handler) UpdateRole(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	var req UpdateRoleRequest
	if err := httpx.DecodeJSON(r, &req); err != nil {
		httpx.Error(w, r, h.log, apperr.ErrInvalidInput)
		return
	}

	res, err := h.service.UpdateRole(r.Context(), id, req)
	if err != nil {
		httpx.Error(w, r, h.log, err)
		return
	}

	httpx.JSON(w, http.StatusOK, res)
}

func (h *Handler) DeleteRole(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	err := h.service.DeleteRole(r.Context(), id)
	if err != nil {
		httpx.Error(w, r, h.log, err)
		return
	}

	httpx.JSON(w, http.StatusOK, map[string]string{"message": "role deleted successfully"})
}

func (h *Handler) ListPermissions(w http.ResponseWriter, r *http.Request) {
	perms, err := h.service.ListPermissions(r.Context())
	if err != nil {
		httpx.Error(w, r, h.log, err)
		return
	}

	httpx.JSON(w, http.StatusOK, perms)
}

func (h *Handler) ListBranches(w http.ResponseWriter, r *http.Request) {
	branches, err := h.service.ListBranches(r.Context())
	if err != nil {
		httpx.Error(w, r, h.log, err)
		return
	}

	httpx.JSON(w, http.StatusOK, branches)
}
