package assets

import (
	"context"
	"errors"
	"fmt"
	"strings"

	"fuel-station-backend/internal/platform/crypto"
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
	pool      *pgxpool.Pool
	cryptoKey []byte
}

func NewService(pool *pgxpool.Pool) *Service {
	return &Service{
		pool:      pool,
		cryptoKey: crypto.DefaultCryptoKey,
	}
}

// WithCryptoKey đổi khóa mã hóa mật khẩu máy chấm công (mặc định là khóa dev, chỉ dùng khi chạy local).
func (s *Service) WithCryptoKey(key []byte) *Service {
	s.cryptoKey = key
	return s
}

func getTenant(ctx context.Context) (string, error) {
	tenantID, ok := middleware.TenantIDFromContext(ctx)
	if !ok || tenantID == "" {
		// Try from principal
		if p, ok := authz.FromContext(ctx); ok && p.TenantID != "" {
			return p.TenantID, nil
		}
		return "", apperr.ErrUnauthorized
	}
	return tenantID, nil
}

// sensorBaud là tốc độ baud cố định của bộ số Montech.
const sensorBaud = 9600

// terminalPort là cổng HTTP cố định của máy chấm công Hikvision.
const terminalPort = 80

// ------------------------------------------------------------------------------------------------
// BRANCH SERVICE
// ------------------------------------------------------------------------------------------------

func (s *Service) ListBranches(ctx context.Context, q BranchListQuery) ([]Branch, int, error) {
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

	where := []string{"tenant_id = $1"}
	args := []any{tenantID}
	argIdx := 2
	authz.AddBranchScope(ctx, "id", &where, &args, &argIdx)

	if q.Search != "" {
		where = append(where, fmt.Sprintf("(code ILIKE $%d OR name ILIKE $%d OR address ILIKE $%d)", argIdx, argIdx, argIdx))
		args = append(args, "%"+q.Search+"%")
		argIdx++
	}

	if q.Status != "" {
		where = append(where, fmt.Sprintf("status = $%d", argIdx))
		args = append(args, q.Status)
		argIdx++
	}

	whereClause := strings.Join(where, " AND ")

	countQuery := fmt.Sprintf("SELECT COUNT(*) FROM station.branch WHERE %s", whereClause)
	var total int
	if err := s.pool.QueryRow(ctx, countQuery, args...).Scan(&total); err != nil {
		return nil, 0, fmt.Errorf("count branches: %w", err)
	}

	query := fmt.Sprintf(`
		SELECT id, tenant_id, code, name, address, manager_name, phone, status, created_at, updated_at
		FROM station.branch
		WHERE %s
		ORDER BY created_at DESC
		LIMIT $%d OFFSET $%d
	`, whereClause, argIdx, argIdx+1)
	args = append(args, q.PageSize, offset)

	rows, err := s.pool.Query(ctx, query, args...)
	if err != nil {
		return nil, 0, fmt.Errorf("query branches: %w", err)
	}
	defer rows.Close()

	var branches []Branch
	for rows.Next() {
		var b Branch
		if err := rows.Scan(
			&b.ID, &b.TenantID, &b.Code, &b.Name, &b.Address,
			&b.ManagerName, &b.Phone, &b.Status, &b.CreatedAt, &b.UpdatedAt,
		); err != nil {
			return nil, 0, fmt.Errorf("scan branch: %w", err)
		}
		branches = append(branches, b)
	}

	return branches, total, nil
}

func (s *Service) GetBranch(ctx context.Context, id string) (*Branch, error) {
	tenantID, err := getTenant(ctx)
	if err != nil {
		return nil, err
	}

	if err := authz.EnsureBranchVisible(ctx, id); err != nil {
		return nil, err
	}

	var b Branch
	query := `
		SELECT id, tenant_id, code, name, address, manager_name, phone, status, created_at, updated_at
		FROM station.branch
		WHERE tenant_id = $1 AND id = $2
	`
	err = s.pool.QueryRow(ctx, query, tenantID, id).Scan(
		&b.ID, &b.TenantID, &b.Code, &b.Name, &b.Address,
		&b.ManagerName, &b.Phone, &b.Status, &b.CreatedAt, &b.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, apperr.ErrNotFound
		}
		return nil, fmt.Errorf("get branch: %w", err)
	}

	return &b, nil
}

func (s *Service) CreateBranch(ctx context.Context, req CreateBranchRequest) (*Branch, error) {
	tenantID, err := getTenant(ctx)
	if err != nil {
		return nil, err
	}

	if strings.TrimSpace(req.Name) == "" {
		return nil, fmt.Errorf("%w: name is required", apperr.ErrInvalidInput)
	}

	// Mã trạm xăng do hệ thống sinh (không nhận từ client), dạng CN-2026-0001.
	if err := s.pool.QueryRow(ctx, `SELECT station.next_code($1, 'CN')`, tenantID).Scan(&req.Code); err != nil {
		return nil, fmt.Errorf("generate branch code: %w", err)
	}

	var b Branch
	query := `
		INSERT INTO station.branch (tenant_id, code, name, address, manager_name, phone, status)
		VALUES ($1, $2, $3, $4, $5, $6, 'active')
		RETURNING id, tenant_id, code, name, address, manager_name, phone, status, created_at, updated_at
	`
	err = s.pool.QueryRow(ctx, query, tenantID, req.Code, req.Name, req.Address, req.ManagerName, req.Phone).Scan(
		&b.ID, &b.TenantID, &b.Code, &b.Name, &b.Address,
		&b.ManagerName, &b.Phone, &b.Status, &b.CreatedAt, &b.UpdatedAt,
	)
	if err != nil {
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && pgErr.Code == "23505" {
			return nil, apperr.ErrConflict
		}
		return nil, fmt.Errorf("insert branch: %w", err)
	}

	// Người tạo bị giới hạn trạm xăng thì tự được gán trạm xăng mới, nếu không họ sẽ không thấy trạm xăng vừa tạo.
	if p, ok := authz.FromContext(ctx); ok && p.Restricted() {
		if _, err := s.pool.Exec(ctx, `
			INSERT INTO station.user_branch (tenant_id, user_id, branch_id) VALUES ($1, $2, $3)
			ON CONFLICT DO NOTHING
		`, tenantID, p.UserID, b.ID); err != nil {
			return nil, fmt.Errorf("assign new branch to creator: %w", err)
		}
	}

	parsedID, _ := uuid.Parse(b.ID)
	_ = audit.Record(ctx, s.pool, audit.Entry{
		Action:     audit.ActionCreate,
		EntityType: "branch",
		EntityID:   &parsedID,
		EntityCode: b.Code,
		NewData:    map[string]any{"name": b.Name, "code": b.Code},
	})

	return &b, nil
}

func (s *Service) UpdateBranch(ctx context.Context, id string, req UpdateBranchRequest) (*Branch, error) {
	tenantID, err := getTenant(ctx)
	if err != nil {
		return nil, err
	}

	if err := authz.EnsureBranchVisible(ctx, id); err != nil {
		return nil, err
	}

	if strings.TrimSpace(req.Name) == "" {
		return nil, fmt.Errorf("%w: name is required", apperr.ErrInvalidInput)
	}
	if req.Status != "active" && req.Status != "inactive" {
		req.Status = "active"
	}

	var b Branch
	query := `
		UPDATE station.branch
		SET name = $3, address = $4, manager_name = $5, phone = $6, status = $7, updated_at = now()
		WHERE tenant_id = $1 AND id = $2
		RETURNING id, tenant_id, code, name, address, manager_name, phone, status, created_at, updated_at
	`
	err = s.pool.QueryRow(ctx, query, tenantID, id, req.Name, req.Address, req.ManagerName, req.Phone, req.Status).Scan(
		&b.ID, &b.TenantID, &b.Code, &b.Name, &b.Address,
		&b.ManagerName, &b.Phone, &b.Status, &b.CreatedAt, &b.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, apperr.ErrNotFound
		}
		return nil, fmt.Errorf("update branch: %w", err)
	}

	parsedID, _ := uuid.Parse(b.ID)
	_ = audit.Record(ctx, s.pool, audit.Entry{
		Action:     audit.ActionUpdate,
		EntityType: "branch",
		EntityID:   &parsedID,
		EntityCode: b.Code,
		NewData:    map[string]any{"name": b.Name, "status": b.Status},
	})

	return &b, nil
}

func (s *Service) DeleteBranch(ctx context.Context, id string) error {
	tenantID, err := getTenant(ctx)
	if err != nil {
		return err
	}

	if err := authz.EnsureBranchVisible(ctx, id); err != nil {
		return err
	}

	var code, name string
	query := `
		UPDATE station.branch
		SET status = 'inactive', updated_at = now()
		WHERE tenant_id = $1 AND id = $2
		RETURNING code, name
	`
	err = s.pool.QueryRow(ctx, query, tenantID, id).Scan(&code, &name)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return apperr.ErrNotFound
		}
		return fmt.Errorf("deactivate branch: %w", err)
	}

	parsedID, _ := uuid.Parse(id)
	_ = audit.Record(ctx, s.pool, audit.Entry{
		Action:     audit.ActionDelete,
		EntityType: "branch",
		EntityID:   &parsedID,
		EntityCode: code,
		NewData:    map[string]any{"status": "inactive", "name": name},
	})

	return nil
}

// ------------------------------------------------------------------------------------------------
// FUEL TYPE SERVICE
// ------------------------------------------------------------------------------------------------

func (s *Service) ListFuelTypes(ctx context.Context) ([]FuelType, error) {
	tenantID, err := getTenant(ctx)
	if err != nil {
		return nil, err
	}

	rows, err := s.pool.Query(ctx, `
		SELECT id, tenant_id, code, name, active, created_at, updated_at
		FROM station.fuel_type
		WHERE tenant_id = $1
		ORDER BY code ASC
	`, tenantID)
	if err != nil {
		return nil, fmt.Errorf("query fuel types: %w", err)
	}
	defer rows.Close()

	var types []FuelType
	for rows.Next() {
		var ft FuelType
		if err := rows.Scan(&ft.ID, &ft.TenantID, &ft.Code, &ft.Name, &ft.Active, &ft.CreatedAt, &ft.UpdatedAt); err != nil {
			return nil, fmt.Errorf("scan fuel type: %w", err)
		}
		types = append(types, ft)
	}

	return types, nil
}

func (s *Service) CreateFuelType(ctx context.Context, req CreateFuelTypeRequest) (*FuelType, error) {
	tenantID, err := getTenant(ctx)
	if err != nil {
		return nil, err
	}

	if strings.TrimSpace(req.Code) == "" || strings.TrimSpace(req.Name) == "" {
		return nil, fmt.Errorf("%w: code and name are required", apperr.ErrInvalidInput)
	}

	var ft FuelType
	err = s.pool.QueryRow(ctx, `
		INSERT INTO station.fuel_type (tenant_id, code, name, active)
		VALUES ($1, $2, $3, true)
		RETURNING id, tenant_id, code, name, active, created_at, updated_at
	`, tenantID, req.Code, req.Name).Scan(&ft.ID, &ft.TenantID, &ft.Code, &ft.Name, &ft.Active, &ft.CreatedAt, &ft.UpdatedAt)
	if err != nil {
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && pgErr.Code == "23505" {
			return nil, apperr.ErrConflict
		}
		return nil, fmt.Errorf("create fuel type: %w", err)
	}

	return &ft, nil
}

// ------------------------------------------------------------------------------------------------
// TANK SERVICE
// ------------------------------------------------------------------------------------------------

func (s *Service) ListTanks(ctx context.Context, q TankListQuery) ([]Tank, int, error) {
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

	where := []string{"t.tenant_id = $1"}
	args := []any{tenantID}
	argIdx := 2
	authz.AddBranchScope(ctx, "t.branch_id", &where, &args, &argIdx)

	if q.Search != "" {
		where = append(where, fmt.Sprintf("(t.code ILIKE $%d OR t.name ILIKE $%d)", argIdx, argIdx))
		args = append(args, "%"+q.Search+"%")
		argIdx++
	}

	if q.BranchID != "" {
		where = append(where, fmt.Sprintf("t.branch_id = $%d", argIdx))
		args = append(args, q.BranchID)
		argIdx++
	}

	if q.Status != "" {
		where = append(where, fmt.Sprintf("t.status = $%d", argIdx))
		args = append(args, q.Status)
		argIdx++
	}

	whereClause := strings.Join(where, " AND ")

	countQuery := fmt.Sprintf("SELECT COUNT(*) FROM station.tank t WHERE %s", whereClause)
	var total int
	if err := s.pool.QueryRow(ctx, countQuery, args...).Scan(&total); err != nil {
		return nil, 0, fmt.Errorf("count tanks: %w", err)
	}

	query := fmt.Sprintf(`
		SELECT t.id, t.tenant_id, t.branch_id, b.name AS branch_name,
		       t.code, t.name, t.fuel_type_id, ft.name AS fuel_type_name,
		       t.design_capacity_ml, t.max_usable_capacity_ml, t.low_stock_threshold_ml,
		       t.loss_tolerance_pct, t.status,
		       COALESCE((
		           SELECT balance_after_ml 
		           FROM station.stock_ledger sl 
		           WHERE sl.tank_id = t.id 
		           ORDER BY sl.seq DESC LIMIT 1
		       ), 0) AS current_stock_ml,
		       t.created_at, t.updated_at
		FROM station.tank t
		JOIN station.branch b ON b.id = t.branch_id AND b.tenant_id = t.tenant_id
		JOIN station.fuel_type ft ON ft.id = t.fuel_type_id AND ft.tenant_id = t.tenant_id
		WHERE %s
		ORDER BY t.created_at DESC
		LIMIT $%d OFFSET $%d
	`, whereClause, argIdx, argIdx+1)
	args = append(args, q.PageSize, offset)

	rows, err := s.pool.Query(ctx, query, args...)
	if err != nil {
		return nil, 0, fmt.Errorf("query tanks: %w", err)
	}
	defer rows.Close()

	var tanks []Tank
	for rows.Next() {
		var tk Tank
		if err := rows.Scan(
			&tk.ID, &tk.TenantID, &tk.BranchID, &tk.BranchName,
			&tk.Code, &tk.Name, &tk.FuelTypeID, &tk.FuelTypeName,
			&tk.DesignCapacityML, &tk.MaxUsableCapacityML, &tk.LowStockThresholdML,
			&tk.LossTolerancePct, &tk.Status, &tk.CurrentStockML,
			&tk.CreatedAt, &tk.UpdatedAt,
		); err != nil {
			return nil, 0, fmt.Errorf("scan tank: %w", err)
		}
		tanks = append(tanks, tk)
	}

	return tanks, total, nil
}

func (s *Service) GetTank(ctx context.Context, id string) (*Tank, error) {
	tenantID, err := getTenant(ctx)
	if err != nil {
		return nil, err
	}

	if err := authz.EnsureRecordInScope(ctx, s.pool, "station.tank", id); err != nil {
		return nil, err
	}

	query := `
		SELECT t.id, t.tenant_id, t.branch_id, b.name AS branch_name,
		       t.code, t.name, t.fuel_type_id, ft.name AS fuel_type_name,
		       t.design_capacity_ml, t.max_usable_capacity_ml, t.low_stock_threshold_ml,
		       t.loss_tolerance_pct, t.status,
		       COALESCE((
		           SELECT balance_after_ml 
		           FROM station.stock_ledger sl 
		           WHERE sl.tank_id = t.id 
		           ORDER BY sl.seq DESC LIMIT 1
		       ), 0) AS current_stock_ml,
		       t.created_at, t.updated_at
		FROM station.tank t
		JOIN station.branch b ON b.id = t.branch_id AND b.tenant_id = t.tenant_id
		JOIN station.fuel_type ft ON ft.id = t.fuel_type_id AND ft.tenant_id = t.tenant_id
		WHERE t.tenant_id = $1 AND t.id = $2
	`
	var tk Tank
	err = s.pool.QueryRow(ctx, query, tenantID, id).Scan(
		&tk.ID, &tk.TenantID, &tk.BranchID, &tk.BranchName,
		&tk.Code, &tk.Name, &tk.FuelTypeID, &tk.FuelTypeName,
		&tk.DesignCapacityML, &tk.MaxUsableCapacityML, &tk.LowStockThresholdML,
		&tk.LossTolerancePct, &tk.Status, &tk.CurrentStockML,
		&tk.CreatedAt, &tk.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, apperr.ErrNotFound
		}
		return nil, fmt.Errorf("get tank: %w", err)
	}

	return &tk, nil
}

func (s *Service) CreateTank(ctx context.Context, req CreateTankRequest) (*Tank, error) {
	tenantID, err := getTenant(ctx)
	if err != nil {
		return nil, err
	}

	if err := authz.EnsureBranch(ctx, req.BranchID); err != nil {
		return nil, err
	}

	if strings.TrimSpace(req.Code) == "" || strings.TrimSpace(req.Name) == "" || req.BranchID == "" || req.FuelTypeID == "" {
		return nil, fmt.Errorf("%w: code, name, branch_id and fuel_type_id are required", apperr.ErrInvalidInput)
	}
	if req.DesignCapacityML <= 0 {
		return nil, fmt.Errorf("%w: design_capacity_ml must be > 0", apperr.ErrInvalidInput)
	}
	if req.MaxUsableCapacityML <= 0 || req.MaxUsableCapacityML > req.DesignCapacityML {
		req.MaxUsableCapacityML = req.DesignCapacityML
	}
	if req.LowStockThresholdML < 0 || req.LowStockThresholdML > req.MaxUsableCapacityML {
		req.LowStockThresholdML = req.MaxUsableCapacityML / 10 // default 10%
	}
	if req.LossTolerancePct <= 0 {
		req.LossTolerancePct = 0.5
	}

	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return nil, fmt.Errorf("begin tx: %w", err)
	}
	defer tx.Rollback(ctx)

	var tk Tank
	insertQuery := `
		INSERT INTO station.tank (
			tenant_id, branch_id, code, name, fuel_type_id,
			design_capacity_ml, max_usable_capacity_ml, low_stock_threshold_ml, loss_tolerance_pct, status
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'active')
		RETURNING id, tenant_id, branch_id, code, name, fuel_type_id,
		          design_capacity_ml, max_usable_capacity_ml, low_stock_threshold_ml, loss_tolerance_pct,
		          status, created_at, updated_at
	`
	err = tx.QueryRow(
		ctx, insertQuery,
		tenantID, req.BranchID, req.Code, req.Name, req.FuelTypeID,
		req.DesignCapacityML, req.MaxUsableCapacityML, req.LowStockThresholdML, req.LossTolerancePct,
	).Scan(
		&tk.ID, &tk.TenantID, &tk.BranchID, &tk.Code, &tk.Name, &tk.FuelTypeID,
		&tk.DesignCapacityML, &tk.MaxUsableCapacityML, &tk.LowStockThresholdML, &tk.LossTolerancePct,
		&tk.Status, &tk.CreatedAt, &tk.UpdatedAt,
	)
	if err != nil {
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && pgErr.Code == "23505" {
			return nil, apperr.ErrConflict
		}
		return nil, fmt.Errorf("insert tank: %w", err)
	}

	// Insert opening stock balance if provided
	if req.OpeningStockML > 0 {
		var createdBy *uuid.UUID
		if p, ok := authz.FromContext(ctx); ok && p.UserID != "" {
			if uid, err := uuid.Parse(p.UserID); err == nil {
				createdBy = &uid
			}
		}
		_, err = tx.Exec(ctx, `
			INSERT INTO station.stock_ledger (tenant_id, tank_id, occurred_at, kind, delta_ml, note, created_by)
			VALUES ($1, $2, now(), 'opening', $3, 'Tồn đầu kỳ khởi tạo bể', $4)
		`, tenantID, tk.ID, req.OpeningStockML, createdBy)
		if err != nil {
			return nil, fmt.Errorf("insert opening stock ledger: %w", err)
		}
		tk.CurrentStockML = req.OpeningStockML
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("commit tx: %w", err)
	}

	parsedID, _ := uuid.Parse(tk.ID)
	_ = audit.Record(ctx, s.pool, audit.Entry{
		Action:     audit.ActionCreate,
		EntityType: "tank",
		EntityID:   &parsedID,
		EntityCode: tk.Code,
		NewData: map[string]any{
			"name": tk.Name, "code": tk.Code,
			"design_capacity_l": tk.DesignCapacityML / 1000,
			"opening_stock_l":   req.OpeningStockML / 1000,
		},
	})

	return &tk, nil
}

func (s *Service) UpdateTank(ctx context.Context, id string, req UpdateTankRequest) (*Tank, error) {
	tenantID, err := getTenant(ctx)
	if err != nil {
		return nil, err
	}

	if err := authz.EnsureRecordInScope(ctx, s.pool, "station.tank", id); err != nil {
		return nil, err
	}

	if strings.TrimSpace(req.Name) == "" {
		return nil, fmt.Errorf("%w: name is required", apperr.ErrInvalidInput)
	}

	query := `
		UPDATE station.tank
		SET name = $3, fuel_type_id = $4, design_capacity_ml = $5,
		    max_usable_capacity_ml = $6, low_stock_threshold_ml = $7,
		    loss_tolerance_pct = $8, status = $9, updated_at = now()
		WHERE tenant_id = $1 AND id = $2
		RETURNING id, tenant_id, branch_id, code, name, fuel_type_id,
		          design_capacity_ml, max_usable_capacity_ml, low_stock_threshold_ml, loss_tolerance_pct,
		          status, created_at, updated_at
	`
	var tk Tank
	err = s.pool.QueryRow(
		ctx, query,
		tenantID, id, req.Name, req.FuelTypeID, req.DesignCapacityML,
		req.MaxUsableCapacityML, req.LowStockThresholdML, req.LossTolerancePct, req.Status,
	).Scan(
		&tk.ID, &tk.TenantID, &tk.BranchID, &tk.Code, &tk.Name, &tk.FuelTypeID,
		&tk.DesignCapacityML, &tk.MaxUsableCapacityML, &tk.LowStockThresholdML, &tk.LossTolerancePct,
		&tk.Status, &tk.CreatedAt, &tk.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, apperr.ErrNotFound
		}
		return nil, fmt.Errorf("update tank: %w", err)
	}

	parsedID, _ := uuid.Parse(tk.ID)
	_ = audit.Record(ctx, s.pool, audit.Entry{
		Action:     audit.ActionUpdate,
		EntityType: "tank",
		EntityID:   &parsedID,
		EntityCode: tk.Code,
		NewData:    map[string]any{"name": tk.Name, "status": tk.Status},
	})

	return &tk, nil
}

func (s *Service) DeleteTank(ctx context.Context, id string) error {
	tenantID, err := getTenant(ctx)
	if err != nil {
		return err
	}

	if err := authz.EnsureRecordInScope(ctx, s.pool, "station.tank", id); err != nil {
		return err
	}

	var code, name string
	err = s.pool.QueryRow(ctx, `
		UPDATE station.tank
		SET status = 'inactive', updated_at = now()
		WHERE tenant_id = $1 AND id = $2
		RETURNING code, name
	`, tenantID, id).Scan(&code, &name)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return apperr.ErrNotFound
		}
		return fmt.Errorf("deactivate tank: %w", err)
	}

	parsedID, _ := uuid.Parse(id)
	_ = audit.Record(ctx, s.pool, audit.Entry{
		Action:     audit.ActionDelete,
		EntityType: "tank",
		EntityID:   &parsedID,
		EntityCode: code,
		NewData:    map[string]any{"status": "inactive", "name": name},
	})

	return nil
}

// ------------------------------------------------------------------------------------------------
// PUMP, NOZZLE & DEVICE SERVICE
// ------------------------------------------------------------------------------------------------

func (s *Service) ListPumps(ctx context.Context, q PumpListQuery) ([]PumpDetail, int, error) {
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

	where := []string{"p.tenant_id = $1"}
	args := []any{tenantID}
	argIdx := 2
	authz.AddBranchScope(ctx, "p.branch_id", &where, &args, &argIdx)

	if q.Search != "" {
		where = append(where, fmt.Sprintf("(p.code ILIKE $%d OR p.name ILIKE $%d)", argIdx, argIdx))
		args = append(args, "%"+q.Search+"%")
		argIdx++
	}

	if q.BranchID != "" {
		where = append(where, fmt.Sprintf("p.branch_id = $%d", argIdx))
		args = append(args, q.BranchID)
		argIdx++
	}

	if q.Enabled != nil {
		where = append(where, fmt.Sprintf("p.enabled = $%d", argIdx))
		args = append(args, *q.Enabled)
		argIdx++
	}

	whereClause := strings.Join(where, " AND ")

	var total int
	countQuery := fmt.Sprintf("SELECT COUNT(*) FROM station.pump p WHERE %s", whereClause)
	if err := s.pool.QueryRow(ctx, countQuery, args...).Scan(&total); err != nil {
		return nil, 0, fmt.Errorf("count pumps: %w", err)
	}

	query := fmt.Sprintf(`
		SELECT p.id, p.tenant_id, p.branch_id, b.name AS branch_name,
		       p.code, p.edge_pump_id, p.name, p.note, p.enabled, p.version,
		       p.created_at, p.updated_at
		FROM station.pump p
		JOIN station.branch b ON b.id = p.branch_id AND b.tenant_id = p.tenant_id
		WHERE %s
		ORDER BY p.edge_pump_id ASC
		LIMIT $%d OFFSET $%d
	`, whereClause, argIdx, argIdx+1)
	args = append(args, q.PageSize, offset)

	rows, err := s.pool.Query(ctx, query, args...)
	if err != nil {
		return nil, 0, fmt.Errorf("query pumps: %w", err)
	}
	defer rows.Close()

	var pumps []PumpDetail
	for rows.Next() {
		var p PumpDetail
		if err := rows.Scan(
			&p.ID, &p.TenantID, &p.BranchID, &p.BranchName,
			&p.Code, &p.EdgePumpID, &p.Name, &p.Note, &p.Enabled, &p.Version,
			&p.CreatedAt, &p.UpdatedAt,
		); err != nil {
			return nil, 0, fmt.Errorf("scan pump: %w", err)
		}
		pumps = append(pumps, p)
	}

	// Fetch Nozzles, Sensors and Terminals for pumps
	for i := range pumps {
		p := &pumps[i]
		// Nozzles
		nRows, err := s.pool.Query(ctx, `
			SELECT n.id, n.tenant_id, n.pump_id, n.nozzle_no, n.tank_id, t.name AS tank_name, n.status, n.created_at, n.updated_at
			FROM station.nozzle n
			JOIN station.tank t ON t.id = n.tank_id AND t.tenant_id = n.tenant_id
			WHERE n.tenant_id = $1 AND n.pump_id = $2
			ORDER BY n.nozzle_no ASC
		`, tenantID, p.ID)
		if err == nil {
			for nRows.Next() {
				var n Nozzle
				_ = nRows.Scan(&n.ID, &n.TenantID, &n.PumpID, &n.NozzleNo, &n.TankID, &n.TankName, &n.Status, &n.CreatedAt, &n.UpdatedAt)
				p.Nozzles = append(p.Nozzles, n)
			}
			nRows.Close()
		}

		// Sensor
		var ps PumpSensor
		err = s.pool.QueryRow(ctx, `
			SELECT id, tenant_id, pump_id, name, serial, com_port, baud, version, created_at, updated_at
			FROM station.pump_sensor
			WHERE tenant_id = $1 AND pump_id = $2
		`, tenantID, p.ID).Scan(&ps.ID, &ps.TenantID, &ps.PumpID, &ps.Name, &ps.Serial, &ps.ComPort, &ps.Baud, &ps.Version, &ps.CreatedAt, &ps.UpdatedAt)
		if err == nil {
			p.Sensor = &ps
		}

		// Terminal
		var at AccessTerminal
		err = s.pool.QueryRow(ctx, `
			SELECT id, tenant_id, pump_id, terminal_code, host, port, https, username, version, created_at, updated_at
			FROM station.access_terminal
			WHERE tenant_id = $1 AND pump_id = $2
		`, tenantID, p.ID).Scan(&at.ID, &at.TenantID, &at.PumpID, &at.TerminalCode, &at.Host, &at.Port, &at.HTTPS, &at.Username, &at.Version, &at.CreatedAt, &at.UpdatedAt)
		if err == nil {
			at.HasPassword = true
			p.Terminal = &at
		}
	}

	return pumps, total, nil
}

func (s *Service) CreatePump(ctx context.Context, req CreatePumpRequest) (*PumpDetail, error) {
	tenantID, err := getTenant(ctx)
	if err != nil {
		return nil, err
	}

	if err := authz.EnsureBranch(ctx, req.BranchID); err != nil {
		return nil, err
	}

	if strings.TrimSpace(req.Name) == "" || req.BranchID == "" || req.TankID == "" {
		return nil, fmt.Errorf("%w: name, branch_id and tank_id are required", apperr.ErrInvalidInput)
	}

	// Auto generate edge_pump_id if not provided or <= 0
	if req.EdgePumpID <= 0 {
		var maxID *int64
		_ = s.pool.QueryRow(ctx, `
			SELECT MAX(edge_pump_id) FROM station.pump WHERE tenant_id = $1 AND branch_id = $2
		`, tenantID, req.BranchID).Scan(&maxID)
		if maxID != nil {
			req.EdgePumpID = *maxID + 1
		} else {
			req.EdgePumpID = 1
		}
	}

	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return nil, fmt.Errorf("begin tx: %w", err)
	}
	defer tx.Rollback(ctx)

	// Mã trụ do hệ thống sinh (không nhận từ client), dạng TR-2026-0001.
	if err := tx.QueryRow(ctx, `SELECT station.next_code($1, 'TR')`, tenantID).Scan(&req.Code); err != nil {
		return nil, fmt.Errorf("generate pump code: %w", err)
	}

	var p PumpDetail
	query := `
		INSERT INTO station.pump (tenant_id, branch_id, code, edge_pump_id, name, note, enabled)
		VALUES ($1, $2, $3, $4, $5, $6, true)
		RETURNING id, tenant_id, branch_id, code, edge_pump_id, name, note, enabled, version, created_at, updated_at
	`
	err = tx.QueryRow(ctx, query, tenantID, req.BranchID, req.Code, req.EdgePumpID, req.Name, req.Note).Scan(
		&p.ID, &p.TenantID, &p.BranchID, &p.Code, &p.EdgePumpID, &p.Name, &p.Note, &p.Enabled, &p.Version, &p.CreatedAt, &p.UpdatedAt,
	)
	if err != nil {
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && pgErr.Code == "23505" {
			return nil, apperr.ErrConflict
		}
		return nil, fmt.Errorf("insert pump: %w", err)
	}

	// Create default nozzle attached to tank
	var n Nozzle
	err = tx.QueryRow(ctx, `
		INSERT INTO station.nozzle (tenant_id, pump_id, nozzle_no, tank_id, status)
		VALUES ($1, $2, 1, $3, 'active')
		RETURNING id, tenant_id, pump_id, nozzle_no, tank_id, status, created_at, updated_at
	`, tenantID, p.ID, req.TankID).Scan(&n.ID, &n.TenantID, &n.PumpID, &n.NozzleNo, &n.TankID, &n.Status, &n.CreatedAt, &n.UpdatedAt)
	if err != nil {
		return nil, fmt.Errorf("insert nozzle: %w", err)
	}
	p.Nozzles = append(p.Nozzles, n)

	// Bộ số: cổng COM bắt buộc (mỗi trụ một cổng riêng trong trạm xăng), serial mặc định 1234, baud mặc định 9600
	if req.SensorComPort == nil || strings.TrimSpace(*req.SensorComPort) == "" {
		return nil, fmt.Errorf("%w: sensor_com_port is required (each pump needs its own COM port)", apperr.ErrInvalidInput)
	}
	comPort := strings.TrimSpace(*req.SensorComPort)
	sensorName := "BS-" + req.Code
	if req.SensorName != nil && strings.TrimSpace(*req.SensorName) != "" {
		sensorName = strings.TrimSpace(*req.SensorName)
	}
	var serial uint32 = 1234
	if req.SensorSerial != nil {
		serial = *req.SensorSerial
	}
	// Tốc độ baud của bộ số Montech cố định theo phần cứng, không nhận từ client.
	const baud = sensorBaud

	var ps PumpSensor
	err = tx.QueryRow(ctx, `
		INSERT INTO station.pump_sensor (tenant_id, pump_id, branch_id, name, serial, com_port, baud)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
		RETURNING id, tenant_id, pump_id, name, serial, com_port, baud, version, created_at, updated_at
	`, tenantID, p.ID, req.BranchID, sensorName, serial, comPort, baud).Scan(
		&ps.ID, &ps.TenantID, &ps.PumpID, &ps.Name, &ps.Serial, &ps.ComPort, &ps.Baud, &ps.Version, &ps.CreatedAt, &ps.UpdatedAt,
	)
	if err != nil {
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && pgErr.Code == "23505" {
			return nil, fmt.Errorf("%w: COM port %s is already used by another pump in this store", apperr.ErrConflict, comPort)
		}
		return nil, fmt.Errorf("insert sensor: %w", err)
	}
	p.Sensor = &ps

	// Create terminal (mặc định: mã theo mã trụ, 192.168.1.100, 80, admin).
	// Mã máy chấm công là duy nhất toàn công ty nên không thể dùng số thứ tự trụ (trụ 1 của trạm xăng khác sẽ trùng).
	termCode := "T-" + req.Code
	if req.TerminalCode != nil && *req.TerminalCode != "" {
		termCode = *req.TerminalCode
	}
	host := "192.168.1.100"
	if req.TerminalHost != nil && *req.TerminalHost != "" {
		host = *req.TerminalHost
	}
	// Cổng máy chấm công Hikvision cố định 80, không nhận từ client.
	const port = terminalPort
	https := false
	if req.TerminalHTTPS != nil {
		https = *req.TerminalHTTPS
	}
	username := "admin"
	if req.TerminalUsername != nil && *req.TerminalUsername != "" {
		username = *req.TerminalUsername
	}
	rawPass := "Admin@123"
	if req.TerminalPassword != nil && *req.TerminalPassword != "" {
		rawPass = *req.TerminalPassword
	}
	encPass, err := crypto.EncryptAESGCM([]byte(rawPass), s.cryptoKey)
	if err != nil {
		return nil, fmt.Errorf("encrypt terminal password: %w", err)
	}

	var at AccessTerminal
	err = tx.QueryRow(ctx, `
		INSERT INTO station.access_terminal (tenant_id, pump_id, terminal_code, host, port, https, username, password_enc)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
		RETURNING id, tenant_id, pump_id, terminal_code, host, port, https, username, version, created_at, updated_at
	`, tenantID, p.ID, termCode, host, port, https, username, encPass).Scan(
		&at.ID, &at.TenantID, &at.PumpID, &at.TerminalCode, &at.Host, &at.Port, &at.HTTPS, &at.Username, &at.Version, &at.CreatedAt, &at.UpdatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("insert terminal: %w", err)
	}
	at.HasPassword = true
	p.Terminal = &at

	if err := tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("commit pump tx: %w", err)
	}

	parsedID, _ := uuid.Parse(p.ID)
	_ = audit.Record(ctx, s.pool, audit.Entry{
		Action:     audit.ActionCreate,
		EntityType: "pump",
		EntityID:   &parsedID,
		EntityCode: p.Code,
		NewData: map[string]any{
			"name": p.Name, "code": p.Code, "edge_pump_id": p.EdgePumpID,
		},
	})

	return &p, nil
}

func (s *Service) UpdatePump(ctx context.Context, id string, req UpdatePumpRequest) (*PumpDetail, error) {
	tenantID, err := getTenant(ctx)
	if err != nil {
		return nil, err
	}

	if err := authz.EnsureRecordInScope(ctx, s.pool, "station.pump", id); err != nil {
		return nil, err
	}

	if strings.TrimSpace(req.Name) == "" {
		return nil, fmt.Errorf("%w: name is required", apperr.ErrInvalidInput)
	}

	var p PumpDetail
	err = s.pool.QueryRow(ctx, `
		UPDATE station.pump
		SET name = $3, note = $4, enabled = $5, updated_at = now()
		WHERE tenant_id = $1 AND id = $2
		RETURNING id, tenant_id, branch_id, code, edge_pump_id, name, note, enabled, version, created_at, updated_at
	`, tenantID, id, req.Name, req.Note, req.Enabled).Scan(
		&p.ID, &p.TenantID, &p.BranchID, &p.Code, &p.EdgePumpID, &p.Name, &p.Note, &p.Enabled, &p.Version, &p.CreatedAt, &p.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, apperr.ErrNotFound
		}
		return nil, fmt.Errorf("update pump: %w", err)
	}

	parsedID, _ := uuid.Parse(p.ID)
	_ = audit.Record(ctx, s.pool, audit.Entry{
		Action:     audit.ActionUpdate,
		EntityType: "pump",
		EntityID:   &parsedID,
		EntityCode: p.Code,
		NewData:    map[string]any{"name": p.Name, "enabled": p.Enabled},
	})

	return &p, nil
}

func (s *Service) DeletePump(ctx context.Context, id string) error {
	tenantID, err := getTenant(ctx)
	if err != nil {
		return err
	}

	if err := authz.EnsureRecordInScope(ctx, s.pool, "station.pump", id); err != nil {
		return err
	}

	var code, name string
	err = s.pool.QueryRow(ctx, `
		UPDATE station.pump
		SET enabled = false, updated_at = now()
		WHERE tenant_id = $1 AND id = $2
		RETURNING code, name
	`, tenantID, id).Scan(&code, &name)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return apperr.ErrNotFound
		}
		return fmt.Errorf("deactivate pump: %w", err)
	}

	parsedID, _ := uuid.Parse(id)
	_ = audit.Record(ctx, s.pool, audit.Entry{
		Action:     audit.ActionDelete,
		EntityType: "pump",
		EntityID:   &parsedID,
		EntityCode: code,
		NewData:    map[string]any{"enabled": false, "name": name},
	})

	return nil
}

// ------------------------------------------------------------------------------------------------
// DEVICE SERVICE
// ------------------------------------------------------------------------------------------------

func (s *Service) ListDevices(ctx context.Context, branchID string) ([]DeviceView, error) {
	tenantID, err := getTenant(ctx)
	if err != nil {
		return nil, err
	}

	where := []string{"p.tenant_id = $1"}
	args := []any{tenantID}
	argIdx := 2
	authz.AddBranchScope(ctx, "p.branch_id", &where, &args, &argIdx)
	if branchID != "" {
		where = append(where, fmt.Sprintf("p.branch_id = $%d", argIdx))
		args = append(args, branchID)
	}

	query := fmt.Sprintf(`
		SELECT p.id, p.code, p.name, p.branch_id, b.name AS branch_name
		FROM station.pump p
		JOIN station.branch b ON b.id = p.branch_id AND b.tenant_id = p.tenant_id
		WHERE %s
		ORDER BY p.edge_pump_id ASC
	`, strings.Join(where, " AND "))

	rows, err := s.pool.Query(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("query devices: %w", err)
	}
	defer rows.Close()

	var devices []DeviceView
	for rows.Next() {
		var d DeviceView
		if err := rows.Scan(&d.PumpID, &d.PumpCode, &d.PumpName, &d.BranchID, &d.BranchName); err != nil {
			return nil, fmt.Errorf("scan device: %w", err)
		}
		devices = append(devices, d)
	}

	for i := range devices {
		d := &devices[i]
		// Sensor
		var ps PumpSensor
		err := s.pool.QueryRow(ctx, `
			SELECT id, tenant_id, pump_id, name, serial, com_port, baud, version, created_at, updated_at
			FROM station.pump_sensor
			WHERE tenant_id = $1 AND pump_id = $2
		`, tenantID, d.PumpID).Scan(&ps.ID, &ps.TenantID, &ps.PumpID, &ps.Name, &ps.Serial, &ps.ComPort, &ps.Baud, &ps.Version, &ps.CreatedAt, &ps.UpdatedAt)
		if err == nil {
			d.Sensor = &ps
		}

		// Terminal
		var at AccessTerminal
		err = s.pool.QueryRow(ctx, `
			SELECT id, tenant_id, pump_id, terminal_code, host, port, https, username, version, created_at, updated_at
			FROM station.access_terminal
			WHERE tenant_id = $1 AND pump_id = $2
		`, tenantID, d.PumpID).Scan(&at.ID, &at.TenantID, &at.PumpID, &at.TerminalCode, &at.Host, &at.Port, &at.HTTPS, &at.Username, &at.Version, &at.CreatedAt, &at.UpdatedAt)
		if err == nil {
			at.HasPassword = true
			d.Terminal = &at
		}
	}

	return devices, nil
}

func (s *Service) UpdateSensor(ctx context.Context, pumpID string, req UpdateSensorRequest) (*PumpSensor, error) {
	tenantID, err := getTenant(ctx)
	if err != nil {
		return nil, err
	}

	if err := authz.EnsureRecordInScope(ctx, s.pool, "station.pump", pumpID); err != nil {
		return nil, err
	}

	if strings.TrimSpace(req.ComPort) == "" {
		return nil, fmt.Errorf("%w: com_port is required", apperr.ErrInvalidInput)
	}
	req.Baud = sensorBaud

	var ps PumpSensor
	err = s.pool.QueryRow(ctx, `
		UPDATE station.pump_sensor
		SET name = COALESCE(NULLIF(btrim($6), ''), name), serial = $3, com_port = $4, baud = $5, updated_at = now()
		WHERE tenant_id = $1 AND pump_id = $2
		RETURNING id, tenant_id, pump_id, name, serial, com_port, baud, version, created_at, updated_at
	`, tenantID, pumpID, req.Serial, strings.TrimSpace(req.ComPort), req.Baud, req.Name).Scan(
		&ps.ID, &ps.TenantID, &ps.PumpID, &ps.Name, &ps.Serial, &ps.ComPort, &ps.Baud, &ps.Version, &ps.CreatedAt, &ps.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, apperr.ErrNotFound
		}
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && pgErr.Code == "23505" {
			return nil, fmt.Errorf("%w: COM port %s is already used by another pump in this store", apperr.ErrConflict, req.ComPort)
		}
		return nil, fmt.Errorf("update sensor: %w", err)
	}

	parsedID, _ := uuid.Parse(ps.ID)
	_ = audit.Record(ctx, s.pool, audit.Entry{
		Action:     audit.ActionUpdate,
		EntityType: "pump_sensor",
		EntityID:   &parsedID,
		EntityCode: fmt.Sprintf("COM-%d", ps.Serial),
		NewData: map[string]any{
			"com_port": ps.ComPort, "baud": ps.Baud, "serial": ps.Serial,
		},
	})

	return &ps, nil
}

func (s *Service) UpdateTerminal(ctx context.Context, pumpID string, req UpdateTerminalRequest) (*AccessTerminal, error) {
	tenantID, err := getTenant(ctx)
	if err != nil {
		return nil, err
	}

	if err := authz.EnsureRecordInScope(ctx, s.pool, "station.pump", pumpID); err != nil {
		return nil, err
	}

	if strings.TrimSpace(req.TerminalCode) == "" || strings.TrimSpace(req.Host) == "" || strings.TrimSpace(req.Username) == "" {
		return nil, fmt.Errorf("%w: terminal_code, host, and username are required", apperr.ErrInvalidInput)
	}
	req.Port = terminalPort

	var at AccessTerminal
	if req.Password != nil && *req.Password != "" {
		encPass, err := crypto.EncryptAESGCM([]byte(*req.Password), s.cryptoKey)
		if err != nil {
			return nil, fmt.Errorf("encrypt password: %w", err)
		}

		err = s.pool.QueryRow(ctx, `
			UPDATE station.access_terminal
			SET terminal_code = $3, host = $4, port = $5, https = $6, username = $7, password_enc = $8, updated_at = now()
			WHERE tenant_id = $1 AND pump_id = $2
			RETURNING id, tenant_id, pump_id, terminal_code, host, port, https, username, version, created_at, updated_at
		`, tenantID, pumpID, req.TerminalCode, req.Host, req.Port, req.HTTPS, req.Username, encPass).Scan(
			&at.ID, &at.TenantID, &at.PumpID, &at.TerminalCode, &at.Host, &at.Port, &at.HTTPS, &at.Username, &at.Version, &at.CreatedAt, &at.UpdatedAt,
		)
		if err != nil {
			if errors.Is(err, pgx.ErrNoRows) {
				return nil, apperr.ErrNotFound
			}
			return nil, fmt.Errorf("update terminal with pass: %w", err)
		}
	} else {
		err = s.pool.QueryRow(ctx, `
			UPDATE station.access_terminal
			SET terminal_code = $3, host = $4, port = $5, https = $6, username = $7, updated_at = now()
			WHERE tenant_id = $1 AND pump_id = $2
			RETURNING id, tenant_id, pump_id, terminal_code, host, port, https, username, version, created_at, updated_at
		`, tenantID, pumpID, req.TerminalCode, req.Host, req.Port, req.HTTPS, req.Username).Scan(
			&at.ID, &at.TenantID, &at.PumpID, &at.TerminalCode, &at.Host, &at.Port, &at.HTTPS, &at.Username, &at.Version, &at.CreatedAt, &at.UpdatedAt,
		)
		if err != nil {
			if errors.Is(err, pgx.ErrNoRows) {
				return nil, apperr.ErrNotFound
			}
			return nil, fmt.Errorf("update terminal: %w", err)
		}
	}
	at.HasPassword = true

	parsedID, _ := uuid.Parse(at.ID)
	_ = audit.Record(ctx, s.pool, audit.Entry{
		Action:     audit.ActionUpdate,
		EntityType: "access_terminal",
		EntityID:   &parsedID,
		EntityCode: at.TerminalCode,
		NewData: map[string]any{
			"terminal_code": at.TerminalCode, "host": at.Host, "port": at.Port,
		},
	})

	return &at, nil
}
