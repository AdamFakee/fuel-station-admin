package inventory

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

		// Receipts (M10 - Nhập bể)
		protected.With(authz.RequirePermission("inventory.receipt:view", h.log)).Get("/inventory/receipts", h.ListReceipts)
		protected.With(authz.RequirePermission("inventory.receipt:create", h.log)).Post("/inventory/receipts", h.CreateReceipt)
		protected.With(authz.RequirePermission("inventory.receipt:view", h.log)).Get("/inventory/receipts/{id}", h.GetReceipt)
		protected.With(authz.RequirePermission("inventory.receipt:update", h.log)).Put("/inventory/receipts/{id}", h.UpdateReceipt)
		protected.With(authz.RequirePermission("inventory.receipt:delete", h.log)).Delete("/inventory/receipts/{id}", h.DeleteReceipt)
		protected.With(authz.RequirePermission("inventory.receipt:update", h.log)).Post("/inventory/receipts/{id}/submit", h.SubmitForApproval)
		protected.With(authz.RequirePermission("inventory.receipt:approve", h.log)).Post("/inventory/receipts/{id}/approve", h.ApproveReceipt)

		// Capacity check
		protected.With(authz.RequirePermission("inventory.receipt:view", h.log)).Post("/inventory/receipts/check-capacity", h.CheckCapacity)

		// Suppliers
		protected.With(authz.RequirePermission("inventory.receipt:view", h.log)).Get("/inventory/suppliers", h.ListSuppliers)
		protected.With(authz.RequirePermission("inventory.receipt:create", h.log)).Post("/inventory/suppliers", h.CreateSupplier)

		// Stock Issues (M11 - Phiếu xuất điều chỉnh, hao hụt, kiểm định)
		protected.With(authz.RequirePermission("inventory.issue:view", h.log)).Get("/inventory/issues", h.ListIssues)
		protected.With(authz.RequirePermission("inventory.issue:create", h.log)).Post("/inventory/issues", h.CreateIssue)
		protected.With(authz.RequirePermission("inventory.issue:view", h.log)).Get("/inventory/issues/{id}", h.GetIssue)
		protected.With(authz.RequirePermission("inventory.issue:update", h.log)).Put("/inventory/issues/{id}", h.UpdateIssue)
		protected.With(authz.RequirePermission("inventory.issue:delete", h.log)).Delete("/inventory/issues/{id}", h.DeleteIssue)
		protected.With(authz.RequirePermission("inventory.issue:update", h.log)).Post("/inventory/issues/{id}/submit", h.SubmitIssueForApproval)
		protected.With(authz.RequirePermission("inventory.issue:approve", h.log)).Post("/inventory/issues/{id}/approve", h.ApproveIssue)

		// M12: Tank Stock & Ledger
		protected.With(authz.RequirePermission("inventory.receipt:view", h.log)).Get("/inventory/tanks/stock", h.ListTankStocks)
		protected.With(authz.RequirePermission("inventory.receipt:view", h.log)).Get("/inventory/tanks/{id}/ledger", h.ListTankStockLedger)

		// M12: Stock Reconciliation (Stocktake)

		// M12: Alerts & Notifications
	})
}

// ------------------------------------------------------------------------------------------------
// M10 - STOCK RECEIPTS
// ------------------------------------------------------------------------------------------------

func (h *Handler) ListReceipts(w http.ResponseWriter, r *http.Request) {
	page, _ := strconv.Atoi(r.URL.Query().Get("page"))
	pageSize, _ := strconv.Atoi(r.URL.Query().Get("page_size"))

	q := ReceiptListQuery{
		Page:     page,
		PageSize: pageSize,
		Search:   r.URL.Query().Get("q"),
		BranchID: r.URL.Query().Get("branch_id"),
		Status:   r.URL.Query().Get("status"),
	}

	receipts, total, err := h.service.ListReceipts(r.Context(), q)
	if err != nil {
		httpx.Error(w, r, h.log, err)
		return
	}

	httpx.JSON(w, http.StatusOK, map[string]any{
		"data":      receipts,
		"total":     total,
		"page":      q.Page,
		"page_size": q.PageSize,
	})
}

func (h *Handler) GetReceipt(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	receipt, err := h.service.GetReceipt(r.Context(), id)
	if err != nil {
		httpx.Error(w, r, h.log, err)
		return
	}

	httpx.JSON(w, http.StatusOK, receipt)
}

func (h *Handler) CreateReceipt(w http.ResponseWriter, r *http.Request) {
	var req CreateReceiptRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httpx.Error(w, r, h.log, apperr.ErrInvalidInput)
		return
	}

	receipt, err := h.service.CreateReceipt(r.Context(), req)
	if err != nil {
		httpx.Error(w, r, h.log, err)
		return
	}

	httpx.JSON(w, http.StatusCreated, receipt)
}

func (h *Handler) UpdateReceipt(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	var req UpdateReceiptRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httpx.Error(w, r, h.log, apperr.ErrInvalidInput)
		return
	}

	receipt, err := h.service.UpdateReceipt(r.Context(), id, req)
	if err != nil {
		httpx.Error(w, r, h.log, err)
		return
	}

	httpx.JSON(w, http.StatusOK, receipt)
}

func (h *Handler) SubmitForApproval(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	receipt, err := h.service.SubmitForApproval(r.Context(), id)
	if err != nil {
		httpx.Error(w, r, h.log, err)
		return
	}

	httpx.JSON(w, http.StatusOK, receipt)
}

func (h *Handler) ApproveReceipt(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	var req ApproveReceiptRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httpx.Error(w, r, h.log, apperr.ErrInvalidInput)
		return
	}

	receipt, err := h.service.ApproveReceipt(r.Context(), id, req)
	if err != nil {
		httpx.Error(w, r, h.log, err)
		return
	}

	httpx.JSON(w, http.StatusOK, receipt)
}

func (h *Handler) DeleteReceipt(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if err := h.service.DeleteReceipt(r.Context(), id); err != nil {
		httpx.Error(w, r, h.log, err)
		return
	}

	httpx.JSON(w, http.StatusOK, map[string]string{
		"message": "Phiếu nhập đã được xóa",
	})
}

func (h *Handler) CheckCapacity(w http.ResponseWriter, r *http.Request) {
	var req CapacityCheckRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httpx.Error(w, r, h.log, apperr.ErrInvalidInput)
		return
	}

	res, err := h.service.CheckCapacity(r.Context(), req)
	if err != nil {
		httpx.Error(w, r, h.log, err)
		return
	}

	httpx.JSON(w, http.StatusOK, res)
}

func (h *Handler) ListSuppliers(w http.ResponseWriter, r *http.Request) {
	list, err := h.service.ListSuppliers(r.Context())
	if err != nil {
		httpx.Error(w, r, h.log, err)
		return
	}

	httpx.JSON(w, http.StatusOK, list)
}

func (h *Handler) CreateSupplier(w http.ResponseWriter, r *http.Request) {
	var req CreateSupplierRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httpx.Error(w, r, h.log, apperr.ErrInvalidInput)
		return
	}

	sup, err := h.service.CreateSupplier(r.Context(), req)
	if err != nil {
		httpx.Error(w, r, h.log, err)
		return
	}

	httpx.JSON(w, http.StatusCreated, sup)
}

// ------------------------------------------------------------------------------------------------
// M11 - STOCK ISSUES
// ------------------------------------------------------------------------------------------------

func (h *Handler) ListIssues(w http.ResponseWriter, r *http.Request) {
	page, _ := strconv.Atoi(r.URL.Query().Get("page"))
	pageSize, _ := strconv.Atoi(r.URL.Query().Get("page_size"))

	q := IssueListQuery{
		Page:     page,
		PageSize: pageSize,
		Search:   r.URL.Query().Get("q"),
		BranchID: r.URL.Query().Get("branch_id"),
		Status:   r.URL.Query().Get("status"),
		Kind:     r.URL.Query().Get("kind"),
	}

	issues, total, err := h.service.ListIssues(r.Context(), q)
	if err != nil {
		httpx.Error(w, r, h.log, err)
		return
	}

	httpx.JSON(w, http.StatusOK, map[string]any{
		"items":     issues,
		"total":     total,
		"page":      q.Page,
		"page_size": q.PageSize,
	})
}

func (h *Handler) GetIssue(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if id == "" {
		httpx.Error(w, r, h.log, apperr.ErrInvalidInput)
		return
	}

	issue, err := h.service.GetIssue(r.Context(), id)
	if err != nil {
		httpx.Error(w, r, h.log, err)
		return
	}

	httpx.JSON(w, http.StatusOK, issue)
}

func (h *Handler) CreateIssue(w http.ResponseWriter, r *http.Request) {
	var req CreateIssueRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httpx.Error(w, r, h.log, apperr.ErrInvalidInput)
		return
	}

	issue, err := h.service.CreateIssue(r.Context(), req)
	if err != nil {
		httpx.Error(w, r, h.log, err)
		return
	}

	httpx.JSON(w, http.StatusCreated, issue)
}

func (h *Handler) UpdateIssue(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if id == "" {
		httpx.Error(w, r, h.log, apperr.ErrInvalidInput)
		return
	}

	var req UpdateIssueRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httpx.Error(w, r, h.log, apperr.ErrInvalidInput)
		return
	}

	issue, err := h.service.UpdateIssue(r.Context(), id, req)
	if err != nil {
		httpx.Error(w, r, h.log, err)
		return
	}

	httpx.JSON(w, http.StatusOK, issue)
}

func (h *Handler) DeleteIssue(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if id == "" {
		httpx.Error(w, r, h.log, apperr.ErrInvalidInput)
		return
	}

	if err := h.service.DeleteIssue(r.Context(), id); err != nil {
		httpx.Error(w, r, h.log, err)
		return
	}

	httpx.JSON(w, http.StatusOK, map[string]any{"message": "deleted"})
}

func (h *Handler) SubmitIssueForApproval(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if id == "" {
		httpx.Error(w, r, h.log, apperr.ErrInvalidInput)
		return
	}

	issue, err := h.service.SubmitIssueForApproval(r.Context(), id)
	if err != nil {
		httpx.Error(w, r, h.log, err)
		return
	}

	httpx.JSON(w, http.StatusOK, issue)
}

func (h *Handler) ApproveIssue(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if id == "" {
		httpx.Error(w, r, h.log, apperr.ErrInvalidInput)
		return
	}

	var req ApproveIssueRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httpx.Error(w, r, h.log, apperr.ErrInvalidInput)
		return
	}

	issue, err := h.service.ApproveIssue(r.Context(), id, req)
	if err != nil {
		httpx.Error(w, r, h.log, err)
		return
	}

	httpx.JSON(w, http.StatusOK, issue)
}

// ------------------------------------------------------------------------------------------------
// M12 - TANK STOCKS, RECONCILIATION & ALERTS
// ------------------------------------------------------------------------------------------------

func (h *Handler) ListTankStocks(w http.ResponseWriter, r *http.Request) {
	branchID := r.URL.Query().Get("branch_id")
	stocks, err := h.service.ListTankStocks(r.Context(), branchID)
	if err != nil {
		httpx.Error(w, r, h.log, err)
		return
	}
	httpx.JSON(w, http.StatusOK, stocks)
}

func (h *Handler) ListTankStockLedger(w http.ResponseWriter, r *http.Request) {
	tankID := chi.URLParam(r, "id")
	if tankID == "" {
		httpx.Error(w, r, h.log, apperr.ErrInvalidInput)
		return
	}
	page, _ := strconv.Atoi(r.URL.Query().Get("page"))
	pageSize, _ := strconv.Atoi(r.URL.Query().Get("page_size"))

	items, total, err := h.service.ListTankStockLedger(r.Context(), tankID, page, pageSize)
	if err != nil {
		httpx.Error(w, r, h.log, err)
		return
	}

	totalPages := 0
	if pageSize > 0 {
		totalPages = (total + pageSize - 1) / pageSize
	}

	httpx.JSON(w, http.StatusOK, map[string]any{
		"items":       items,
		"total":       total,
		"page":        page,
		"page_size":   pageSize,
		"total_pages": totalPages,
	})
}
