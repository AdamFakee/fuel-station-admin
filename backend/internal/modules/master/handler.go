package master

import (
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"strconv"

	"fuel-station-backend/internal/shared/apperr"
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
	return &Handler{service: service, log: log}
}

func (h *Handler) RegisterRoutes(r chi.Router, authMiddleware func(http.Handler) http.Handler) {
	r.Group(func(protected chi.Router) {
		protected.Use(authMiddleware)

		// Catalogs Summary
		protected.With(authz.RequirePermission("master.catalog:view", h.log)).Get("/master/catalogs/summary", h.GetCatalogsSummary)

		// Vehicle Routes
		protected.With(authz.RequirePermission("master.vehicle:view", h.log)).Get("/master/vehicles", h.ListVehicles)
		protected.With(authz.RequirePermission("master.vehicle:create", h.log)).Post("/master/vehicles", h.CreateVehicle)
		protected.With(authz.RequirePermission("master.vehicle:view", h.log)).Get("/master/vehicles/{id}", h.GetVehicle)
		protected.With(authz.RequirePermission("master.vehicle:update", h.log)).Put("/master/vehicles/{id}", h.UpdateVehicle)
		protected.With(authz.RequirePermission("master.vehicle:update", h.log)).Patch("/master/vehicles/{id}/status", h.UpdateVehicleStatus)
		protected.With(authz.RequirePermission("master.vehicle:update", h.log)).Post("/master/vehicles/{id}/card", h.AssignVehicleCard)
		protected.With(authz.RequirePermission("master.vehicle:update", h.log)).Delete("/master/vehicles/{id}/card", h.RevokeVehicleCard)
		protected.With(authz.RequirePermission("master.vehicle:delete", h.log)).Delete("/master/vehicles/{id}", h.DeleteVehicle)

		// Driver Routes
		protected.With(authz.RequirePermission("master.driver:view", h.log)).Get("/master/drivers", h.ListDrivers)
		protected.With(authz.RequirePermission("master.driver:create", h.log)).Post("/master/drivers", h.CreateDriver)
		protected.With(authz.RequirePermission("master.driver:view", h.log)).Get("/master/drivers/{id}", h.GetDriver)
		protected.With(authz.RequirePermission("master.driver:update", h.log)).Put("/master/drivers/{id}", h.UpdateDriver)
		protected.With(authz.RequirePermission("master.driver:update", h.log)).Patch("/master/drivers/{id}/status", h.UpdateDriverStatus)
		protected.With(authz.RequirePermission("master.driver:update", h.log)).Post("/master/drivers/{id}/credentials/card", h.AssignDriverCard)
		protected.With(authz.RequirePermission("master.driver:update", h.log)).Post("/master/drivers/{id}/credentials/face", h.UploadDriverFace)
		protected.With(authz.RequirePermission("master.driver:update", h.log)).Post("/master/drivers/{id}/credentials/fingerprint", h.RegisterDriverFingerprint)
		protected.With(authz.RequirePermission("master.driver:update", h.log)).Delete("/master/drivers/{id}/credentials/{credId}", h.RevokeDriverCredential)
		protected.With(authz.RequirePermission("master.driver:delete", h.log)).Delete("/master/drivers/{id}", h.DeleteDriver)

		// Stored file download
		protected.With(authz.RequirePermission("master.driver:view", h.log)).Get("/master/files/{id}", h.GetStoredFile)
	})
}

// ------------------------------------------------------------------------------------------------
// CATALOG HANDLERS
// ------------------------------------------------------------------------------------------------

func (h *Handler) GetCatalogsSummary(w http.ResponseWriter, r *http.Request) {
	summary, err := h.service.GetCatalogsSummary(r.Context())
	if err != nil {
		httpx.Error(w, r, h.log, err)
		return
	}
	httpx.JSON(w, http.StatusOK, summary)
}

// ------------------------------------------------------------------------------------------------
// VEHICLE HANDLERS
// ------------------------------------------------------------------------------------------------

func (h *Handler) ListVehicles(w http.ResponseWriter, r *http.Request) {
	page, _ := strconv.Atoi(r.URL.Query().Get("page"))
	pageSize, _ := strconv.Atoi(r.URL.Query().Get("page_size"))

	q := VehicleListQuery{
		Page:     page,
		PageSize: pageSize,
		Search:   r.URL.Query().Get("q"),
		Status:   r.URL.Query().Get("status"),
	}

	if bStr := r.URL.Query().Get("branch_id"); bStr != "" {
		if bID, err := uuid.Parse(bStr); err == nil {
			q.BranchID = &bID
		}
	}
	if vtStr := r.URL.Query().Get("vehicle_type_id"); vtStr != "" {
		if vtID, err := uuid.Parse(vtStr); err == nil {
			q.VehicleTypeID = &vtID
		}
	}
	if ftStr := r.URL.Query().Get("fuel_type_id"); ftStr != "" {
		if ftID, err := uuid.Parse(ftStr); err == nil {
			q.FuelTypeID = &ftID
		}
	}
	if rStr := r.URL.Query().Get("route_id"); rStr != "" {
		if rID, err := uuid.Parse(rStr); err == nil {
			q.RouteID = &rID
		}
	}
	if gStr := r.URL.Query().Get("group_id"); gStr != "" {
		if gID, err := uuid.Parse(gStr); err == nil {
			q.GroupID = &gID
		}
	}

	items, total, err := h.service.ListVehicles(r.Context(), q)
	if err != nil {
		httpx.Error(w, r, h.log, err)
		return
	}

	httpx.JSON(w, http.StatusOK, map[string]any{
		"items":     items,
		"total":     total,
		"page":      q.Page,
		"page_size": q.PageSize,
	})
}

func (h *Handler) GetVehicle(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		httpx.Error(w, r, h.log, apperr.ErrInvalidInput)
		return
	}

	detail, err := h.service.GetVehicle(r.Context(), id)
	if err != nil {
		httpx.Error(w, r, h.log, err)
		return
	}

	httpx.JSON(w, http.StatusOK, detail)
}

func (h *Handler) CreateVehicle(w http.ResponseWriter, r *http.Request) {
	var req CreateVehicleRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httpx.Error(w, r, h.log, apperr.ErrInvalidInput)
		return
	}

	created, err := h.service.CreateVehicle(r.Context(), req)
	if err != nil {
		httpx.Error(w, r, h.log, err)
		return
	}

	httpx.JSON(w, http.StatusCreated, created)
}

func (h *Handler) UpdateVehicle(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		httpx.Error(w, r, h.log, apperr.ErrInvalidInput)
		return
	}

	var req UpdateVehicleRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httpx.Error(w, r, h.log, apperr.ErrInvalidInput)
		return
	}

	updated, err := h.service.UpdateVehicle(r.Context(), id, req)
	if err != nil {
		httpx.Error(w, r, h.log, err)
		return
	}

	httpx.JSON(w, http.StatusOK, updated)
}

func (h *Handler) UpdateVehicleStatus(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		httpx.Error(w, r, h.log, apperr.ErrInvalidInput)
		return
	}

	var req UpdateVehicleStatusRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httpx.Error(w, r, h.log, apperr.ErrInvalidInput)
		return
	}

	if err := h.service.UpdateVehicleStatus(r.Context(), id, req.Status); err != nil {
		httpx.Error(w, r, h.log, err)
		return
	}

	httpx.JSON(w, http.StatusOK, map[string]any{"status": req.Status})
}

func (h *Handler) AssignVehicleCard(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		httpx.Error(w, r, h.log, apperr.ErrInvalidInput)
		return
	}

	var req AssignVehicleCardRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httpx.Error(w, r, h.log, apperr.ErrInvalidInput)
		return
	}

	if err := h.service.AssignVehicleCard(r.Context(), id, req.CardNumber); err != nil {
		httpx.Error(w, r, h.log, err)
		return
	}

	httpx.JSON(w, http.StatusOK, map[string]any{"card_number": req.CardNumber})
}

func (h *Handler) RevokeVehicleCard(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		httpx.Error(w, r, h.log, apperr.ErrInvalidInput)
		return
	}

	if err := h.service.RevokeVehicleCard(r.Context(), id); err != nil {
		httpx.Error(w, r, h.log, err)
		return
	}

	httpx.JSON(w, http.StatusOK, map[string]any{"message": "Card revoked successfully"})
}

func (h *Handler) DeleteVehicle(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		httpx.Error(w, r, h.log, apperr.ErrInvalidInput)
		return
	}

	if err := h.service.DeleteVehicle(r.Context(), id); err != nil {
		httpx.Error(w, r, h.log, err)
		return
	}

	httpx.JSON(w, http.StatusOK, map[string]any{"message": "Vehicle deleted successfully"})
}

// ------------------------------------------------------------------------------------------------
// DRIVER HANDLERS
// ------------------------------------------------------------------------------------------------

func (h *Handler) ListDrivers(w http.ResponseWriter, r *http.Request) {
	page, _ := strconv.Atoi(r.URL.Query().Get("page"))
	pageSize, _ := strconv.Atoi(r.URL.Query().Get("page_size"))

	q := DriverListQuery{
		Page:       page,
		PageSize:   pageSize,
		Search:     r.URL.Query().Get("q"),
		Status:     r.URL.Query().Get("status"),
		Position:   r.URL.Query().Get("position"),
		Department: r.URL.Query().Get("department"),
	}

	if bStr := r.URL.Query().Get("branch_id"); bStr != "" {
		if bID, err := uuid.Parse(bStr); err == nil {
			q.BranchID = &bID
		}
	}

	items, total, err := h.service.ListDrivers(r.Context(), q)
	if err != nil {
		httpx.Error(w, r, h.log, err)
		return
	}

	httpx.JSON(w, http.StatusOK, map[string]any{
		"items":     items,
		"total":     total,
		"page":      q.Page,
		"page_size": q.PageSize,
	})
}

func (h *Handler) GetDriver(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		httpx.Error(w, r, h.log, apperr.ErrInvalidInput)
		return
	}

	detail, err := h.service.GetDriver(r.Context(), id)
	if err != nil {
		httpx.Error(w, r, h.log, err)
		return
	}

	httpx.JSON(w, http.StatusOK, detail)
}

func (h *Handler) CreateDriver(w http.ResponseWriter, r *http.Request) {
	var req CreateDriverRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httpx.Error(w, r, h.log, apperr.ErrInvalidInput)
		return
	}

	created, err := h.service.CreateDriver(r.Context(), req)
	if err != nil {
		httpx.Error(w, r, h.log, err)
		return
	}

	httpx.JSON(w, http.StatusCreated, created)
}

func (h *Handler) UpdateDriver(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		httpx.Error(w, r, h.log, apperr.ErrInvalidInput)
		return
	}

	var req UpdateDriverRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httpx.Error(w, r, h.log, apperr.ErrInvalidInput)
		return
	}

	updated, err := h.service.UpdateDriver(r.Context(), id, req)
	if err != nil {
		httpx.Error(w, r, h.log, err)
		return
	}

	httpx.JSON(w, http.StatusOK, updated)
}

func (h *Handler) UpdateDriverStatus(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		httpx.Error(w, r, h.log, apperr.ErrInvalidInput)
		return
	}

	var req UpdateDriverStatusRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httpx.Error(w, r, h.log, apperr.ErrInvalidInput)
		return
	}

	if err := h.service.UpdateDriverStatus(r.Context(), id, req.Status); err != nil {
		httpx.Error(w, r, h.log, err)
		return
	}

	httpx.JSON(w, http.StatusOK, map[string]any{"status": req.Status})
}

func (h *Handler) AssignDriverCard(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		httpx.Error(w, r, h.log, apperr.ErrInvalidInput)
		return
	}

	var req AssignDriverCardRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httpx.Error(w, r, h.log, apperr.ErrInvalidInput)
		return
	}

	if err := h.service.AssignDriverCard(r.Context(), id, req.CardNumber); err != nil {
		httpx.Error(w, r, h.log, err)
		return
	}

	httpx.JSON(w, http.StatusOK, map[string]any{"card_number": req.CardNumber})
}

func (h *Handler) UploadDriverFace(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		httpx.Error(w, r, h.log, apperr.ErrInvalidInput)
		return
	}

	// 512 KB multipart limit in memory
	if err := r.ParseMultipartForm(512 * 1024); err != nil {
		httpx.Error(w, r, h.log, fmt.Errorf("%w: parse multipart form: %v", apperr.ErrInvalidInput, err))
		return
	}

	file, header, err := r.FormFile("photo")
	if err != nil {
		httpx.Error(w, r, h.log, fmt.Errorf("%w: photo file is required", apperr.ErrInvalidInput))
		return
	}
	defer file.Close()

	cred, err := h.service.UploadDriverFace(r.Context(), id, header.Filename, header.Header.Get("Content-Type"), header.Size, file)
	if err != nil {
		httpx.Error(w, r, h.log, err)
		return
	}

	httpx.JSON(w, http.StatusCreated, cred)
}

func (h *Handler) RegisterDriverFingerprint(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		httpx.Error(w, r, h.log, apperr.ErrInvalidInput)
		return
	}

	var req RegisterDriverFingerprintRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httpx.Error(w, r, h.log, apperr.ErrInvalidInput)
		return
	}

	cred, err := h.service.RegisterDriverFingerprint(r.Context(), id, req.BiometricTemplateID)
	if err != nil {
		httpx.Error(w, r, h.log, err)
		return
	}

	httpx.JSON(w, http.StatusCreated, cred)
}

func (h *Handler) RevokeDriverCredential(w http.ResponseWriter, r *http.Request) {
	driverID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		httpx.Error(w, r, h.log, apperr.ErrInvalidInput)
		return
	}
	credID, err := uuid.Parse(chi.URLParam(r, "credId"))
	if err != nil {
		httpx.Error(w, r, h.log, apperr.ErrInvalidInput)
		return
	}

	if err := h.service.RevokeDriverCredential(r.Context(), driverID, credID); err != nil {
		httpx.Error(w, r, h.log, err)
		return
	}

	httpx.JSON(w, http.StatusOK, map[string]any{"message": "Credential revoked successfully"})
}

func (h *Handler) DeleteDriver(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		httpx.Error(w, r, h.log, apperr.ErrInvalidInput)
		return
	}

	if err := h.service.DeleteDriver(r.Context(), id); err != nil {
		httpx.Error(w, r, h.log, err)
		return
	}

	httpx.JSON(w, http.StatusOK, map[string]any{"message": "Driver deleted successfully"})
}

func (h *Handler) GetStoredFile(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		httpx.Error(w, r, h.log, apperr.ErrInvalidInput)
		return
	}

	sf, rc, err := h.service.OpenFile(r.Context(), id)
	if err != nil {
		httpx.Error(w, r, h.log, err)
		return
	}
	defer rc.Close()

	w.Header().Set("Content-Type", sf.ContentType)
	w.Header().Set("Content-Length", strconv.FormatInt(sf.SizeBytes, 10))
	w.WriteHeader(http.StatusOK)
	_, _ = io.Copy(w, rc)
}
