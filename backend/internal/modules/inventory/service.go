package inventory

import (
	"context"
	"errors"
	"fmt"
	"math"
	"strings"
	"time"

	"fuel-station-backend/internal/shared/apperr"
	"fuel-station-backend/internal/shared/audit"
	"fuel-station-backend/internal/shared/authz"
	"fuel-station-backend/internal/shared/middleware"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
)

type Service struct {
	pool *pgxpool.Pool
}

func NewService(pool *pgxpool.Pool) *Service {
	return &Service{pool: pool}
}

func getTenant(ctx context.Context) (string, error) {
	tenantID, ok := middleware.TenantIDFromContext(ctx)
	if !ok || tenantID == "" {
		if p, ok := authz.FromContext(ctx); ok && p.TenantID != "" {
			return p.TenantID, nil
		}
		return "", apperr.ErrUnauthorized
	}
	return tenantID, nil
}

// ------------------------------------------------------------------------------------------------
// SUPPLIER OPERATIONS
// ------------------------------------------------------------------------------------------------

func (s *Service) ListSuppliers(ctx context.Context) ([]Supplier, error) {
	tenantID, err := getTenant(ctx)
	if err != nil {
		return nil, err
	}

	rows, err := s.pool.Query(ctx, `
		SELECT id, tenant_id, code, name, phone, address, active, created_at, updated_at
		FROM station.supplier
		WHERE tenant_id = $1
		ORDER BY code ASC
	`, tenantID)
	if err != nil {
		return nil, fmt.Errorf("query suppliers: %w", err)
	}
	defer rows.Close()

	list := make([]Supplier, 0)
	for rows.Next() {
		var sup Supplier
		if err := rows.Scan(
			&sup.ID, &sup.TenantID, &sup.Code, &sup.Name,
			&sup.Phone, &sup.Address, &sup.Active, &sup.CreatedAt, &sup.UpdatedAt,
		); err != nil {
			return nil, fmt.Errorf("scan supplier: %w", err)
		}
		list = append(list, sup)
	}

	return list, nil
}

func (s *Service) CreateSupplier(ctx context.Context, req CreateSupplierRequest) (*Supplier, error) {
	tenantID, err := getTenant(ctx)
	if err != nil {
		return nil, err
	}

	if strings.TrimSpace(req.Code) == "" || strings.TrimSpace(req.Name) == "" {
		return nil, fmt.Errorf("%w: code and name are required", apperr.ErrInvalidInput)
	}

	var sup Supplier
	err = s.pool.QueryRow(ctx, `
		INSERT INTO station.supplier (tenant_id, code, name, phone, address, active)
		VALUES ($1, $2, $3, $4, $5, true)
		RETURNING id, tenant_id, code, name, phone, address, active, created_at, updated_at
	`, tenantID, req.Code, req.Name, req.Phone, req.Address).Scan(
		&sup.ID, &sup.TenantID, &sup.Code, &sup.Name,
		&sup.Phone, &sup.Address, &sup.Active, &sup.CreatedAt, &sup.UpdatedAt,
	)
	if err != nil {
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && pgErr.Code == "23505" {
			return nil, fmt.Errorf("%w: mã nhà cung cấp '%s' đã tồn tại, hãy dùng mã khác", apperr.ErrConflict, req.Code)
		}
		return nil, fmt.Errorf("create supplier: %w", err)
	}

	return &sup, nil
}

// ------------------------------------------------------------------------------------------------
// CAPACITY PRE-CHECK
// ------------------------------------------------------------------------------------------------

func (s *Service) CheckCapacity(ctx context.Context, req CapacityCheckRequest) (*CapacityCheckResult, error) {
	tenantID, err := getTenant(ctx)
	if err != nil {
		return nil, err
	}

	if err := authz.EnsureRecordInScope(ctx, s.pool, "station.tank", req.TankID); err != nil {
		return nil, err
	}

	query := `
		SELECT t.id, t.name, t.max_usable_capacity_ml,
		       COALESCE((
		           SELECT balance_after_ml 
		           FROM station.stock_ledger sl 
		           WHERE sl.tank_id = t.id 
		           ORDER BY sl.seq DESC LIMIT 1
		       ), 0) AS current_stock_ml
		FROM station.tank t
		WHERE t.tenant_id = $1 AND t.id = $2
	`
	var res CapacityCheckResult
	err = s.pool.QueryRow(ctx, query, tenantID, req.TankID).Scan(
		&res.TankID, &res.TankName, &res.MaxUsableCapacityML, &res.CurrentStockML,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, apperr.ErrNotFound
		}
		return nil, fmt.Errorf("get tank capacity: %w", err)
	}

	res.IncomingVolumeML = req.IncomingVolume
	res.AvailableRoomML = res.MaxUsableCapacityML - res.CurrentStockML
	if res.AvailableRoomML < 0 {
		res.AvailableRoomML = 0
	}
	res.ExceedsCapacity = (res.CurrentStockML + res.IncomingVolumeML) > res.MaxUsableCapacityML

	return &res, nil
}

// ------------------------------------------------------------------------------------------------
// STOCK RECEIPT OPERATIONS
// ------------------------------------------------------------------------------------------------

func (s *Service) ListReceipts(ctx context.Context, q ReceiptListQuery) ([]StockReceipt, int, error) {
	tenantID, err := getTenant(ctx)
	if err != nil {
		return nil, 0, err
	}

	if q.Page <= 0 {
		q.Page = 1
	}
	if q.PageSize <= 0 || q.PageSize > 100 {
		q.PageSize = 20
	}
	offset := (q.Page - 1) * q.PageSize

	where := []string{"r.tenant_id = $1"}
	args := []any{tenantID}
	argIdx := 2
	authz.AddBranchScope(ctx, "r.branch_id", &where, &args, &argIdx)

	if q.BranchID != "" {
		where = append(where, fmt.Sprintf("r.branch_id = $%d", argIdx))
		args = append(args, q.BranchID)
		argIdx++
	}

	if q.Status != "" {
		where = append(where, fmt.Sprintf("r.status = $%d", argIdx))
		args = append(args, q.Status)
		argIdx++
	}

	if q.Search != "" {
		where = append(where, fmt.Sprintf("(r.code ILIKE $%d OR r.tanker_plate ILIKE $%d OR r.document_no ILIKE $%d)", argIdx, argIdx, argIdx))
		args = append(args, "%"+q.Search+"%")
		argIdx++
	}

	whereClause := strings.Join(where, " AND ")

	countQuery := fmt.Sprintf("SELECT COUNT(*) FROM station.stock_receipt r WHERE %s", whereClause)
	var total int
	if err := s.pool.QueryRow(ctx, countQuery, args...).Scan(&total); err != nil {
		return nil, 0, fmt.Errorf("count receipts: %w", err)
	}

	query := fmt.Sprintf(`
		SELECT r.id, r.tenant_id, r.branch_id, b.name AS branch_name,
		       r.code, r.received_at, r.supplier_id, sup.name AS supplier_name,
		       r.tanker_plate, r.document_no, r.status, r.note,
		       r.created_by, cu.full_name AS created_by_name,
		       r.decided_by, du.full_name AS decided_by_name,
		       r.decided_at, r.reject_reason,
		       COALESCE((
		           SELECT SUM(actual_volume_ml) 
		           FROM station.stock_receipt_line l 
		           WHERE l.receipt_id = r.id
		       ), 0) AS total_volume_ml,
		       r.created_at, r.updated_at
		FROM station.stock_receipt r
		JOIN station.branch b ON b.id = r.branch_id AND b.tenant_id = r.tenant_id
		LEFT JOIN station.supplier sup ON sup.id = r.supplier_id AND sup.tenant_id = r.tenant_id
		JOIN station.app_user cu ON cu.id = r.created_by AND cu.tenant_id = r.tenant_id
		LEFT JOIN station.app_user du ON du.id = r.decided_by AND du.tenant_id = r.tenant_id
		WHERE %s
		ORDER BY r.received_at DESC, r.created_at DESC
		LIMIT $%d OFFSET $%d
	`, whereClause, argIdx, argIdx+1)
	args = append(args, q.PageSize, offset)

	rows, err := s.pool.Query(ctx, query, args...)
	if err != nil {
		return nil, 0, fmt.Errorf("query receipts: %w", err)
	}
	defer rows.Close()

	receipts := make([]StockReceipt, 0)
	for rows.Next() {
		var rc StockReceipt
		if err := rows.Scan(
			&rc.ID, &rc.TenantID, &rc.BranchID, &rc.BranchName,
			&rc.Code, &rc.ReceivedAt, &rc.SupplierID, &rc.SupplierName,
			&rc.TankerPlate, &rc.DocumentNo, &rc.Status, &rc.Note,
			&rc.CreatedBy, &rc.CreatedByName,
			&rc.DecidedBy, &rc.DecidedByName,
			&rc.DecidedAt, &rc.RejectReason,
			&rc.TotalVolumeML, &rc.CreatedAt, &rc.UpdatedAt,
		); err != nil {
			return nil, 0, fmt.Errorf("scan receipt: %w", err)
		}
		receipts = append(receipts, rc)
	}

	return receipts, total, nil
}

func (s *Service) GetReceipt(ctx context.Context, id string) (*StockReceipt, error) {
	tenantID, err := getTenant(ctx)
	if err != nil {
		return nil, err
	}

	if err := authz.EnsureRecordInScope(ctx, s.pool, "station.stock_receipt", id); err != nil {
		return nil, err
	}

	query := `
		SELECT r.id, r.tenant_id, r.branch_id, b.name AS branch_name,
		       r.code, r.received_at, r.supplier_id, sup.name AS supplier_name,
		       r.tanker_plate, r.document_no, r.status, r.note,
		       r.created_by, cu.full_name AS created_by_name,
		       r.decided_by, du.full_name AS decided_by_name,
		       r.decided_at, r.reject_reason,
		       COALESCE((
		           SELECT SUM(actual_volume_ml) 
		           FROM station.stock_receipt_line l 
		           WHERE l.receipt_id = r.id
		       ), 0) AS total_volume_ml,
		       r.created_at, r.updated_at
		FROM station.stock_receipt r
		JOIN station.branch b ON b.id = r.branch_id AND b.tenant_id = r.tenant_id
		LEFT JOIN station.supplier sup ON sup.id = r.supplier_id AND sup.tenant_id = r.tenant_id
		JOIN station.app_user cu ON cu.id = r.created_by AND cu.tenant_id = r.tenant_id
		LEFT JOIN station.app_user du ON du.id = r.decided_by AND du.tenant_id = r.tenant_id
		WHERE r.tenant_id = $1 AND r.id = $2
	`
	var rc StockReceipt
	err = s.pool.QueryRow(ctx, query, tenantID, id).Scan(
		&rc.ID, &rc.TenantID, &rc.BranchID, &rc.BranchName,
		&rc.Code, &rc.ReceivedAt, &rc.SupplierID, &rc.SupplierName,
		&rc.TankerPlate, &rc.DocumentNo, &rc.Status, &rc.Note,
		&rc.CreatedBy, &rc.CreatedByName,
		&rc.DecidedBy, &rc.DecidedByName,
		&rc.DecidedAt, &rc.RejectReason,
		&rc.TotalVolumeML, &rc.CreatedAt, &rc.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, apperr.ErrNotFound
		}
		return nil, fmt.Errorf("get receipt: %w", err)
	}

	// Fetch lines (luôn trả mảng, không bao giờ null)
	rc.Lines = make([]StockReceiptLine, 0)
	lineRows, err := s.pool.Query(ctx, `
		SELECT l.id, l.tenant_id, l.receipt_id, l.tank_id, t.code AS tank_code, t.name AS tank_name,
		       l.fuel_type_id, ft.name AS fuel_type_name,
		       l.level_before_ml, l.document_volume_ml, l.actual_volume_ml, l.level_after_ml, l.variance_ml
		FROM station.stock_receipt_line l
		JOIN station.tank t ON t.id = l.tank_id AND t.tenant_id = l.tenant_id
		JOIN station.fuel_type ft ON ft.id = l.fuel_type_id AND ft.tenant_id = l.tenant_id
		WHERE l.tenant_id = $1 AND l.receipt_id = $2
		ORDER BY t.code ASC
	`, tenantID, id)
	if err != nil {
		return nil, fmt.Errorf("query receipt lines: %w", err)
	}
	defer lineRows.Close()

	for lineRows.Next() {
		var ln StockReceiptLine
		if err := lineRows.Scan(
			&ln.ID, &ln.TenantID, &ln.ReceiptID, &ln.TankID, &ln.TankCode, &ln.TankName,
			&ln.FuelTypeID, &ln.FuelTypeName,
			&ln.LevelBeforeML, &ln.DocumentVolumeML, &ln.ActualVolumeML, &ln.LevelAfterML, &ln.VarianceML,
		); err != nil {
			return nil, fmt.Errorf("scan line: %w", err)
		}
		rc.Lines = append(rc.Lines, ln)
	}

	return &rc, nil
}

func (s *Service) CreateReceipt(ctx context.Context, req CreateReceiptRequest) (*StockReceipt, error) {
	tenantID, err := getTenant(ctx)
	if err != nil {
		return nil, err
	}

	if err := authz.EnsureBranch(ctx, req.BranchID); err != nil {
		return nil, err
	}
	principal, ok := authz.FromContext(ctx)
	if !ok || principal.UserID == "" {
		return nil, apperr.ErrUnauthorized
	}

	if req.BranchID == "" {
		return nil, fmt.Errorf("%w: branch_id is required", apperr.ErrInvalidInput)
	}
	if len(req.Lines) == 0 {
		return nil, fmt.Errorf("%w: at least one receipt line is required", apperr.ErrInvalidInput)
	}
	if req.ReceivedAt.IsZero() {
		req.ReceivedAt = time.Now().UTC()
	}

	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return nil, fmt.Errorf("begin tx: %w", err)
	}
	defer tx.Rollback(ctx)

	// Generate code
	var code string
	if err := tx.QueryRow(ctx, "SELECT station.next_code($1, 'PN')", tenantID).Scan(&code); err != nil {
		return nil, fmt.Errorf("generate receipt code: %w", err)
	}

	var receiptID string
	insertReceiptQuery := `
		INSERT INTO station.stock_receipt (
			tenant_id, branch_id, code, received_at, supplier_id,
			tanker_plate, document_no, status, note, created_by
		) VALUES ($1, $2, $3, $4, $5, $6, $7, 'draft', $8, $9)
		RETURNING id
	`
	err = tx.QueryRow(
		ctx, insertReceiptQuery,
		tenantID, req.BranchID, code, req.ReceivedAt, req.SupplierID,
		req.TankerPlate, req.DocumentNo, req.Note, principal.UserID,
	).Scan(&receiptID)
	if err != nil {
		return nil, fmt.Errorf("insert stock receipt: %w", err)
	}

	// Insert Lines
	for _, ln := range req.Lines {
		if ln.TankID == "" || ln.FuelTypeID == "" || ln.DocumentVolumeML <= 0 || ln.ActualVolumeML <= 0 {
			return nil, fmt.Errorf("%w: invalid line inputs", apperr.ErrInvalidInput)
		}

		_, err := tx.Exec(ctx, `
			INSERT INTO station.stock_receipt_line (
				tenant_id, receipt_id, tank_id, fuel_type_id,
				level_before_ml, document_volume_ml, actual_volume_ml, level_after_ml
			) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
		`, tenantID, receiptID, ln.TankID, ln.FuelTypeID, ln.LevelBeforeML, ln.DocumentVolumeML, ln.ActualVolumeML, ln.LevelAfterML)
		if err != nil {
			var pgErr *pgconn.PgError
			if errors.As(err, &pgErr) && pgErr.Code == "23514" {
				return nil, fmt.Errorf("%w: %s", apperr.ErrInvalidInput, pgErr.Message)
			}
			return nil, fmt.Errorf("insert receipt line: %w", err)
		}
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("commit receipt: %w", err)
	}

	parsedID, _ := uuid.Parse(receiptID)
	_ = audit.Record(ctx, s.pool, audit.Entry{
		Action:     audit.ActionCreate,
		EntityType: "stock_receipt",
		EntityID:   &parsedID,
		EntityCode: code,
		NewData: map[string]any{
			"code": code, "lines_count": len(req.Lines), "status": "draft",
		},
	})

	return s.GetReceipt(ctx, receiptID)
}

func (s *Service) UpdateReceipt(ctx context.Context, id string, req UpdateReceiptRequest) (*StockReceipt, error) {
	tenantID, err := getTenant(ctx)
	if err != nil {
		return nil, err
	}

	if err := authz.EnsureRecordInScope(ctx, s.pool, "station.stock_receipt", id); err != nil {
		return nil, err
	}

	// Check status
	var currentStatus, currentCode string
	err = s.pool.QueryRow(ctx, "SELECT status, code FROM station.stock_receipt WHERE tenant_id = $1 AND id = $2", tenantID, id).Scan(&currentStatus, &currentCode)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, apperr.ErrNotFound
		}
		return nil, fmt.Errorf("check receipt status: %w", err)
	}
	if currentStatus != "draft" && currentStatus != "pending" {
		return nil, fmt.Errorf("%w: receipt in status '%s' cannot be modified", apperr.ErrForbidden, currentStatus)
	}

	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return nil, fmt.Errorf("begin tx: %w", err)
	}
	defer tx.Rollback(ctx)

	// Update Header
	_, err = tx.Exec(ctx, `
		UPDATE station.stock_receipt
		SET branch_id = $3, received_at = $4, supplier_id = $5,
		    tanker_plate = $6, document_no = $7, note = $8, updated_at = now()
		WHERE tenant_id = $1 AND id = $2
	`, tenantID, id, req.BranchID, req.ReceivedAt, req.SupplierID, req.TankerPlate, req.DocumentNo, req.Note)
	if err != nil {
		return nil, fmt.Errorf("update receipt header: %w", err)
	}

	// Delete and re-insert lines
	_, err = tx.Exec(ctx, "DELETE FROM station.stock_receipt_line WHERE tenant_id = $1 AND receipt_id = $2", tenantID, id)
	if err != nil {
		return nil, fmt.Errorf("delete old lines: %w", err)
	}

	for _, ln := range req.Lines {
		_, err := tx.Exec(ctx, `
			INSERT INTO station.stock_receipt_line (
				tenant_id, receipt_id, tank_id, fuel_type_id,
				level_before_ml, document_volume_ml, actual_volume_ml, level_after_ml
			) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
		`, tenantID, id, ln.TankID, ln.FuelTypeID, ln.LevelBeforeML, ln.DocumentVolumeML, ln.ActualVolumeML, ln.LevelAfterML)
		if err != nil {
			return nil, fmt.Errorf("insert line: %w", err)
		}
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("commit update: %w", err)
	}

	parsedID, _ := uuid.Parse(id)
	_ = audit.Record(ctx, s.pool, audit.Entry{
		Action:     audit.ActionUpdate,
		EntityType: "stock_receipt",
		EntityID:   &parsedID,
		EntityCode: currentCode,
		NewData:    map[string]any{"updated": true},
	})

	return s.GetReceipt(ctx, id)
}

func (s *Service) SubmitForApproval(ctx context.Context, id string) (*StockReceipt, error) {
	tenantID, err := getTenant(ctx)
	if err != nil {
		return nil, err
	}

	if err := authz.EnsureRecordInScope(ctx, s.pool, "station.stock_receipt", id); err != nil {
		return nil, err
	}

	var code string
	err = s.pool.QueryRow(ctx, `
		UPDATE station.stock_receipt
		SET status = 'pending', updated_at = now()
		WHERE tenant_id = $1 AND id = $2 AND status = 'draft'
		RETURNING code
	`, tenantID, id).Scan(&code)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, fmt.Errorf("%w: receipt not found or not in draft status", apperr.ErrInvalidInput)
		}
		return nil, fmt.Errorf("submit receipt: %w", err)
	}

	parsedID, _ := uuid.Parse(id)
	_ = audit.Record(ctx, s.pool, audit.Entry{
		Action:     audit.ActionUpdate,
		EntityType: "stock_receipt",
		EntityID:   &parsedID,
		EntityCode: code,
		NewData:    map[string]any{"status": "pending"},
	})

	return s.GetReceipt(ctx, id)
}

func (s *Service) ApproveReceipt(ctx context.Context, id string, req ApproveReceiptRequest) (*StockReceipt, error) {
	tenantID, err := getTenant(ctx)
	if err != nil {
		return nil, err
	}
	principal, ok := authz.FromContext(ctx)
	if !ok || principal.UserID == "" {
		return nil, apperr.ErrUnauthorized
	}

	// Fetch existing receipt and lines
	rc, err := s.GetReceipt(ctx, id)
	if err != nil {
		return nil, err
	}

	if rc.Status != "pending" && rc.Status != "draft" {
		return nil, fmt.Errorf("%w: receipt is already %s", apperr.ErrForbidden, rc.Status)
	}

	if !req.Approved && (req.RejectReason == nil || strings.TrimSpace(*req.RejectReason) == "") {
		return nil, fmt.Errorf("%w: reject_reason is required when rejecting", apperr.ErrInvalidInput)
	}

	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return nil, fmt.Errorf("begin tx: %w", err)
	}
	defer tx.Rollback(ctx)

	now := time.Now().UTC()

	if !req.Approved {
		// Rejection flow
		_, err := tx.Exec(ctx, `
			UPDATE station.stock_receipt
			SET status = 'rejected', decided_by = $3, decided_at = $4, reject_reason = $5, updated_at = now()
			WHERE tenant_id = $1 AND id = $2
		`, tenantID, id, principal.UserID, now, req.RejectReason)
		if err != nil {
			return nil, fmt.Errorf("reject receipt: %w", err)
		}

		if err := tx.Commit(ctx); err != nil {
			return nil, fmt.Errorf("commit reject: %w", err)
		}

		parsedID, _ := uuid.Parse(id)
		_ = audit.Record(ctx, s.pool, audit.Entry{
			Action:     audit.ActionReject,
			EntityType: "stock_receipt",
			EntityID:   &parsedID,
			EntityCode: rc.Code,
			NewData:    map[string]any{"status": "rejected", "reason": req.RejectReason},
		})

		return s.GetReceipt(ctx, id)
	}

	// Approval flow:
	// 1. Update status to 'approved' (triggers guard_document which checks self-approval rules)
	_, err = tx.Exec(ctx, `
		UPDATE station.stock_receipt
		SET status = 'approved', decided_by = $3, decided_at = $4, updated_at = now()
		WHERE tenant_id = $1 AND id = $2
	`, tenantID, id, principal.UserID, now)
	if err != nil {
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && pgErr.Code == "23514" {
			return nil, fmt.Errorf("%w: %s", apperr.ErrForbidden, pgErr.Message)
		}
		return nil, fmt.Errorf("approve receipt: %w", err)
	}

	// 2. Insert entries into station.stock_ledger for each line
	// Note: trg_stock_ledger_before_insert checks max capacity and calculates balance
	for _, ln := range rc.Lines {
		_, err := tx.Exec(ctx, `
			INSERT INTO station.stock_ledger (
				tenant_id, tank_id, occurred_at, kind, delta_ml,
				ref_type, ref_id, note, created_by
			) VALUES ($1, $2, $3, 'receipt', $4, 'stock_receipt', $5, $6, $7)
		`, tenantID, ln.TankID, rc.ReceivedAt, ln.ActualVolumeML, id, fmt.Sprintf("Nhập xăng dầu theo phiếu %s", rc.Code), principal.UserID)
		if err != nil {
			var pgErr *pgconn.PgError
			if errors.As(err, &pgErr) && pgErr.Code == "23514" {
				return nil, fmt.Errorf("%w: %s", apperr.ErrConflict, pgErr.Message)
			}
			return nil, fmt.Errorf("write stock ledger: %w", err)
		}
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("commit approval: %w", err)
	}

	parsedID, _ := uuid.Parse(id)
	_ = audit.Record(ctx, s.pool, audit.Entry{
		Action:     audit.ActionApprove,
		EntityType: "stock_receipt",
		EntityID:   &parsedID,
		EntityCode: rc.Code,
		NewData: map[string]any{
			"status": "approved", "decided_by": principal.UserID, "volume_ml": rc.TotalVolumeML,
		},
	})

	return s.GetReceipt(ctx, id)
}

func (s *Service) DeleteReceipt(ctx context.Context, id string) error {
	tenantID, err := getTenant(ctx)
	if err != nil {
		return err
	}

	if err := authz.EnsureRecordInScope(ctx, s.pool, "station.stock_receipt", id); err != nil {
		return err
	}

	var code, status string
	err = s.pool.QueryRow(ctx, "SELECT code, status FROM station.stock_receipt WHERE tenant_id = $1 AND id = $2", tenantID, id).Scan(&code, &status)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return apperr.ErrNotFound
		}
		return fmt.Errorf("find receipt: %w", err)
	}

	if status != "draft" && status != "pending" {
		return fmt.Errorf("%w: cannot delete receipt in status '%s'", apperr.ErrForbidden, status)
	}

	_, err = s.pool.Exec(ctx, "DELETE FROM station.stock_receipt WHERE tenant_id = $1 AND id = $2", tenantID, id)
	if err != nil {
		return fmt.Errorf("delete receipt: %w", err)
	}

	parsedID, _ := uuid.Parse(id)
	_ = audit.Record(ctx, s.pool, audit.Entry{
		Action:     audit.ActionDelete,
		EntityType: "stock_receipt",
		EntityID:   &parsedID,
		EntityCode: code,
		NewData:    map[string]any{"deleted": true},
	})

	return nil
}

// ------------------------------------------------------------------------------------------------
// STOCK ISSUE OPERATIONS (M11 - PHIẾU XUẤT ĐIỀU CHỈNH)
// ------------------------------------------------------------------------------------------------

func kindDisplayName(k string) string {
	switch k {
	case "transfer":
		return "Điều chuyển giữa các bể"
	case "loss":
		return "Xuất hao hụt định mức/đột xuất"
	case "inspection":
		return "Xuất kiểm định cột bơm"
	default:
		return k
	}
}

func (s *Service) ListIssues(ctx context.Context, q IssueListQuery) ([]StockIssue, int, error) {
	tenantID, err := getTenant(ctx)
	if err != nil {
		return nil, 0, err
	}

	if q.Page <= 0 {
		q.Page = 1
	}
	if q.PageSize <= 0 || q.PageSize > 100 {
		q.PageSize = 20
	}
	offset := (q.Page - 1) * q.PageSize

	where := []string{"i.tenant_id = $1"}
	args := []any{tenantID}
	argIdx := 2
	authz.AddBranchScope(ctx, "i.branch_id", &where, &args, &argIdx)

	if q.BranchID != "" {
		where = append(where, fmt.Sprintf("i.branch_id = $%d", argIdx))
		args = append(args, q.BranchID)
		argIdx++
	}

	if q.Status != "" {
		where = append(where, fmt.Sprintf("i.status = $%d", argIdx))
		args = append(args, q.Status)
		argIdx++
	}

	if q.Kind != "" {
		where = append(where, fmt.Sprintf("i.kind = $%d", argIdx))
		args = append(args, q.Kind)
		argIdx++
	}

	if q.Search != "" {
		searchPattern := "%" + strings.TrimSpace(q.Search) + "%"
		where = append(where, fmt.Sprintf("(i.code ILIKE $%d OR i.reason ILIKE $%d OR tk.name ILIKE $%d)", argIdx, argIdx, argIdx))
		args = append(args, searchPattern)
		argIdx++
	}

	whereClause := strings.Join(where, " AND ")

	countQuery := fmt.Sprintf(`
		SELECT COUNT(*)
		FROM station.stock_issue i
		JOIN station.tank tk ON tk.id = i.tank_id AND tk.tenant_id = i.tenant_id
		WHERE %s
	`, whereClause)

	var total int
	if err := s.pool.QueryRow(ctx, countQuery, args...).Scan(&total); err != nil {
		return nil, 0, fmt.Errorf("count issues: %w", err)
	}

	selectQuery := fmt.Sprintf(`
		SELECT i.id, i.tenant_id, i.branch_id, b.name AS branch_name,
		       i.code, i.kind, i.tank_id, tk.code AS tank_code, tk.name AS tank_name,
		       tk.fuel_type_id, ft.name AS fuel_type_name,
		       i.to_tank_id, totk.code AS to_tank_code, totk.name AS to_tank_name,
		       i.volume_ml, i.reason, i.status,
		       i.created_by, cu.full_name AS created_by_name,
		       i.decided_by, du.full_name AS decided_by_name,
		       i.decided_at, i.reject_reason,
		       i.created_at, i.updated_at
		FROM station.stock_issue i
		JOIN station.branch b ON b.id = i.branch_id AND b.tenant_id = i.tenant_id
		JOIN station.tank tk ON tk.id = i.tank_id AND tk.tenant_id = i.tenant_id
		JOIN station.fuel_type ft ON ft.id = tk.fuel_type_id AND ft.tenant_id = i.tenant_id
		LEFT JOIN station.tank totk ON totk.id = i.to_tank_id AND totk.tenant_id = i.tenant_id
		JOIN station.app_user cu ON cu.id = i.created_by AND cu.tenant_id = i.tenant_id
		LEFT JOIN station.app_user du ON du.id = i.decided_by AND du.tenant_id = i.tenant_id
		WHERE %s
		ORDER BY i.created_at DESC
		LIMIT $%d OFFSET $%d
	`, whereClause, argIdx, argIdx+1)

	args = append(args, q.PageSize, offset)

	rows, err := s.pool.Query(ctx, selectQuery, args...)
	if err != nil {
		return nil, 0, fmt.Errorf("query issues: %w", err)
	}
	defer rows.Close()

	issues := make([]StockIssue, 0)
	for rows.Next() {
		var is StockIssue
		if err := rows.Scan(
			&is.ID, &is.TenantID, &is.BranchID, &is.BranchName,
			&is.Code, &is.Kind, &is.TankID, &is.TankCode, &is.TankName,
			&is.FuelTypeID, &is.FuelTypeName,
			&is.ToTankID, &is.ToTankCode, &is.ToTankName,
			&is.VolumeML, &is.Reason, &is.Status,
			&is.CreatedBy, &is.CreatedByName,
			&is.DecidedBy, &is.DecidedByName,
			&is.DecidedAt, &is.RejectReason,
			&is.CreatedAt, &is.UpdatedAt,
		); err != nil {
			return nil, 0, fmt.Errorf("scan issue: %w", err)
		}
		is.KindName = kindDisplayName(is.Kind)
		is.VolumeLiters = float64(is.VolumeML) / 1000.0
		issues = append(issues, is)
	}

	return issues, total, nil
}

func (s *Service) GetIssue(ctx context.Context, id string) (*StockIssue, error) {
	tenantID, err := getTenant(ctx)
	if err != nil {
		return nil, err
	}

	if err := authz.EnsureRecordInScope(ctx, s.pool, "station.stock_issue", id); err != nil {
		return nil, err
	}

	query := `
		SELECT i.id, i.tenant_id, i.branch_id, b.name AS branch_name,
		       i.code, i.kind, i.tank_id, tk.code AS tank_code, tk.name AS tank_name,
		       tk.fuel_type_id, ft.name AS fuel_type_name,
		       i.to_tank_id, totk.code AS to_tank_code, totk.name AS to_tank_name,
		       i.volume_ml, i.reason, i.status,
		       i.created_by, cu.full_name AS created_by_name,
		       i.decided_by, du.full_name AS decided_by_name,
		       i.decided_at, i.reject_reason,
		       i.created_at, i.updated_at
		FROM station.stock_issue i
		JOIN station.branch b ON b.id = i.branch_id AND b.tenant_id = i.tenant_id
		JOIN station.tank tk ON tk.id = i.tank_id AND tk.tenant_id = i.tenant_id
		JOIN station.fuel_type ft ON ft.id = tk.fuel_type_id AND ft.tenant_id = i.tenant_id
		LEFT JOIN station.tank totk ON totk.id = i.to_tank_id AND totk.tenant_id = i.tenant_id
		JOIN station.app_user cu ON cu.id = i.created_by AND cu.tenant_id = i.tenant_id
		LEFT JOIN station.app_user du ON du.id = i.decided_by AND du.tenant_id = i.tenant_id
		WHERE i.tenant_id = $1 AND i.id = $2
	`
	var is StockIssue
	err = s.pool.QueryRow(ctx, query, tenantID, id).Scan(
		&is.ID, &is.TenantID, &is.BranchID, &is.BranchName,
		&is.Code, &is.Kind, &is.TankID, &is.TankCode, &is.TankName,
		&is.FuelTypeID, &is.FuelTypeName,
		&is.ToTankID, &is.ToTankCode, &is.ToTankName,
		&is.VolumeML, &is.Reason, &is.Status,
		&is.CreatedBy, &is.CreatedByName,
		&is.DecidedBy, &is.DecidedByName,
		&is.DecidedAt, &is.RejectReason,
		&is.CreatedAt, &is.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, apperr.ErrNotFound
		}
		return nil, fmt.Errorf("get issue: %w", err)
	}

	is.KindName = kindDisplayName(is.Kind)
	is.VolumeLiters = float64(is.VolumeML) / 1000.0

	return &is, nil
}

func (s *Service) CreateIssue(ctx context.Context, req CreateIssueRequest) (*StockIssue, error) {
	tenantID, err := getTenant(ctx)
	if err != nil {
		return nil, err
	}

	if err := authz.EnsureBranch(ctx, req.BranchID); err != nil {
		return nil, err
	}
	principal, ok := authz.FromContext(ctx)
	if !ok || principal.UserID == "" {
		return nil, apperr.ErrUnauthorized
	}

	if req.BranchID == "" {
		return nil, fmt.Errorf("%w: branch_id is required", apperr.ErrInvalidInput)
	}
	if req.TankID == "" {
		return nil, fmt.Errorf("%w: tank_id is required", apperr.ErrInvalidInput)
	}
	if req.Kind != "transfer" && req.Kind != "loss" && req.Kind != "inspection" {
		return nil, fmt.Errorf("%w: kind must be 'transfer', 'loss', or 'inspection'", apperr.ErrInvalidInput)
	}

	var volumeML int64
	if req.VolumeLiters != nil && *req.VolumeLiters > 0 {
		volumeML = int64(*req.VolumeLiters * 1000.0)
	} else if req.VolumeML != nil && *req.VolumeML > 0 {
		volumeML = *req.VolumeML
	} else {
		return nil, fmt.Errorf("%w: volume must be positive", apperr.ErrInvalidInput)
	}

	req.Reason = strings.TrimSpace(req.Reason)
	if req.Reason == "" {
		return nil, fmt.Errorf("%w: reason is required", apperr.ErrInvalidInput)
	}

	if req.Kind == "transfer" {
		if req.ToTankID == nil || *req.ToTankID == "" {
			return nil, fmt.Errorf("%w: to_tank_id is required for transfer", apperr.ErrInvalidInput)
		}
		if *req.ToTankID == req.TankID {
			return nil, fmt.Errorf("%w: to_tank_id cannot be the same as source tank_id", apperr.ErrInvalidInput)
		}

		// Check fuel types match between tanks
		var srcFuel, dstFuel string
		err := s.pool.QueryRow(ctx, "SELECT fuel_type_id FROM station.tank WHERE tenant_id = $1 AND id = $2", tenantID, req.TankID).Scan(&srcFuel)
		if err != nil {
			return nil, fmt.Errorf("find source tank: %w", err)
		}
		err = s.pool.QueryRow(ctx, "SELECT fuel_type_id FROM station.tank WHERE tenant_id = $1 AND id = $2", tenantID, *req.ToTankID).Scan(&dstFuel)
		if err != nil {
			return nil, fmt.Errorf("find destination tank: %w", err)
		}
		if srcFuel != dstFuel {
			return nil, fmt.Errorf("%w: hai bể điều chuyển phải cùng loại nhiên liệu", apperr.ErrInvalidInput)
		}
	} else {
		req.ToTankID = nil
	}

	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return nil, fmt.Errorf("begin tx: %w", err)
	}
	defer tx.Rollback(ctx)

	var code string
	if err := tx.QueryRow(ctx, "SELECT station.next_code($1, 'PX')", tenantID).Scan(&code); err != nil {
		return nil, fmt.Errorf("generate issue code: %w", err)
	}

	var issueID string
	insertQuery := `
		INSERT INTO station.stock_issue (
			tenant_id, branch_id, code, kind, tank_id, to_tank_id,
			volume_ml, reason, status, created_by
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'draft', $9)
		RETURNING id
	`
	err = tx.QueryRow(
		ctx, insertQuery,
		tenantID, req.BranchID, code, req.Kind, req.TankID, req.ToTankID,
		volumeML, req.Reason, principal.UserID,
	).Scan(&issueID)
	if err != nil {
		return nil, fmt.Errorf("insert stock issue: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("commit issue: %w", err)
	}

	parsedID, _ := uuid.Parse(issueID)
	_ = audit.Record(ctx, s.pool, audit.Entry{
		Action:     audit.ActionCreate,
		EntityType: "stock_issue",
		EntityID:   &parsedID,
		EntityCode: code,
		NewData: map[string]any{
			"code":      code,
			"kind":      req.Kind,
			"tank_id":   req.TankID,
			"volume_ml": volumeML,
		},
	})

	return s.GetIssue(ctx, issueID)
}

func (s *Service) UpdateIssue(ctx context.Context, id string, req UpdateIssueRequest) (*StockIssue, error) {
	tenantID, err := getTenant(ctx)
	if err != nil {
		return nil, err
	}

	if err := authz.EnsureRecordInScope(ctx, s.pool, "station.stock_issue", id); err != nil {
		return nil, err
	}

	var currentCode, currentStatus string
	err = s.pool.QueryRow(ctx, "SELECT code, status FROM station.stock_issue WHERE tenant_id = $1 AND id = $2", tenantID, id).Scan(&currentCode, &currentStatus)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, apperr.ErrNotFound
		}
		return nil, fmt.Errorf("find issue: %w", err)
	}

	if currentStatus != "draft" && currentStatus != "pending" {
		return nil, fmt.Errorf("%w: cannot edit issue in status '%s'", apperr.ErrForbidden, currentStatus)
	}

	var volumeML int64
	if req.VolumeLiters != nil && *req.VolumeLiters > 0 {
		volumeML = int64(*req.VolumeLiters * 1000.0)
	} else if req.VolumeML != nil && *req.VolumeML > 0 {
		volumeML = *req.VolumeML
	} else {
		return nil, fmt.Errorf("%w: volume must be positive", apperr.ErrInvalidInput)
	}

	req.Reason = strings.TrimSpace(req.Reason)
	if req.Reason == "" {
		return nil, fmt.Errorf("%w: reason is required", apperr.ErrInvalidInput)
	}

	if req.Kind == "transfer" {
		if req.ToTankID == nil || *req.ToTankID == "" {
			return nil, fmt.Errorf("%w: to_tank_id is required for transfer", apperr.ErrInvalidInput)
		}
		if *req.ToTankID == req.TankID {
			return nil, fmt.Errorf("%w: to_tank_id cannot be the same as source tank_id", apperr.ErrInvalidInput)
		}
		var srcFuel, dstFuel string
		err := s.pool.QueryRow(ctx, "SELECT fuel_type_id FROM station.tank WHERE tenant_id = $1 AND id = $2", tenantID, req.TankID).Scan(&srcFuel)
		if err != nil {
			return nil, fmt.Errorf("find source tank: %w", err)
		}
		err = s.pool.QueryRow(ctx, "SELECT fuel_type_id FROM station.tank WHERE tenant_id = $1 AND id = $2", tenantID, *req.ToTankID).Scan(&dstFuel)
		if err != nil {
			return nil, fmt.Errorf("find destination tank: %w", err)
		}
		if srcFuel != dstFuel {
			return nil, fmt.Errorf("%w: hai bể điều chuyển phải cùng loại nhiên liệu", apperr.ErrInvalidInput)
		}
	} else {
		req.ToTankID = nil
	}

	updateQuery := `
		UPDATE station.stock_issue
		SET branch_id = $3, kind = $4, tank_id = $5, to_tank_id = $6,
		    volume_ml = $7, reason = $8, updated_at = now()
		WHERE tenant_id = $1 AND id = $2
	`
	_, err = s.pool.Exec(
		ctx, updateQuery,
		tenantID, id, req.BranchID, req.Kind, req.TankID, req.ToTankID,
		volumeML, req.Reason,
	)
	if err != nil {
		return nil, fmt.Errorf("update stock issue: %w", err)
	}

	parsedID, _ := uuid.Parse(id)
	_ = audit.Record(ctx, s.pool, audit.Entry{
		Action:     audit.ActionUpdate,
		EntityType: "stock_issue",
		EntityID:   &parsedID,
		EntityCode: currentCode,
		NewData:    map[string]any{"updated": true},
	})

	return s.GetIssue(ctx, id)
}

func (s *Service) DeleteIssue(ctx context.Context, id string) error {
	tenantID, err := getTenant(ctx)
	if err != nil {
		return err
	}

	if err := authz.EnsureRecordInScope(ctx, s.pool, "station.stock_issue", id); err != nil {
		return err
	}

	var code, status string
	err = s.pool.QueryRow(ctx, "SELECT code, status FROM station.stock_issue WHERE tenant_id = $1 AND id = $2", tenantID, id).Scan(&code, &status)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return apperr.ErrNotFound
		}
		return fmt.Errorf("find issue: %w", err)
	}

	if status != "draft" && status != "pending" {
		return fmt.Errorf("%w: cannot delete issue in status '%s'", apperr.ErrForbidden, status)
	}

	_, err = s.pool.Exec(ctx, "DELETE FROM station.stock_issue WHERE tenant_id = $1 AND id = $2", tenantID, id)
	if err != nil {
		return fmt.Errorf("delete issue: %w", err)
	}

	parsedID, _ := uuid.Parse(id)
	_ = audit.Record(ctx, s.pool, audit.Entry{
		Action:     audit.ActionDelete,
		EntityType: "stock_issue",
		EntityID:   &parsedID,
		EntityCode: code,
		NewData:    map[string]any{"deleted": true},
	})

	return nil
}

func (s *Service) SubmitIssueForApproval(ctx context.Context, id string) (*StockIssue, error) {
	tenantID, err := getTenant(ctx)
	if err != nil {
		return nil, err
	}

	if err := authz.EnsureRecordInScope(ctx, s.pool, "station.stock_issue", id); err != nil {
		return nil, err
	}

	var code string
	err = s.pool.QueryRow(ctx, `
		UPDATE station.stock_issue
		SET status = 'pending', updated_at = now()
		WHERE tenant_id = $1 AND id = $2 AND status = 'draft'
		RETURNING code
	`, tenantID, id).Scan(&code)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, fmt.Errorf("%w: issue not found or not in draft status", apperr.ErrInvalidInput)
		}
		return nil, fmt.Errorf("submit issue: %w", err)
	}

	parsedID, _ := uuid.Parse(id)
	_ = audit.Record(ctx, s.pool, audit.Entry{
		Action:     audit.ActionUpdate,
		EntityType: "stock_issue",
		EntityID:   &parsedID,
		EntityCode: code,
		NewData:    map[string]any{"status": "pending"},
	})

	return s.GetIssue(ctx, id)
}

func (s *Service) ApproveIssue(ctx context.Context, id string, req ApproveIssueRequest) (*StockIssue, error) {
	tenantID, err := getTenant(ctx)
	if err != nil {
		return nil, err
	}
	principal, ok := authz.FromContext(ctx)
	if !ok || principal.UserID == "" {
		return nil, apperr.ErrUnauthorized
	}

	is, err := s.GetIssue(ctx, id)
	if err != nil {
		return nil, err
	}

	if is.Status != "pending" && is.Status != "draft" {
		return nil, fmt.Errorf("%w: issue is already %s", apperr.ErrForbidden, is.Status)
	}

	if !req.Approved && (req.RejectReason == nil || strings.TrimSpace(*req.RejectReason) == "") {
		return nil, fmt.Errorf("%w: reject_reason is required when rejecting", apperr.ErrInvalidInput)
	}

	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return nil, fmt.Errorf("begin tx: %w", err)
	}
	defer tx.Rollback(ctx)

	now := time.Now().UTC()

	if !req.Approved {
		_, err := tx.Exec(ctx, `
			UPDATE station.stock_issue
			SET status = 'rejected', decided_by = $3, decided_at = $4, reject_reason = $5, updated_at = now()
			WHERE tenant_id = $1 AND id = $2
		`, tenantID, id, principal.UserID, now, req.RejectReason)
		if err != nil {
			return nil, fmt.Errorf("reject issue: %w", err)
		}

		if err := tx.Commit(ctx); err != nil {
			return nil, fmt.Errorf("commit reject: %w", err)
		}

		parsedID, _ := uuid.Parse(id)
		_ = audit.Record(ctx, s.pool, audit.Entry{
			Action:     audit.ActionReject,
			EntityType: "stock_issue",
			EntityID:   &parsedID,
			EntityCode: is.Code,
			NewData:    map[string]any{"status": "rejected", "reason": req.RejectReason},
		})

		return s.GetIssue(ctx, id)
	}

	// Approval Flow
	// 1. Update status to approved (trigger guard_document enforces decided_by != created_by)
	_, err = tx.Exec(ctx, `
		UPDATE station.stock_issue
		SET status = 'approved', decided_by = $3, decided_at = $4, updated_at = now()
		WHERE tenant_id = $1 AND id = $2
	`, tenantID, id, principal.UserID, now)
	if err != nil {
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && pgErr.Code == "23514" {
			return nil, fmt.Errorf("%w: %s", apperr.ErrForbidden, pgErr.Message)
		}
		return nil, fmt.Errorf("approve issue: %w", err)
	}

	// 2. Write to stock ledger
	if is.Kind == "transfer" {
		if is.ToTankID == nil {
			return nil, fmt.Errorf("%w: destination tank is missing", apperr.ErrInvalidInput)
		}
		toTankName := ""
		if is.ToTankName != nil {
			toTankName = *is.ToTankName
		}
		// Transfer Out line
		_, err = tx.Exec(ctx, `
			INSERT INTO station.stock_ledger (
				tenant_id, tank_id, occurred_at, kind, delta_ml,
				ref_type, ref_id, note, created_by
			) VALUES ($1, $2, $3, 'transfer_out', $4, 'stock_issue', $5, $6, $7)
		`, tenantID, is.TankID, now, -is.VolumeML, id, fmt.Sprintf("Xuất điều chuyển sang bể %s theo phiếu %s", toTankName, is.Code), principal.UserID)
		if err != nil {
			var pgErr *pgconn.PgError
			if errors.As(err, &pgErr) && pgErr.Code == "23514" {
				return nil, fmt.Errorf("%w: %s", apperr.ErrConflict, pgErr.Message)
			}
			return nil, fmt.Errorf("write transfer_out ledger: %w", err)
		}

		// Transfer In line
		_, err = tx.Exec(ctx, `
			INSERT INTO station.stock_ledger (
				tenant_id, tank_id, occurred_at, kind, delta_ml,
				ref_type, ref_id, note, created_by
			) VALUES ($1, $2, $3, 'transfer_in', $4, 'stock_issue', $5, $6, $7)
		`, tenantID, *is.ToTankID, now, is.VolumeML, id, fmt.Sprintf("Nhận điều chuyển từ bể %s theo phiếu %s", is.TankName, is.Code), principal.UserID)
		if err != nil {
			var pgErr *pgconn.PgError
			if errors.As(err, &pgErr) && pgErr.Code == "23514" {
				return nil, fmt.Errorf("%w: %s", apperr.ErrConflict, pgErr.Message)
			}
			return nil, fmt.Errorf("write transfer_in ledger: %w", err)
		}
	} else {
		// Loss or Inspection
		_, err = tx.Exec(ctx, `
			INSERT INTO station.stock_ledger (
				tenant_id, tank_id, occurred_at, kind, delta_ml,
				ref_type, ref_id, note, created_by
			) VALUES ($1, $2, $3, 'issue', $4, 'stock_issue', $5, $6, $7)
		`, tenantID, is.TankID, now, -is.VolumeML, id, fmt.Sprintf("Xuất %s theo phiếu %s", is.KindName, is.Code), principal.UserID)
		if err != nil {
			var pgErr *pgconn.PgError
			if errors.As(err, &pgErr) && pgErr.Code == "23514" {
				return nil, fmt.Errorf("%w: %s", apperr.ErrConflict, pgErr.Message)
			}
			return nil, fmt.Errorf("write issue ledger: %w", err)
		}
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("commit approval: %w", err)
	}

	parsedID, _ := uuid.Parse(id)
	_ = audit.Record(ctx, s.pool, audit.Entry{
		Action:     audit.ActionApprove,
		EntityType: "stock_issue",
		EntityID:   &parsedID,
		EntityCode: is.Code,
		NewData:    map[string]any{"status": "approved", "volume_ml": is.VolumeML},
	})

	return s.GetIssue(ctx, id)
}

// ------------------------------------------------------------------------------------------------
// M12 - TỒN KHO TỨC THỜI, THẺ KHO, ĐỐI SOÁT KIỂM KÊ & CẢNH BÁO
// ------------------------------------------------------------------------------------------------

func (s *Service) ListTankStocks(ctx context.Context, branchID string) ([]TankStockItem, error) {
	tenantID, err := getTenant(ctx)
	if err != nil {
		return nil, err
	}

	query := `
		SELECT ts.tenant_id, ts.tank_id, ts.branch_id, COALESCE(b.name, ''),
		       ts.code, ts.name, ts.fuel_type_id, COALESCE(ft.name, ''),
		       ts.stock_ml, ts.max_usable_capacity_ml, ts.low_stock_threshold_ml,
		       ts.stock_pct, ts.is_low, ts.has_opening
		FROM station.tank_stock ts
		JOIN station.branch b ON b.id = ts.branch_id AND b.tenant_id = ts.tenant_id
		JOIN station.fuel_type ft ON ft.id = ts.fuel_type_id AND ft.tenant_id = ts.tenant_id
		WHERE ts.tenant_id = $1
	`
	args := []any{tenantID}
	argIdx := 2

	if branchID != "" && branchID != "all" {
		query += fmt.Sprintf(" AND ts.branch_id = $%d", argIdx)
		args = append(args, branchID)
		argIdx++
	}

	if p, ok := authz.FromContext(ctx); ok && len(p.BranchIDs) > 0 {
		query += fmt.Sprintf(" AND ts.branch_id = ANY($%d)", argIdx)
		args = append(args, p.BranchIDs)
		argIdx++
	}

	query += " ORDER BY b.name ASC, ts.code ASC"

	rows, err := s.pool.Query(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("query tank stock: %w", err)
	}
	defer rows.Close()

	items := make([]TankStockItem, 0)
	for rows.Next() {
		var it TankStockItem
		if err := rows.Scan(
			&it.TenantID, &it.TankID, &it.BranchID, &it.BranchName,
			&it.Code, &it.Name, &it.FuelTypeID, &it.FuelTypeName,
			&it.StockML, &it.MaxUsableCapacityML, &it.LowStockThresholdML,
			&it.StockPct, &it.IsLow, &it.HasOpening,
		); err != nil {
			return nil, fmt.Errorf("scan tank stock: %w", err)
		}
		it.StockLiters = float64(it.StockML) / 1000.0
		it.MaxCapacityLiters = float64(it.MaxUsableCapacityML) / 1000.0
		it.LowStockThresholdL = float64(it.LowStockThresholdML) / 1000.0
		items = append(items, it)
	}
	return items, nil
}

func (s *Service) ListTankStockLedger(ctx context.Context, tankID string, page, pageSize int) ([]StockLedgerItem, int, error) {
	tenantID, err := getTenant(ctx)
	if err != nil {
		return nil, 0, err
	}

	if err := authz.EnsureRecordInScope(ctx, s.pool, "station.tank", tankID); err != nil {
		return nil, 0, err
	}

	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 100 {
		pageSize = 20
	}
	offset := (page - 1) * pageSize

	var total int
	err = s.pool.QueryRow(ctx, `
		SELECT COUNT(*)
		FROM station.stock_ledger sl
		WHERE sl.tenant_id = $1 AND sl.tank_id = $2
	`, tenantID, tankID).Scan(&total)
	if err != nil {
		return nil, 0, fmt.Errorf("count stock ledger: %w", err)
	}

	rows, err := s.pool.Query(ctx, `
		SELECT sl.id, sl.tenant_id, sl.tank_id, t.code, t.name, sl.seq,
		       sl.occurred_at, sl.kind, sl.delta_ml, sl.balance_after_ml,
		       sl.ref_type, sl.ref_id, sl.note, sl.created_by, COALESCE(u.full_name, ''),
		       sl.created_at
		FROM station.stock_ledger sl
		JOIN station.tank t ON t.id = sl.tank_id AND t.tenant_id = sl.tenant_id
		LEFT JOIN station.app_user u ON u.id = sl.created_by AND u.tenant_id = sl.tenant_id
		WHERE sl.tenant_id = $1 AND sl.tank_id = $2
		ORDER BY sl.seq DESC
		LIMIT $3 OFFSET $4
	`, tenantID, tankID, pageSize, offset)
	if err != nil {
		return nil, 0, fmt.Errorf("query stock ledger: %w", err)
	}
	defer rows.Close()

	items := make([]StockLedgerItem, 0)
	for rows.Next() {
		var it StockLedgerItem
		var refID *uuid.UUID
		var createdByID *uuid.UUID
		var createdByName string
		if err := rows.Scan(
			&it.ID, &it.TenantID, &it.TankID, &it.TankCode, &it.TankName, &it.Seq,
			&it.OccurredAt, &it.Kind, &it.DeltaML, &it.BalanceAfterML,
			&it.RefType, &refID, &it.Note, &createdByID, &createdByName,
			&it.CreatedAt,
		); err != nil {
			return nil, 0, fmt.Errorf("scan stock ledger: %w", err)
		}
		if refID != nil {
			rStr := refID.String()
			it.RefID = &rStr
		}
		if createdByID != nil {
			cStr := createdByID.String()
			it.CreatedBy = &cStr
		}
		if createdByName != "" {
			it.CreatedByName = &createdByName
		}
		it.DeltaLiters = float64(it.DeltaML) / 1000.0
		it.BalanceAfterLiters = float64(it.BalanceAfterML) / 1000.0
		items = append(items, it)
	}
	return items, total, nil
}

func (s *Service) ListReconciliations(ctx context.Context, q ReconciliationListQuery) ([]StockReconciliationItem, int, error) {
	tenantID, err := getTenant(ctx)
	if err != nil {
		return nil, 0, err
	}

	if q.Page < 1 {
		q.Page = 1
	}
	if q.PageSize < 1 || q.PageSize > 100 {
		q.PageSize = 20
	}
	offset := (q.Page - 1) * q.PageSize

	where := []string{"sr.tenant_id = $1"}
	args := []any{tenantID}
	argIdx := 2

	if q.BranchID != "" && q.BranchID != "all" {
		where = append(where, fmt.Sprintf("sr.branch_id = $%d", argIdx))
		args = append(args, q.BranchID)
		argIdx++
	}
	if q.TankID != "" && q.TankID != "all" {
		where = append(where, fmt.Sprintf("sr.tank_id = $%d", argIdx))
		args = append(args, q.TankID)
		argIdx++
	}
	if q.Status != "" && q.Status != "all" {
		where = append(where, fmt.Sprintf("sr.status = $%d", argIdx))
		args = append(args, q.Status)
		argIdx++
	}
	if q.PeriodDate != "" {
		where = append(where, fmt.Sprintf("sr.period_date = $%d", argIdx))
		args = append(args, q.PeriodDate)
		argIdx++
	}
	if p, ok := authz.FromContext(ctx); ok && len(p.BranchIDs) > 0 {
		where = append(where, fmt.Sprintf("sr.branch_id = ANY($%d)", argIdx))
		args = append(args, p.BranchIDs)
		argIdx++
	}

	whereClause := strings.Join(where, " AND ")

	var total int
	err = s.pool.QueryRow(ctx, "SELECT COUNT(*) FROM station.stock_reconciliation sr WHERE "+whereClause, args...).Scan(&total)
	if err != nil {
		return nil, 0, fmt.Errorf("count stock reconciliations: %w", err)
	}

	query := fmt.Sprintf(`
		SELECT sr.id, sr.tenant_id, sr.branch_id, COALESCE(b.name, ''),
		       sr.tank_id, t.code, t.name, t.fuel_type_id, COALESCE(ft.name, ''),
		       TO_CHAR(sr.period_date, 'YYYY-MM-DD'), sr.opening_ml, sr.receipts_ml,
		       sr.dispensed_ml, sr.other_issues_ml, sr.book_closing_ml,
		       sr.measured_ml, sr.pump_totalizer_ml, sr.variance_ml, sr.variance_pct,
		       sr.tolerance_pct, sr.status, sr.measured_by, COALESCE(u_m.full_name, ''),
		       sr.confirmed_by, COALESCE(u_c.full_name, ''), sr.confirmed_at,
		       sr.note, sr.created_at, sr.updated_at
		FROM station.stock_reconciliation sr
		JOIN station.branch b ON b.id = sr.branch_id AND b.tenant_id = sr.tenant_id
		JOIN station.tank t ON t.id = sr.tank_id AND t.tenant_id = sr.tenant_id
		JOIN station.fuel_type ft ON ft.id = t.fuel_type_id AND ft.tenant_id = sr.tenant_id
		LEFT JOIN station.app_user u_m ON u_m.id = sr.measured_by AND u_m.tenant_id = sr.tenant_id
		LEFT JOIN station.app_user u_c ON u_c.id = sr.confirmed_by AND u_c.tenant_id = sr.tenant_id
		WHERE %s
		ORDER BY sr.period_date DESC, t.code ASC
		LIMIT $%d OFFSET $%d
	`, whereClause, argIdx, argIdx+1)

	args = append(args, q.PageSize, offset)

	rows, err := s.pool.Query(ctx, query, args...)
	if err != nil {
		return nil, 0, fmt.Errorf("query stock reconciliations: %w", err)
	}
	defer rows.Close()

	list := make([]StockReconciliationItem, 0)
	for rows.Next() {
		var it StockReconciliationItem
		var mByID, cByID *uuid.UUID
		var mByName, cByName string
		if err := rows.Scan(
			&it.ID, &it.TenantID, &it.BranchID, &it.BranchName,
			&it.TankID, &it.TankCode, &it.TankName, &it.FuelTypeID, &it.FuelTypeName,
			&it.PeriodDate, &it.OpeningML, &it.ReceiptsML,
			&it.DispensedML, &it.OtherIssuesML, &it.BookClosingML,
			&it.MeasuredML, &it.PumpTotalizerML, &it.VarianceML, &it.VariancePct,
			&it.TolerancePct, &it.Status, &mByID, &mByName,
			&cByID, &cByName, &it.ConfirmedAt,
			&it.Note, &it.CreatedAt, &it.UpdatedAt,
		); err != nil {
			return nil, 0, fmt.Errorf("scan stock reconciliation: %w", err)
		}
		if mByID != nil {
			mStr := mByID.String()
			it.MeasuredBy = &mStr
		}
		if mByName != "" {
			it.MeasuredByName = &mByName
		}
		if cByID != nil {
			cStr := cByID.String()
			it.ConfirmedBy = &cStr
		}
		if cByName != "" {
			it.ConfirmedByName = &cByName
		}

		it.OpeningLiters = float64(it.OpeningML) / 1000.0
		it.ReceiptsLiters = float64(it.ReceiptsML) / 1000.0
		it.DispensedLiters = float64(it.DispensedML) / 1000.0
		it.OtherIssuesLiters = float64(it.OtherIssuesML) / 1000.0
		it.BookClosingLiters = float64(it.BookClosingML) / 1000.0

		if it.MeasuredML != nil {
			mLiters := float64(*it.MeasuredML) / 1000.0
			it.MeasuredLiters = &mLiters
		}
		if it.PumpTotalizerML != nil {
			pLiters := float64(*it.PumpTotalizerML) / 1000.0
			it.PumpTotalizerLiters = &pLiters
		}
		if it.VarianceML != nil {
			vLiters := float64(*it.VarianceML) / 1000.0
			it.VarianceLiters = &vLiters
		}

		list = append(list, it)
	}

	return list, total, nil
}

func (s *Service) GetReconciliation(ctx context.Context, id string) (*StockReconciliationItem, error) {
	tenantID, err := getTenant(ctx)
	if err != nil {
		return nil, err
	}

	if err := authz.EnsureRecordInScope(ctx, s.pool, "station.stock_reconciliation", id); err != nil {
		return nil, err
	}

	var it StockReconciliationItem
	var mByID, cByID *uuid.UUID
	var mByName, cByName string

	err = s.pool.QueryRow(ctx, `
		SELECT sr.id, sr.tenant_id, sr.branch_id, COALESCE(b.name, ''),
		       sr.tank_id, t.code, t.name, t.fuel_type_id, COALESCE(ft.name, ''),
		       TO_CHAR(sr.period_date, 'YYYY-MM-DD'), sr.opening_ml, sr.receipts_ml,
		       sr.dispensed_ml, sr.other_issues_ml, sr.book_closing_ml,
		       sr.measured_ml, sr.pump_totalizer_ml, sr.variance_ml, sr.variance_pct,
		       sr.tolerance_pct, sr.status, sr.measured_by, COALESCE(u_m.full_name, ''),
		       sr.confirmed_by, COALESCE(u_c.full_name, ''), sr.confirmed_at,
		       sr.note, sr.created_at, sr.updated_at
		FROM station.stock_reconciliation sr
		JOIN station.branch b ON b.id = sr.branch_id AND b.tenant_id = sr.tenant_id
		JOIN station.tank t ON t.id = sr.tank_id AND t.tenant_id = sr.tenant_id
		JOIN station.fuel_type ft ON ft.id = t.fuel_type_id AND ft.tenant_id = sr.tenant_id
		LEFT JOIN station.app_user u_m ON u_m.id = sr.measured_by AND u_m.tenant_id = sr.tenant_id
		LEFT JOIN station.app_user u_c ON u_c.id = sr.confirmed_by AND u_c.tenant_id = sr.tenant_id
		WHERE sr.id = $1 AND sr.tenant_id = $2
	`, id, tenantID).Scan(
		&it.ID, &it.TenantID, &it.BranchID, &it.BranchName,
		&it.TankID, &it.TankCode, &it.TankName, &it.FuelTypeID, &it.FuelTypeName,
		&it.PeriodDate, &it.OpeningML, &it.ReceiptsML,
		&it.DispensedML, &it.OtherIssuesML, &it.BookClosingML,
		&it.MeasuredML, &it.PumpTotalizerML, &it.VarianceML, &it.VariancePct,
		&it.TolerancePct, &it.Status, &mByID, &mByName,
		&cByID, &cByName, &it.ConfirmedAt,
		&it.Note, &it.CreatedAt, &it.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, apperr.ErrNotFound
		}
		return nil, fmt.Errorf("get reconciliation: %w", err)
	}

	if mByID != nil {
		mStr := mByID.String()
		it.MeasuredBy = &mStr
	}
	if mByName != "" {
		it.MeasuredByName = &mByName
	}
	if cByID != nil {
		cStr := cByID.String()
		it.ConfirmedBy = &cStr
	}
	if cByName != "" {
		it.ConfirmedByName = &cByName
	}

	it.OpeningLiters = float64(it.OpeningML) / 1000.0
	it.ReceiptsLiters = float64(it.ReceiptsML) / 1000.0
	it.DispensedLiters = float64(it.DispensedML) / 1000.0
	it.OtherIssuesLiters = float64(it.OtherIssuesML) / 1000.0
	it.BookClosingLiters = float64(it.BookClosingML) / 1000.0

	if it.MeasuredML != nil {
		mLiters := float64(*it.MeasuredML) / 1000.0
		it.MeasuredLiters = &mLiters
	}
	if it.PumpTotalizerML != nil {
		pLiters := float64(*it.PumpTotalizerML) / 1000.0
		it.PumpTotalizerLiters = &pLiters
	}
	if it.VarianceML != nil {
		vLiters := float64(*it.VarianceML) / 1000.0
		it.VarianceLiters = &vLiters
	}

	return &it, nil
}

func (s *Service) GenerateReconciliation(ctx context.Context, req CreateReconciliationRequest) (*StockReconciliationItem, error) {
	tenantID, err := getTenant(ctx)
	if err != nil {
		return nil, err
	}

	if err := authz.EnsureRecordInScope(ctx, s.pool, "station.tank", req.TankID); err != nil {
		return nil, err
	}

	if req.TankID == "" {
		return nil, fmt.Errorf("%w: tank_id is required", apperr.ErrInvalidInput)
	}
	if req.PeriodDate == "" {
		req.PeriodDate = time.Now().Format("2006-01-02")
	}

	// 1. Check if already exists
	var existingID string
	err = s.pool.QueryRow(ctx, `
		SELECT id FROM station.stock_reconciliation
		WHERE tenant_id = $1 AND tank_id = $2 AND period_date = $3
	`, tenantID, req.TankID, req.PeriodDate).Scan(&existingID)
	if err == nil {
		return s.GetReconciliation(ctx, existingID)
	}

	// 2. Tank info
	var branchID string
	var tolerancePct float64
	err = s.pool.QueryRow(ctx, `
		SELECT branch_id, COALESCE(loss_tolerance_pct, 0.5)
		FROM station.tank
		WHERE id = $1 AND tenant_id = $2
	`, req.TankID, tenantID).Scan(&branchID, &tolerancePct)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, fmt.Errorf("%w: tank not found", apperr.ErrNotFound)
		}
		return nil, fmt.Errorf("query tank: %w", err)
	}

	// 3. Time bounds (VN timezone)
	loc, err := time.LoadLocation("Asia/Ho_Chi_Minh")
	if err != nil {
		loc = time.FixedZone("ICT", 7*3600)
	}
	parsedDate, err := time.ParseInLocation("2006-01-02", req.PeriodDate, loc)
	if err != nil {
		return nil, fmt.Errorf("%w: invalid period_date format", apperr.ErrInvalidInput)
	}
	startOfDay := parsedDate
	endOfDay := startOfDay.AddDate(0, 0, 1)

	// Opening: balance before start of day
	var openingML int64
	err = s.pool.QueryRow(ctx, `
		SELECT balance_after_ml
		FROM station.stock_ledger
		WHERE tenant_id = $1 AND tank_id = $2 AND occurred_at < $3
		ORDER BY seq DESC LIMIT 1
	`, tenantID, req.TankID, startOfDay).Scan(&openingML)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			// Check current or opening
			_ = s.pool.QueryRow(ctx, `
				SELECT COALESCE(balance_after_ml - delta_ml, 0)
				FROM station.stock_ledger
				WHERE tenant_id = $1 AND tank_id = $2
				ORDER BY seq ASC LIMIT 1
			`, tenantID, req.TankID).Scan(&openingML)
		}
	}

	// Receipts in period
	var receiptsML int64
	_ = s.pool.QueryRow(ctx, `
		SELECT COALESCE(SUM(srl.actual_volume_ml), 0)
		FROM station.stock_receipt_line srl
		JOIN station.stock_receipt sr ON sr.id = srl.receipt_id
		WHERE sr.tenant_id = $1 AND srl.tank_id = $2 AND sr.status = 'approved'
		  AND sr.received_at >= $3 AND sr.received_at < $4
	`, tenantID, req.TankID, startOfDay, endOfDay).Scan(&receiptsML)

	// Dispensed in period
	var dispensedML int64
	_ = s.pool.QueryRow(ctx, `
		SELECT COALESCE(SUM(dispensed_ml), 0)
		FROM station.dispense_session
		WHERE tenant_id = $1 AND tank_id = $2 AND status = 'completed'
		  AND (
		    (finished_at IS NOT NULL AND finished_at >= $3 AND finished_at < $4)
		    OR (finished_at IS NULL AND started_at >= $3 AND started_at < $4)
		  )
	`, tenantID, req.TankID, startOfDay, endOfDay).Scan(&dispensedML)

	// Other issues in period
	var otherIssuesML int64
	_ = s.pool.QueryRow(ctx, `
		SELECT COALESCE(SUM(volume_ml), 0)
		FROM station.stock_issue
		WHERE tenant_id = $1 AND tank_id = $2 AND status = 'approved'
		  AND created_at >= $3 AND created_at < $4
	`, tenantID, req.TankID, startOfDay, endOfDay).Scan(&otherIssuesML)

	// Book closing
	bookClosingML := openingML + receiptsML - dispensedML - otherIssuesML
	if bookClosingML < 0 {
		bookClosingML = 0
	}

	var newID string
	err = s.pool.QueryRow(ctx, `
		INSERT INTO station.stock_reconciliation (
			tenant_id, branch_id, tank_id, period_date,
			opening_ml, receipts_ml, dispensed_ml, other_issues_ml,
			book_closing_ml, tolerance_pct, status
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'open')
		RETURNING id
	`, tenantID, branchID, req.TankID, req.PeriodDate,
		openingML, receiptsML, dispensedML, otherIssuesML,
		bookClosingML, tolerancePct,
	).Scan(&newID)
	if err != nil {
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && pgErr.Code == "23505" {
			_ = s.pool.QueryRow(ctx, `
				SELECT id FROM station.stock_reconciliation
				WHERE tenant_id = $1 AND tank_id = $2 AND period_date = $3
			`, tenantID, req.TankID, req.PeriodDate).Scan(&newID)
			return s.GetReconciliation(ctx, newID)
		}
		return nil, fmt.Errorf("insert stock reconciliation: %w", err)
	}

	return s.GetReconciliation(ctx, newID)
}

func (s *Service) SubmitMeasuredStock(ctx context.Context, id string, req SubmitMeasureRequest) (*StockReconciliationItem, error) {
	tenantID, err := getTenant(ctx)
	if err != nil {
		return nil, err
	}

	user, ok := authz.FromContext(ctx)
	if !ok || user.UserID == "" {
		return nil, apperr.ErrUnauthorized
	}

	rec, err := s.GetReconciliation(ctx, id)
	if err != nil {
		return nil, err
	}

	if rec.Status == "confirmed" {
		return nil, fmt.Errorf("%w: kỳ kiểm kê đã được kế toán xác nhận, không thể sửa", apperr.ErrConflict)
	}

	var measuredML int64
	if req.MeasuredLiters != nil {
		measuredML = int64(*req.MeasuredLiters * 1000.0)
	} else if req.MeasuredML != nil {
		measuredML = *req.MeasuredML
	} else {
		return nil, fmt.Errorf("%w: measured_liters or measured_ml is required", apperr.ErrInvalidInput)
	}

	var pumpTotalizerML *int64
	if req.PumpTotalizerLiters != nil {
		ptML := int64(*req.PumpTotalizerLiters * 1000.0)
		pumpTotalizerML = &ptML
	} else if req.PumpTotalizerML != nil {
		pumpTotalizerML = req.PumpTotalizerML
	}

	varianceML := measuredML - rec.BookClosingML
	var variancePct float64
	if rec.BookClosingML > 0 {
		variancePct = (float64(varianceML) / float64(rec.BookClosingML)) * 100.0
	} else if measuredML != 0 {
		variancePct = 100.0
	}

	absVariancePct := math.Abs(variancePct)
	var nextStatus string
	if absVariancePct <= rec.TolerancePct {
		nextStatus = "matched"
	} else {
		nextStatus = "alert"
	}

	_, err = s.pool.Exec(ctx, `
		UPDATE station.stock_reconciliation
		SET measured_ml = $1,
		    pump_totalizer_ml = $2,
		    variance_ml = $3,
		    variance_pct = $4,
		    status = $5,
		    measured_by = $6,
		    note = COALESCE($7, note),
		    updated_at = now()
		WHERE id = $8 AND tenant_id = $9
	`, measuredML, pumpTotalizerML, varianceML, variancePct,
		nextStatus, user.UserID, req.Note, id, tenantID,
	)
	if err != nil {
		return nil, fmt.Errorf("update measured stock: %w", err)
	}

	// If alert, log in station.alert and notification outbox
	if nextStatus == "alert" {
		alertMsg := fmt.Sprintf("Bể %s ngày %s chênh lệch kiểm kê %.2f%% vượt ngưỡng cho phép %.2f%% (sổ sách: %.1f L, thực tế: %.1f L)",
			rec.TankName, rec.PeriodDate, variancePct, rec.TolerancePct,
			rec.BookClosingLiters, float64(measuredML)/1000.0)

		_, _ = s.pool.Exec(ctx, `
			INSERT INTO station.alert (tenant_id, branch_id, kind, tank_id, message)
			VALUES ($1, $2, 'loss_variance', $3, $4)
		`, tenantID, rec.BranchID, rec.TankID, alertMsg)

		_, _ = s.pool.Exec(ctx, `
			INSERT INTO station.notification_outbox (tenant_id, channel, recipient, subject, body, status)
			VALUES ($1, 'email', 'ketoan@petrovn.vn', $2, $3, 'pending')
		`, tenantID, fmt.Sprintf("[CẢNH BÁO KIỂM KÊ] Bể %s vượt ngưỡng hao hụt", rec.TankName), alertMsg)
	}

	parsedID, _ := uuid.Parse(id)
	_ = audit.Record(ctx, s.pool, audit.Entry{
		Action:     audit.ActionUpdate,
		EntityType: "stock_reconciliation",
		EntityID:   &parsedID,
		EntityCode: rec.PeriodDate,
		NewData: map[string]any{
			"status":       nextStatus,
			"measured_ml":  measuredML,
			"variance_ml":  varianceML,
			"variance_pct": variancePct,
		},
	})

	return s.GetReconciliation(ctx, id)
}

func (s *Service) ConfirmReconciliation(ctx context.Context, id string, req ConfirmReconciliationRequest) (*StockReconciliationItem, error) {
	tenantID, err := getTenant(ctx)
	if err != nil {
		return nil, err
	}

	user, ok := authz.FromContext(ctx)
	if !ok || user.UserID == "" {
		return nil, apperr.ErrUnauthorized
	}

	rec, err := s.GetReconciliation(ctx, id)
	if err != nil {
		return nil, err
	}

	if rec.Status == "confirmed" {
		return nil, fmt.Errorf("%w: kỳ kiểm kê đã được xác nhận trước đó", apperr.ErrConflict)
	}
	if rec.Status == "open" || rec.MeasuredML == nil {
		return nil, fmt.Errorf("%w: kỳ kiểm kê chưa được nhập số đo thực tế", apperr.ErrConflict)
	}

	// Separation of duties / Chống tự duyệt: người xác nhận phải khác người đo
	if rec.MeasuredBy != nil && *rec.MeasuredBy == user.UserID {
		var allowSelfApproval bool
		_ = s.pool.QueryRow(ctx, "SELECT allow_self_approval FROM station.tenant_setting WHERE tenant_id = $1", tenantID).Scan(&allowSelfApproval)
		if !allowSelfApproval {
			return nil, fmt.Errorf("%w: kế toán xác nhận phải khác người đo thực tế (chống tự duyệt)", apperr.ErrForbidden)
		}
	}

	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return nil, fmt.Errorf("begin confirm tx: %w", err)
	}
	defer tx.Rollback(ctx)

	now := time.Now()
	_, err = tx.Exec(ctx, `
		UPDATE station.stock_reconciliation
		SET status = 'confirmed',
		    confirmed_by = $1,
		    confirmed_at = $2,
		    note = COALESCE($3, note),
		    updated_at = now()
		WHERE id = $4 AND tenant_id = $5
	`, user.UserID, now, req.Note, id, tenantID)
	if err != nil {
		return nil, fmt.Errorf("update confirm reconciliation: %w", err)
	}

	// If adjust ledger requested and variance is non-zero
	if req.AdjustLedger && rec.VarianceML != nil && *rec.VarianceML != 0 {
		_, err = tx.Exec(ctx, `
			INSERT INTO station.stock_ledger (
				tenant_id, tank_id, kind, delta_ml, ref_type, ref_id, note, created_by
			) VALUES ($1, $2, 'adjust', $3, 'stock_reconciliation', $4, $5, $6)
		`, tenantID, rec.TankID, *rec.VarianceML, id, "Điều chỉnh số dư theo biên bản đối chiếu kiểm kê", user.UserID)
		if err != nil {
			var pgErr *pgconn.PgError
			if errors.As(err, &pgErr) && pgErr.Code == "23514" {
				return nil, fmt.Errorf("%w: %s", apperr.ErrConflict, pgErr.Message)
			}
			return nil, fmt.Errorf("write adjust ledger: %w", err)
		}
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("commit confirm reconciliation: %w", err)
	}

	parsedID, _ := uuid.Parse(id)
	_ = audit.Record(ctx, s.pool, audit.Entry{
		Action:     audit.ActionApprove,
		EntityType: "stock_reconciliation",
		EntityID:   &parsedID,
		EntityCode: rec.PeriodDate,
		NewData: map[string]any{
			"status":       "confirmed",
			"confirmed_by": user.UserID,
			"adjust":       req.AdjustLedger,
		},
	})

	return s.GetReconciliation(ctx, id)
}

func (s *Service) GetStocktakeSummary(ctx context.Context, branchID string) (*StocktakeSummary, error) {
	tenantID, err := getTenant(ctx)
	if err != nil {
		return nil, err
	}

	var sum StocktakeSummary

	tankQuery := "SELECT COUNT(*), COALESCE(SUM(stock_ml), 0), COUNT(*) FILTER (WHERE is_low = true) FROM station.tank_stock WHERE tenant_id = $1"
	args := []any{tenantID}
	scope := authz.BranchScope(ctx)
	if scope != nil {
		tankQuery += " AND branch_id = ANY($2::uuid[])"
		args = append(args, scope)
	}
	if branchID != "" && branchID != "all" {
		tankQuery += fmt.Sprintf(" AND branch_id = $%d", len(args)+1)
		args = append(args, branchID)
	}

	var totalStockML int64
	err = s.pool.QueryRow(ctx, tankQuery, args...).Scan(&sum.TotalTanks, &totalStockML, &sum.LowStockTanks)
	if err != nil {
		return nil, fmt.Errorf("query tank summary: %w", err)
	}
	sum.TotalStockLiters = float64(totalStockML) / 1000.0

	recQuery := `
		SELECT COUNT(*) FILTER (WHERE status = 'open'),
		       COUNT(*) FILTER (WHERE status = 'alert')
		FROM station.stock_reconciliation
		WHERE tenant_id = $1
	`
	recArgs := []any{tenantID}
	if scope != nil {
		recQuery += " AND branch_id = ANY($2::uuid[])"
		recArgs = append(recArgs, scope)
	}
	if branchID != "" && branchID != "all" {
		recQuery += fmt.Sprintf(" AND branch_id = $%d", len(recArgs)+1)
		recArgs = append(recArgs, branchID)
	}
	_ = s.pool.QueryRow(ctx, recQuery, recArgs...).Scan(&sum.OpenStocktakes, &sum.AlertStocktakes)

	return &sum, nil
}

func (s *Service) ListAlerts(ctx context.Context, branchID string, resolved *bool) ([]AlertItem, error) {
	tenantID, err := getTenant(ctx)
	if err != nil {
		return nil, err
	}

	query := `
		SELECT a.id, a.tenant_id, a.branch_id, COALESCE(b.name, ''),
		       a.kind, a.tank_id, COALESCE(t.name, ''),
		       a.edge_station_id, COALESCE(es.name, ''),
		       a.message, a.created_at, a.resolved_at
		FROM station.alert a
		LEFT JOIN station.branch b ON b.id = a.branch_id AND b.tenant_id = a.tenant_id
		LEFT JOIN station.tank t ON t.id = a.tank_id AND t.tenant_id = a.tenant_id
		LEFT JOIN station.edge_station es ON es.id = a.edge_station_id AND es.tenant_id = a.tenant_id
		WHERE a.tenant_id = $1
	`
	args := []any{tenantID}
	argIdx := 2

	if scope := authz.BranchScope(ctx); scope != nil {
		query += fmt.Sprintf(" AND a.branch_id = ANY($%d::uuid[])", argIdx)
		args = append(args, scope)
		argIdx++
	}

	if branchID != "" && branchID != "all" {
		query += fmt.Sprintf(" AND a.branch_id = $%d", argIdx)
		args = append(args, branchID)
		argIdx++
	}

	if resolved != nil {
		if *resolved {
			query += " AND a.resolved_at IS NOT NULL"
		} else {
			query += " AND a.resolved_at IS NULL"
		}
	}

	query += " ORDER BY a.created_at DESC LIMIT 100"

	rows, err := s.pool.Query(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("query alerts: %w", err)
	}
	defer rows.Close()

	list := make([]AlertItem, 0)
	for rows.Next() {
		var it AlertItem
		var bID, tID, esID *uuid.UUID
		var bName, tName, esName string
		if err := rows.Scan(
			&it.ID, &it.TenantID, &bID, &bName,
			&it.Kind, &tID, &tName,
			&esID, &esName,
			&it.Message, &it.CreatedAt, &it.ResolvedAt,
		); err != nil {
			return nil, fmt.Errorf("scan alert: %w", err)
		}
		if bID != nil {
			s := bID.String()
			it.BranchID = &s
		}
		if bName != "" {
			it.BranchName = &bName
		}
		if tID != nil {
			s := tID.String()
			it.TankID = &s
		}
		if tName != "" {
			it.TankName = &tName
		}
		if esID != nil {
			s := esID.String()
			it.EdgeStationID = &s
		}
		if esName != "" {
			it.EdgeStationName = &esName
		}
		list = append(list, it)
	}

	return list, nil
}

func (s *Service) ResolveAlert(ctx context.Context, id string) error {
	tenantID, err := getTenant(ctx)
	if err != nil {
		return err
	}

	if err := authz.EnsureRecordInScope(ctx, s.pool, "station.alert", id); err != nil {
		return err
	}

	res, err := s.pool.Exec(ctx, `
		UPDATE station.alert
		SET resolved_at = now()
		WHERE id = $1 AND tenant_id = $2 AND resolved_at IS NULL
	`, id, tenantID)
	if err != nil {
		return fmt.Errorf("resolve alert: %w", err)
	}
	if res.RowsAffected() == 0 {
		return apperr.ErrNotFound
	}
	return nil
}

func (s *Service) CheckLowStock(ctx context.Context) ([]AlertItem, error) {
	tenantID, err := getTenant(ctx)
	if err != nil {
		return nil, err
	}

	rows, err := s.pool.Query(ctx, `
		SELECT ts.tank_id, ts.branch_id, ts.name, ts.stock_ml, ts.low_stock_threshold_ml
		FROM station.tank_stock ts
		WHERE ts.tenant_id = $1 AND ts.is_low = true
	`, tenantID)
	if err != nil {
		return nil, fmt.Errorf("query low stock: %w", err)
	}
	defer rows.Close()

	var alerts []AlertItem
	for rows.Next() {
		var tankID, branchID string
		var tankName string
		var stockML, thresholdML int64
		if err := rows.Scan(&tankID, &branchID, &tankName, &stockML, &thresholdML); err != nil {
			return nil, err
		}

		// Check if active alert already exists
		var exists bool
		_ = s.pool.QueryRow(ctx, `
			SELECT EXISTS (
				SELECT 1 FROM station.alert
				WHERE tenant_id = $1 AND tank_id = $2 AND kind = 'low_stock' AND resolved_at IS NULL
			)
		`, tenantID, tankID).Scan(&exists)

		if !exists {
			msg := fmt.Sprintf("Bể %s đạt mức tồn thấp: còn %.1f L (ngưỡng: %.1f L)",
				tankName, float64(stockML)/1000.0, float64(thresholdML)/1000.0)

			var alertID string
			err = s.pool.QueryRow(ctx, `
				INSERT INTO station.alert (tenant_id, branch_id, kind, tank_id, message)
				VALUES ($1, $2, 'low_stock', $3, $4)
				RETURNING id
			`, tenantID, branchID, tankID, msg).Scan(&alertID)
			if err == nil {
				_, _ = s.pool.Exec(ctx, `
					INSERT INTO station.notification_outbox (tenant_id, channel, recipient, subject, body, status)
					VALUES ($1, 'email', 'quanly@petrovn.vn', $2, $3, 'pending')
				`, tenantID, fmt.Sprintf("[CẢNH BÁO TỒN THẤP] Bể %s", tankName), msg)

				alerts = append(alerts, AlertItem{
					ID:       alertID,
					TenantID: tenantID,
					Kind:     "low_stock",
					TankID:   &tankID,
					TankName: &tankName,
					Message:  msg,
				})
			}
		}
	}

	return alerts, nil
}
