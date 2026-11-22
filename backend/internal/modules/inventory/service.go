package inventory

import (
	"context"
	"errors"
	"fmt"
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
