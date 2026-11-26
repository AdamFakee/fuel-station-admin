package assets

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

func (h *Handler) RegisterRoutes(r chi.Router, authMiddleware func(http.Handler) http.Handler) {
	r.Group(func(protected chi.Router) {
		protected.Use(authMiddleware)

		// Branch API (org.branch permissions)
		protected.With(authz.RequirePermission("org.branch:view", h.log)).Get("/assets/branches", h.ListBranches)
		protected.With(authz.RequirePermission("org.branch:create", h.log)).Post("/assets/branches", h.CreateBranch)
		protected.With(authz.RequirePermission("org.branch:view", h.log)).Get("/assets/branches/{id}", h.GetBranch)
		protected.With(authz.RequirePermission("org.branch:update", h.log)).Put("/assets/branches/{id}", h.UpdateBranch)
		protected.With(authz.RequirePermission("org.branch:delete", h.log)).Delete("/assets/branches/{id}", h.DeleteBranch)

		// Fuel Types API
		protected.With(authz.RequirePermission("master.catalog:view", h.log)).Get("/assets/fuel-types", h.ListFuelTypes)
		protected.With(authz.RequirePermission("master.catalog:create", h.log)).Post("/assets/fuel-types", h.CreateFuelType)

		// Tanks API (asset.tank permissions)
		protected.With(authz.RequirePermission("asset.tank:view", h.log)).Get("/assets/tanks", h.ListTanks)
		protected.With(authz.RequirePermission("asset.tank:create", h.log)).Post("/assets/tanks", h.CreateTank)
		protected.With(authz.RequirePermission("asset.tank:view", h.log)).Get("/assets/tanks/{id}", h.GetTank)
		protected.With(authz.RequirePermission("asset.tank:update", h.log)).Put("/assets/tanks/{id}", h.UpdateTank)

		// Pumps API (asset.pump permissions)
		protected.With(authz.RequirePermission("asset.pump:view", h.log)).Get("/assets/pumps", h.ListPumps)
		protected.With(authz.RequirePermission("asset.pump:create", h.log)).Post("/assets/pumps", h.CreatePump)
		protected.With(authz.RequirePermission("asset.pump:update", h.log)).Put("/assets/pumps/{id}", h.UpdatePump)
		protected.With(authz.RequirePermission("asset.pump:delete", h.log)).Delete("/assets/pumps/{id}", h.DeletePump)

		// Devices API (asset.device permissions)
		protected.With(authz.RequirePermission("asset.device:view", h.log)).Get("/assets/devices", h.ListDevices)
		protected.With(authz.RequirePermission("asset.device:update", h.log)).Put("/assets/devices/sensors/{pumpId}", h.UpdateSensor)
		protected.With(authz.RequirePermission("asset.device:update", h.log)).Put("/assets/devices/terminals/{pumpId}", h.UpdateTerminal)
	})
}

// ------------------------------------------------------------------------------------------------
// BRANCH HANDLERS
// ------------------------------------------------------------------------------------------------

func (h *Handler) ListBranches(w http.ResponseWriter, r *http.Request) {
	page, _ := strconv.Atoi(r.URL.Query().Get("page"))
	pageSize, _ := strconv.Atoi(r.URL.Query().Get("page_size"))

	q := BranchListQuery{
		Page:     page,
		PageSize: pageSize,
		Search:   r.URL.Query().Get("q"),
		Status:   r.URL.Query().Get("status"),
	}

	branches, total, err := h.service.ListBranches(r.Context(), q)
	if err != nil {
		httpx.Error(w, r, h.log, err)
		return
	}

	httpx.JSON(w, http.StatusOK, map[string]any{
		"data":      branches,
		"total":     total,
		"page":      q.Page,
		"page_size": q.PageSize,
	})
}

func (h *Handler) GetBranch(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	branch, err := h.service.GetBranch(r.Context(), id)
	if err != nil {
		httpx.Error(w, r, h.log, err)
		return
	}

	httpx.JSON(w, http.StatusOK, branch)
}

func (h *Handler) CreateBranch(w http.ResponseWriter, r *http.Request) {
	var req CreateBranchRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httpx.Error(w, r, h.log, apperr.ErrInvalidInput)
		return
	}

	branch, err := h.service.CreateBranch(r.Context(), req)
	if err != nil {
		httpx.Error(w, r, h.log, err)
		return
	}

	httpx.JSON(w, http.StatusCreated, branch)
}

func (h *Handler) UpdateBranch(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	var req UpdateBranchRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httpx.Error(w, r, h.log, apperr.ErrInvalidInput)
		return
	}

	branch, err := h.service.UpdateBranch(r.Context(), id, req)
	if err != nil {
		httpx.Error(w, r, h.log, err)
		return
	}

	httpx.JSON(w, http.StatusOK, branch)
}

func (h *Handler) DeleteBranch(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if err := h.service.DeleteBranch(r.Context(), id); err != nil {
		httpx.Error(w, r, h.log, err)
		return
	}

	httpx.JSON(w, http.StatusOK, map[string]string{
		"message": "Đã xóa trạm xăng",
	})
}

// ------------------------------------------------------------------------------------------------
// FUEL TYPES HANDLERS
// ------------------------------------------------------------------------------------------------

func (h *Handler) ListFuelTypes(w http.ResponseWriter, r *http.Request) {
	types, err := h.service.ListFuelTypes(r.Context())
	if err != nil {
		httpx.Error(w, r, h.log, err)
		return
	}

	httpx.JSON(w, http.StatusOK, types)
}

func (h *Handler) CreateFuelType(w http.ResponseWriter, r *http.Request) {
	var req CreateFuelTypeRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httpx.Error(w, r, h.log, apperr.ErrInvalidInput)
		return
	}

	ft, err := h.service.CreateFuelType(r.Context(), req)
	if err != nil {
		httpx.Error(w, r, h.log, err)
		return
	}

	httpx.JSON(w, http.StatusCreated, ft)
}

// ------------------------------------------------------------------------------------------------
// TANK HANDLERS
// ------------------------------------------------------------------------------------------------

func (h *Handler) ListTanks(w http.ResponseWriter, r *http.Request) {
	page, _ := strconv.Atoi(r.URL.Query().Get("page"))
	pageSize, _ := strconv.Atoi(r.URL.Query().Get("page_size"))

	q := TankListQuery{
		Page:     page,
		PageSize: pageSize,
		Search:   r.URL.Query().Get("q"),
		BranchID: r.URL.Query().Get("branch_id"),
		Status:   r.URL.Query().Get("status"),
	}

	tanks, total, err := h.service.ListTanks(r.Context(), q)
	if err != nil {
		httpx.Error(w, r, h.log, err)
		return
	}

	httpx.JSON(w, http.StatusOK, map[string]any{
		"data":      tanks,
		"total":     total,
		"page":      q.Page,
		"page_size": q.PageSize,
	})
}

func (h *Handler) GetTank(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	tank, err := h.service.GetTank(r.Context(), id)
	if err != nil {
		httpx.Error(w, r, h.log, err)
		return
	}

	httpx.JSON(w, http.StatusOK, tank)
}

func (h *Handler) CreateTank(w http.ResponseWriter, r *http.Request) {
	var req CreateTankRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httpx.Error(w, r, h.log, apperr.ErrInvalidInput)
		return
	}

	tank, err := h.service.CreateTank(r.Context(), req)
	if err != nil {
		httpx.Error(w, r, h.log, err)
		return
	}

	httpx.JSON(w, http.StatusCreated, tank)
}

func (h *Handler) UpdateTank(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	var req UpdateTankRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httpx.Error(w, r, h.log, apperr.ErrInvalidInput)
		return
	}

	tank, err := h.service.UpdateTank(r.Context(), id, req)
	if err != nil {
		httpx.Error(w, r, h.log, err)
		return
	}

	httpx.JSON(w, http.StatusOK, tank)
}

// ------------------------------------------------------------------------------------------------
// PUMP HANDLERS
// ------------------------------------------------------------------------------------------------

func (h *Handler) ListPumps(w http.ResponseWriter, r *http.Request) {
	page, _ := strconv.Atoi(r.URL.Query().Get("page"))
	pageSize, _ := strconv.Atoi(r.URL.Query().Get("page_size"))

	var enabledPtr *bool
	if enStr := r.URL.Query().Get("enabled"); enStr != "" {
		enVal := enStr == "true" || enStr == "1"
		enabledPtr = &enVal
	}

	q := PumpListQuery{
		Page:     page,
		PageSize: pageSize,
		Search:   r.URL.Query().Get("q"),
		BranchID: r.URL.Query().Get("branch_id"),
		Enabled:  enabledPtr,
	}

	pumps, total, err := h.service.ListPumps(r.Context(), q)
	if err != nil {
		httpx.Error(w, r, h.log, err)
		return
	}

	httpx.JSON(w, http.StatusOK, map[string]any{
		"data":      pumps,
		"total":     total,
		"page":      q.Page,
		"page_size": q.PageSize,
	})
}

func (h *Handler) CreatePump(w http.ResponseWriter, r *http.Request) {
	var req CreatePumpRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httpx.Error(w, r, h.log, apperr.ErrInvalidInput)
		return
	}

	pump, err := h.service.CreatePump(r.Context(), req)
	if err != nil {
		httpx.Error(w, r, h.log, err)
		return
	}

	httpx.JSON(w, http.StatusCreated, pump)
}

func (h *Handler) UpdatePump(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	var req UpdatePumpRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httpx.Error(w, r, h.log, apperr.ErrInvalidInput)
		return
	}

	pump, err := h.service.UpdatePump(r.Context(), id, req)
	if err != nil {
		httpx.Error(w, r, h.log, err)
		return
	}

	httpx.JSON(w, http.StatusOK, pump)
}

func (h *Handler) DeletePump(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if err := h.service.DeletePump(r.Context(), id); err != nil {
		httpx.Error(w, r, h.log, err)
		return
	}

	httpx.JSON(w, http.StatusOK, map[string]string{
		"message": "Trụ bơm đã được ngừng vận hành",
	})
}

// ------------------------------------------------------------------------------------------------
// DEVICE HANDLERS
// ------------------------------------------------------------------------------------------------

func (h *Handler) ListDevices(w http.ResponseWriter, r *http.Request) {
	branchID := r.URL.Query().Get("branch_id")
	devices, err := h.service.ListDevices(r.Context(), branchID)
	if err != nil {
		httpx.Error(w, r, h.log, err)
		return
	}

	httpx.JSON(w, http.StatusOK, devices)
}

func (h *Handler) UpdateSensor(w http.ResponseWriter, r *http.Request) {
	pumpID := chi.URLParam(r, "pumpId")
	var req UpdateSensorRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httpx.Error(w, r, h.log, apperr.ErrInvalidInput)
		return
	}

	sensor, err := h.service.UpdateSensor(r.Context(), pumpID, req)
	if err != nil {
		httpx.Error(w, r, h.log, err)
		return
	}

	httpx.JSON(w, http.StatusOK, sensor)
}

func (h *Handler) UpdateTerminal(w http.ResponseWriter, r *http.Request) {
	pumpID := chi.URLParam(r, "pumpId")
	var req UpdateTerminalRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httpx.Error(w, r, h.log, apperr.ErrInvalidInput)
		return
	}

	terminal, err := h.service.UpdateTerminal(r.Context(), pumpID, req)
	if err != nil {
		httpx.Error(w, r, h.log, err)
		return
	}

	httpx.JSON(w, http.StatusOK, terminal)
}
