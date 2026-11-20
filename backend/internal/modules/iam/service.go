package iam

import (
	"context"
	"errors"
	"fmt"
	"net/mail"
	"regexp"
	"strings"

	"fuel-station-backend/internal/platform/crypto"
	"fuel-station-backend/internal/shared/apperr"
	"fuel-station-backend/internal/shared/audit"
	"fuel-station-backend/internal/shared/authz"
	"fuel-station-backend/internal/shared/middleware"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

var (
	rxEmployeeCode = regexp.MustCompile(`^[A-Za-z0-9_-]{1,32}$`)
	rxUsername     = regexp.MustCompile(`^[A-Za-z0-9._@-]{3,64}$`)
	rxRoleCode     = regexp.MustCompile(`^[A-Za-z0-9_-]{2,32}$`)
)

type Service struct {
	pool *pgxpool.Pool
}

func NewService(pool *pgxpool.Pool) *Service {
	return &Service{pool: pool}
}

func getTenantAndActor(ctx context.Context) (tenantID, actorUserID uuid.UUID, actorName string, err error) {
	tenantIDStr, ok := middleware.TenantIDFromContext(ctx)
	if !ok || tenantIDStr == "" {
		return uuid.Nil, uuid.Nil, "", fmt.Errorf("%w: tenant_id missing in context", apperr.ErrUnauthorized)
	}
	tID, err := uuid.Parse(tenantIDStr)
	if err != nil {
		return uuid.Nil, uuid.Nil, "", fmt.Errorf("%w: invalid tenant_id in context", apperr.ErrUnauthorized)
	}

	p, ok := authz.FromContext(ctx)
	if !ok || p.UserID == "" {
		return tID, uuid.Nil, "system", nil
	}
	uID, err := uuid.Parse(p.UserID)
	if err != nil {
		return tID, uuid.Nil, "system", nil
	}

	return tID, uID, p.RoleCode, nil
}

// ------------------------------------------------------------------------------------------------
// USER SERVICES
// ------------------------------------------------------------------------------------------------

func (s *Service) ListUsers(ctx context.Context, q UserListQuery) (*PagedResponse[UserListItem], error) {
	tenantID, _, _, err := getTenantAndActor(ctx)
	if err != nil {
		return nil, err
	}

	if q.Page < 1 {
		q.Page = 1
	}
	if q.PageSize < 1 || q.PageSize > 100 {
		q.PageSize = 20
	}
	offset := (q.Page - 1) * q.PageSize

	whereClauses := []string{
		"u.tenant_id = $1",
		"u.deleted_at IS NULL",
	}
	args := []any{tenantID}
	argIdx := 2

	if q.Search != "" {
		searchPattern := "%" + strings.TrimSpace(q.Search) + "%"
		whereClauses = append(whereClauses, fmt.Sprintf(
			"(u.employee_code ILIKE $%d OR u.username ILIKE $%d OR u.full_name ILIKE $%d OR u.email ILIKE $%d)",
			argIdx, argIdx, argIdx, argIdx,
		))
		args = append(args, searchPattern)
		argIdx++
	}

	if q.RoleID != "" {
		roleUUID, err := uuid.Parse(q.RoleID)
		if err == nil {
			whereClauses = append(whereClauses, fmt.Sprintf("u.role_id = $%d", argIdx))
			args = append(args, roleUUID)
			argIdx++
		}
	}

	if q.Status != "" {
		whereClauses = append(whereClauses, fmt.Sprintf("u.status = $%d", argIdx))
		args = append(args, q.Status)
		argIdx++
	}

	whereSQL := strings.Join(whereClauses, " AND ")

	// Count total
	countQuery := fmt.Sprintf("SELECT COUNT(*) FROM station.app_user u WHERE %s", whereSQL)
	var total int
	if err := s.pool.QueryRow(ctx, countQuery, args...).Scan(&total); err != nil {
		return nil, fmt.Errorf("count users: %w", err)
	}

	// Fetch items
	listQuery := fmt.Sprintf(`
		SELECT 
			u.id, u.employee_code, u.full_name, u.email, COALESCE(u.phone, ''), u.username,
			u.role_id, r.code, r.name, u.status, u.must_change_password,
			u.last_login_at, u.created_at, u.updated_at,
			COALESCE(array_agg(b.id) FILTER (WHERE b.id IS NOT NULL), '{}') AS branch_ids,
			COALESCE(array_agg(b.name) FILTER (WHERE b.name IS NOT NULL), '{}') AS branch_names
		FROM station.app_user u
		JOIN station.role r ON r.id = u.role_id AND r.tenant_id = u.tenant_id
		LEFT JOIN station.user_branch ub ON ub.user_id = u.id AND ub.tenant_id = u.tenant_id
		LEFT JOIN station.branch b ON b.id = ub.branch_id AND b.tenant_id = u.tenant_id
		WHERE %s
		GROUP BY u.id, r.code, r.name
		ORDER BY u.created_at DESC
		LIMIT $%d OFFSET $%d
	`, whereSQL, argIdx, argIdx+1)

	args = append(args, q.PageSize, offset)

	rows, err := s.pool.Query(ctx, listQuery, args...)
	if err != nil {
		return nil, fmt.Errorf("list users: %w", err)
	}
	defer rows.Close()

	var items []UserListItem
	for rows.Next() {
		var (
			item         UserListItem
			userUUID     uuid.UUID
			roleUUID     uuid.UUID
			branchUUIDs  []uuid.UUID
			branchNames  []string
		)

		err := rows.Scan(
			&userUUID, &item.EmployeeCode, &item.FullName, &item.Email, &item.Phone, &item.Username,
			&roleUUID, &item.RoleCode, &item.RoleName, &item.Status, &item.MustChangePassword,
			&item.LastLoginAt, &item.CreatedAt, &item.UpdatedAt,
			&branchUUIDs, &branchNames,
		)
		if err != nil {
			return nil, fmt.Errorf("scan user: %w", err)
		}

		item.ID = userUUID.String()
		item.RoleID = roleUUID.String()
		item.BranchIDs = make([]string, len(branchUUIDs))
		for i, b := range branchUUIDs {
			item.BranchIDs[i] = b.String()
		}
		item.BranchNames = branchNames
		items = append(items, item)
	}

	totalPages := (total + q.PageSize - 1) / q.PageSize
	return &PagedResponse[UserListItem]{
		Items:      items,
		Total:      total,
		Page:       q.Page,
		PageSize:   q.PageSize,
		TotalPages: totalPages,
	}, nil
}

func (s *Service) GetUser(ctx context.Context, idStr string) (*UserDetail, error) {
	tenantID, _, _, err := getTenantAndActor(ctx)
	if err != nil {
		return nil, err
	}

	userUUID, err := uuid.Parse(idStr)
	if err != nil {
		return nil, fmt.Errorf("%w: invalid user ID", apperr.ErrInvalidInput)
	}

	var (
		item     UserListItem
		roleUUID uuid.UUID
	)

	query := `
		SELECT 
			u.id, u.employee_code, u.full_name, u.email, COALESCE(u.phone, ''), u.username,
			u.role_id, r.code, r.name, u.status, u.must_change_password,
			u.last_login_at, u.created_at, u.updated_at
		FROM station.app_user u
		JOIN station.role r ON r.id = u.role_id AND r.tenant_id = u.tenant_id
		WHERE u.tenant_id = $1 AND u.id = $2 AND u.deleted_at IS NULL
	`

	err = s.pool.QueryRow(ctx, query, tenantID, userUUID).Scan(
		&userUUID, &item.EmployeeCode, &item.FullName, &item.Email, &item.Phone, &item.Username,
		&roleUUID, &item.RoleCode, &item.RoleName, &item.Status, &item.MustChangePassword,
		&item.LastLoginAt, &item.CreatedAt, &item.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, apperr.ErrNotFound
		}
		return nil, fmt.Errorf("query user: %w", err)
	}

	item.ID = userUUID.String()
	item.RoleID = roleUUID.String()

	// Load branches
	bRows, err := s.pool.Query(ctx, `
		SELECT b.id, b.code, b.name, COALESCE(b.address, '')
		FROM station.user_branch ub
		JOIN station.branch b ON b.id = ub.branch_id AND b.tenant_id = ub.tenant_id
		WHERE ub.tenant_id = $1 AND ub.user_id = $2
	`, tenantID, userUUID)
	if err != nil {
		return nil, fmt.Errorf("load user branches: %w", err)
	}
	defer bRows.Close()

	var branches []BranchOption
	for bRows.Next() {
		var (
			bID   uuid.UUID
			bCode string
			bName string
			bAddr string
		)
		if err := bRows.Scan(&bID, &bCode, &bName, &bAddr); err != nil {
			return nil, err
		}
		branches = append(branches, BranchOption{
			ID:      bID.String(),
			Code:    bCode,
			Name:    bName,
			Address: bAddr,
		})
		item.BranchIDs = append(item.BranchIDs, bID.String())
		item.BranchNames = append(item.BranchNames, bName)
	}

	return &UserDetail{
		UserListItem: item,
		Branches:     branches,
	}, nil
}

func (s *Service) CreateUser(ctx context.Context, req CreateUserRequest) (*UserDetail, error) {
	tenantID, actorUserID, actorName, err := getTenantAndActor(ctx)
	if err != nil {
		return nil, err
	}

	// Validations
	req.EmployeeCode = strings.TrimSpace(req.EmployeeCode)
	if !rxEmployeeCode.MatchString(req.EmployeeCode) {
		return nil, fmt.Errorf("%w: mã nhân viên không hợp lệ (1-32 ký tự chữ, số, gạch ngang, gạch dưới)", apperr.ErrInvalidInput)
	}

	req.Username = strings.TrimSpace(req.Username)
	if !rxUsername.MatchString(req.Username) {
		return nil, fmt.Errorf("%w: tên đăng nhập không hợp lệ (3-64 ký tự)", apperr.ErrInvalidInput)
	}

	req.FullName = strings.TrimSpace(req.FullName)
	if req.FullName == "" {
		return nil, fmt.Errorf("%w: họ và tên không được để trống", apperr.ErrInvalidInput)
	}

	req.Email = strings.TrimSpace(req.Email)
	if _, err := mail.ParseAddress(req.Email); err != nil {
		return nil, fmt.Errorf("%w: email không đúng định dạng", apperr.ErrInvalidInput)
	}

	if len(req.Password) < 8 {
		return nil, fmt.Errorf("%w: mật khẩu khởi tạo phải từ 8 ký tự trở lên", apperr.ErrInvalidInput)
	}

	roleUUID, err := uuid.Parse(req.RoleID)
	if err != nil {
		return nil, fmt.Errorf("%w: vai trò không hợp lệ", apperr.ErrInvalidInput)
	}

	// Verify role exists in tenant
	var roleExists bool
	err = s.pool.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM station.role WHERE tenant_id = $1 AND id = $2)`, tenantID, roleUUID).Scan(&roleExists)
	if err != nil || !roleExists {
		return nil, fmt.Errorf("%w: vai trò không tồn tại trong hệ thống", apperr.ErrNotFound)
	}

	// Check duplicates (code, username, email)
	var dupCode, dupUsername, dupEmail bool
	_ = s.pool.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM station.app_user WHERE tenant_id = $1 AND employee_code = $2 AND deleted_at IS NULL)`, tenantID, req.EmployeeCode).Scan(&dupCode)
	if dupCode {
		return nil, fmt.Errorf("%w: mã nhân viên '%s' đã được sử dụng", apperr.ErrConflict, req.EmployeeCode)
	}

	_ = s.pool.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM station.app_user WHERE tenant_id = $1 AND lower(username) = lower($2) AND deleted_at IS NULL)`, tenantID, req.Username).Scan(&dupUsername)
	if dupUsername {
		return nil, fmt.Errorf("%w: tên đăng nhập '%s' đã tồn tại", apperr.ErrConflict, req.Username)
	}

	_ = s.pool.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM station.app_user WHERE tenant_id = $1 AND lower(email) = lower($2) AND deleted_at IS NULL)`, tenantID, req.Email).Scan(&dupEmail)
	if dupEmail {
		return nil, fmt.Errorf("%w: email '%s' đã được đăng ký", apperr.ErrConflict, req.Email)
	}

	// Hash password with Argon2id
	hashedPassword, err := crypto.HashPassword(req.Password)
	if err != nil {
		return nil, fmt.Errorf("hash password: %w", err)
	}

	newUserID := uuid.New()

	// Transaction to insert user and branches
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return nil, fmt.Errorf("begin tx: %w", err)
	}
	defer tx.Rollback(ctx)

	insertQuery := `
		INSERT INTO station.app_user (
			id, tenant_id, employee_code, full_name, email, phone, username,
			password_hash, role_id, status, must_change_password
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'active', TRUE)
	`
	var phoneParam *string
	if strings.TrimSpace(req.Phone) != "" {
		p := strings.TrimSpace(req.Phone)
		phoneParam = &p
	}

	_, err = tx.Exec(ctx, insertQuery,
		newUserID, tenantID, req.EmployeeCode, req.FullName, req.Email, phoneParam, req.Username,
		hashedPassword, roleUUID,
	)
	if err != nil {
		return nil, fmt.Errorf("insert user: %w", err)
	}

	// Insert branches
	for _, bStr := range req.BranchIDs {
		bUUID, err := uuid.Parse(bStr)
		if err != nil {
			continue
		}
		_, err = tx.Exec(ctx, `
			INSERT INTO station.user_branch (tenant_id, user_id, branch_id)
			VALUES ($1, $2, $3)
			ON CONFLICT DO NOTHING
		`, tenantID, newUserID, bUUID)
		if err != nil {
			return nil, fmt.Errorf("assign branch: %w", err)
		}
	}

	// Audit Log
	err = audit.Record(ctx, tx, audit.Entry{
		Action:      audit.ActionCreate,
		EntityType:  "app_user",
		EntityID:    &newUserID,
		EntityCode:  req.EmployeeCode,
		ActorUserID: &actorUserID,
		ActorName:   actorName,
		NewData: map[string]any{
			"username":      req.Username,
			"employee_code": req.EmployeeCode,
			"full_name":     req.FullName,
			"email":         req.Email,
			"role_id":       roleUUID.String(),
			"branches":      req.BranchIDs,
		},
	})
	if err != nil {
		return nil, fmt.Errorf("record audit: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("commit tx: %w", err)
	}

	return s.GetUser(ctx, newUserID.String())
}

func (s *Service) UpdateUser(ctx context.Context, idStr string, req UpdateUserRequest) (*UserDetail, error) {
	tenantID, actorUserID, actorName, err := getTenantAndActor(ctx)
	if err != nil {
		return nil, err
	}

	userUUID, err := uuid.Parse(idStr)
	if err != nil {
		return nil, fmt.Errorf("%w: invalid user ID", apperr.ErrInvalidInput)
	}

	req.FullName = strings.TrimSpace(req.FullName)
	if req.FullName == "" {
		return nil, fmt.Errorf("%w: họ và tên không được để trống", apperr.ErrInvalidInput)
	}

	req.Email = strings.TrimSpace(req.Email)
	if _, err := mail.ParseAddress(req.Email); err != nil {
		return nil, fmt.Errorf("%w: email không đúng định dạng", apperr.ErrInvalidInput)
	}

	newRoleUUID, err := uuid.Parse(req.RoleID)
	if err != nil {
		return nil, fmt.Errorf("%w: vai trò không hợp lệ", apperr.ErrInvalidInput)
	}

	// Fetch current user data
	var (
		oldFullName     string
		oldEmail        string
		oldPhone        *string
		oldRoleID       uuid.UUID
		oldRoleCode     string
		oldEmployeeCode string
	)
	err = s.pool.QueryRow(ctx, `
		SELECT u.full_name, u.email, u.phone, u.role_id, r.code, u.employee_code
		FROM station.app_user u
		JOIN station.role r ON r.id = u.role_id AND r.tenant_id = u.tenant_id
		WHERE u.tenant_id = $1 AND u.id = $2 AND u.deleted_at IS NULL
	`, tenantID, userUUID).Scan(&oldFullName, &oldEmail, &oldPhone, &oldRoleID, &oldRoleCode, &oldEmployeeCode)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, apperr.ErrNotFound
		}
		return nil, fmt.Errorf("query existing user: %w", err)
	}

	// SAFETY RULE: Prevent self-demotion from MANAGER
	if userUUID == actorUserID && oldRoleCode == "MANAGER" && oldRoleID != newRoleUUID {
		return nil, fmt.Errorf("%w: bạn không thể tự hạ quyền Quản lý của chính mình", apperr.ErrForbidden)
	}

	// SAFETY RULE: Prevent demoting the last active MANAGER in tenant
	if oldRoleCode == "MANAGER" && oldRoleID != newRoleUUID {
		var activeManagerCount int
		err = s.pool.QueryRow(ctx, `
			SELECT COUNT(*)
			FROM station.app_user u
			JOIN station.role r ON r.id = u.role_id AND r.tenant_id = u.tenant_id
			WHERE u.tenant_id = $1 AND r.code = 'MANAGER' AND u.status = 'active' AND u.deleted_at IS NULL
		`, tenantID).Scan(&activeManagerCount)
		if err == nil && activeManagerCount <= 1 {
			return nil, fmt.Errorf("%w: không thể thay đổi vai trò của Quản lý duy nhất đang hoạt động", apperr.ErrForbidden)
		}
	}

	// Check email uniqueness if changed
	if !strings.EqualFold(req.Email, oldEmail) {
		var dupEmail bool
		_ = s.pool.QueryRow(ctx, `
			SELECT EXISTS(
				SELECT 1 FROM station.app_user 
				WHERE tenant_id = $1 AND lower(email) = lower($2) AND id != $3 AND deleted_at IS NULL
			)
		`, tenantID, req.Email, userUUID).Scan(&dupEmail)
		if dupEmail {
			return nil, fmt.Errorf("%w: email '%s' đã được sử dụng bởi tài khoản khác", apperr.ErrConflict, req.Email)
		}
	}

	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return nil, fmt.Errorf("begin tx: %w", err)
	}
	defer tx.Rollback(ctx)

	var phoneParam *string
	if strings.TrimSpace(req.Phone) != "" {
		p := strings.TrimSpace(req.Phone)
		phoneParam = &p
	}

	_, err = tx.Exec(ctx, `
		UPDATE station.app_user
		SET full_name = $1, email = $2, phone = $3, role_id = $4, updated_at = now()
		WHERE tenant_id = $5 AND id = $6
	`, req.FullName, req.Email, phoneParam, newRoleUUID, tenantID, userUUID)
	if err != nil {
		return nil, fmt.Errorf("update user: %w", err)
	}

	// Replace branch assignments
	_, err = tx.Exec(ctx, `DELETE FROM station.user_branch WHERE tenant_id = $1 AND user_id = $2`, tenantID, userUUID)
	if err != nil {
		return nil, fmt.Errorf("clear branches: %w", err)
	}

	for _, bStr := range req.BranchIDs {
		bUUID, err := uuid.Parse(bStr)
		if err != nil {
			continue
		}
		_, err = tx.Exec(ctx, `
			INSERT INTO station.user_branch (tenant_id, user_id, branch_id)
			VALUES ($1, $2, $3)
			ON CONFLICT DO NOTHING
		`, tenantID, userUUID, bUUID)
		if err != nil {
			return nil, fmt.Errorf("assign branch: %w", err)
		}
	}

	// Audit Log
	err = audit.Record(ctx, tx, audit.Entry{
		Action:      audit.ActionUpdate,
		EntityType:  "app_user",
		EntityID:    &userUUID,
		EntityCode:  oldEmployeeCode,
		ActorUserID: &actorUserID,
		ActorName:   actorName,
		OldData: map[string]any{
			"full_name": oldFullName,
			"email":     oldEmail,
			"phone":     oldPhone,
			"role_id":   oldRoleID.String(),
		},
		NewData: map[string]any{
			"full_name": req.FullName,
			"email":     req.Email,
			"phone":     req.Phone,
			"role_id":   newRoleUUID.String(),
			"branches":  req.BranchIDs,
		},
	})
	if err != nil {
		return nil, fmt.Errorf("record audit: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("commit tx: %w", err)
	}

	return s.GetUser(ctx, userUUID.String())
}

func (s *Service) UpdateUserStatus(ctx context.Context, idStr, newStatus string) error {
	tenantID, actorUserID, actorName, err := getTenantAndActor(ctx)
	if err != nil {
		return err
	}

	userUUID, err := uuid.Parse(idStr)
	if err != nil {
		return fmt.Errorf("%w: invalid user ID", apperr.ErrInvalidInput)
	}

	if newStatus != "active" && newStatus != "locked" {
		return fmt.Errorf("%w: trạng thái phải là 'active' hoặc 'locked'", apperr.ErrInvalidInput)
	}

	// Fetch current status and role
	var (
		currentStatus string
		roleCode      string
		employeeCode  string
		fullName      string
	)
	err = s.pool.QueryRow(ctx, `
		SELECT u.status, r.code, u.employee_code, u.full_name
		FROM station.app_user u
		JOIN station.role r ON r.id = u.role_id AND r.tenant_id = u.tenant_id
		WHERE u.tenant_id = $1 AND u.id = $2 AND u.deleted_at IS NULL
	`, tenantID, userUUID).Scan(&currentStatus, &roleCode, &employeeCode, &fullName)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return apperr.ErrNotFound
		}
		return fmt.Errorf("query user: %w", err)
	}

	if currentStatus == newStatus {
		return nil
	}

	// SAFETY RULES when locking
	if newStatus == "locked" {
		// 1. Cannot lock self
		if userUUID == actorUserID {
			return fmt.Errorf("%w: bạn không thể tự khóa tài khoản của chính mình", apperr.ErrForbidden)
		}

		// 2. Cannot lock last active manager
		if roleCode == "MANAGER" {
			var activeManagerCount int
			err = s.pool.QueryRow(ctx, `
				SELECT COUNT(*)
				FROM station.app_user u
				JOIN station.role r ON r.id = u.role_id AND r.tenant_id = u.tenant_id
				WHERE u.tenant_id = $1 AND r.code = 'MANAGER' AND u.status = 'active' AND u.deleted_at IS NULL
			`, tenantID).Scan(&activeManagerCount)
			if err == nil && activeManagerCount <= 1 {
				return fmt.Errorf("%w: không thể khóa tài khoản Quản lý duy nhất đang hoạt động", apperr.ErrForbidden)
			}
		}
	}

	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return fmt.Errorf("begin tx: %w", err)
	}
	defer tx.Rollback(ctx)

	_, err = tx.Exec(ctx, `
		UPDATE station.app_user
		SET status = $1, updated_at = now()
		WHERE tenant_id = $2 AND id = $3
	`, newStatus, tenantID, userUUID)
	if err != nil {
		return fmt.Errorf("update status: %w", err)
	}

	// If locked: immediately revoke active sessions
	if newStatus == "locked" {
		_, err = tx.Exec(ctx, `
			UPDATE station.auth_session
			SET revoked_at = now()
			WHERE tenant_id = $1 AND user_id = $2 AND revoked_at IS NULL
		`, tenantID, userUUID)
		if err != nil {
			return fmt.Errorf("revoke sessions: %w", err)
		}
	}

	action := audit.ActionUnlock
	if newStatus == "locked" {
		action = audit.ActionLock
	}

	err = audit.Record(ctx, tx, audit.Entry{
		Action:      action,
		EntityType:  "app_user",
		EntityID:    &userUUID,
		EntityCode:  employeeCode,
		ActorUserID: &actorUserID,
		ActorName:   actorName,
		OldData:     map[string]any{"status": currentStatus},
		NewData:     map[string]any{"status": newStatus},
	})
	if err != nil {
		return fmt.Errorf("record audit: %w", err)
	}

	return tx.Commit(ctx)
}

func (s *Service) ResetPassword(ctx context.Context, idStr, newPassword string) error {
	tenantID, actorUserID, actorName, err := getTenantAndActor(ctx)
	if err != nil {
		return err
	}

	userUUID, err := uuid.Parse(idStr)
	if err != nil {
		return fmt.Errorf("%w: invalid user ID", apperr.ErrInvalidInput)
	}

	if len(newPassword) < 8 {
		return fmt.Errorf("%w: mật khẩu mới phải từ 8 ký tự trở lên", apperr.ErrInvalidInput)
	}

	var employeeCode, fullName string
	err = s.pool.QueryRow(ctx, `
		SELECT employee_code, full_name
		FROM station.app_user
		WHERE tenant_id = $1 AND id = $2 AND deleted_at IS NULL
	`, tenantID, userUUID).Scan(&employeeCode, &fullName)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return apperr.ErrNotFound
		}
		return fmt.Errorf("query user: %w", err)
	}

	hashedPassword, err := crypto.HashPassword(newPassword)
	if err != nil {
		return fmt.Errorf("hash password: %w", err)
	}

	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return fmt.Errorf("begin tx: %w", err)
	}
	defer tx.Rollback(ctx)

	_, err = tx.Exec(ctx, `
		UPDATE station.app_user
		SET password_hash = $1, must_change_password = TRUE, failed_login_count = 0, locked_until = NULL, updated_at = now()
		WHERE tenant_id = $2 AND id = $3
	`, hashedPassword, tenantID, userUUID)
	if err != nil {
		return fmt.Errorf("update password: %w", err)
	}

	// Revoke sessions
	_, err = tx.Exec(ctx, `
		UPDATE station.auth_session
		SET revoked_at = now()
		WHERE tenant_id = $1 AND user_id = $2 AND revoked_at IS NULL
	`, tenantID, userUUID)
	if err != nil {
		return fmt.Errorf("revoke sessions: %w", err)
	}

	err = audit.Record(ctx, tx, audit.Entry{
		Action:      audit.ActionUpdate,
		EntityType:  "app_user",
		EntityID:    &userUUID,
		EntityCode:  employeeCode,
		ActorUserID: &actorUserID,
		ActorName:   actorName,
		NewData:     map[string]any{"action": "reset_password", "must_change_password": true},
	})
	if err != nil {
		return fmt.Errorf("record audit: %w", err)
	}

	return tx.Commit(ctx)
}

func (s *Service) DeleteUser(ctx context.Context, idStr string) error {
	tenantID, actorUserID, actorName, err := getTenantAndActor(ctx)
	if err != nil {
		return err
	}

	userUUID, err := uuid.Parse(idStr)
	if err != nil {
		return fmt.Errorf("%w: invalid user ID", apperr.ErrInvalidInput)
	}

	// SAFETY RULE: cannot delete self
	if userUUID == actorUserID {
		return fmt.Errorf("%w: bạn không thể tự xóa tài khoản của chính mình", apperr.ErrForbidden)
	}

	var (
		employeeCode string
		fullName     string
		roleCode     string
	)
	err = s.pool.QueryRow(ctx, `
		SELECT u.employee_code, u.full_name, r.code
		FROM station.app_user u
		JOIN station.role r ON r.id = u.role_id AND r.tenant_id = u.tenant_id
		WHERE u.tenant_id = $1 AND u.id = $2 AND u.deleted_at IS NULL
	`, tenantID, userUUID).Scan(&employeeCode, &fullName, &roleCode)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return apperr.ErrNotFound
		}
		return fmt.Errorf("query user: %w", err)
	}

	// SAFETY RULE: cannot delete last active MANAGER
	if roleCode == "MANAGER" {
		var activeManagerCount int
		err = s.pool.QueryRow(ctx, `
			SELECT COUNT(*)
			FROM station.app_user u
			JOIN station.role r ON r.id = u.role_id AND r.tenant_id = u.tenant_id
			WHERE u.tenant_id = $1 AND r.code = 'MANAGER' AND u.status = 'active' AND u.deleted_at IS NULL
		`, tenantID).Scan(&activeManagerCount)
		if err == nil && activeManagerCount <= 1 {
			return fmt.Errorf("%w: không thể xóa tài khoản Quản lý duy nhất đang hoạt động", apperr.ErrForbidden)
		}
	}

	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return fmt.Errorf("begin tx: %w", err)
	}
	defer tx.Rollback(ctx)

	// Soft delete
	_, err = tx.Exec(ctx, `
		UPDATE station.app_user
		SET deleted_at = now(), updated_at = now()
		WHERE tenant_id = $1 AND id = $2
	`, tenantID, userUUID)
	if err != nil {
		return fmt.Errorf("soft delete user: %w", err)
	}

	// Revoke sessions
	_, err = tx.Exec(ctx, `
		UPDATE station.auth_session
		SET revoked_at = now()
		WHERE tenant_id = $1 AND user_id = $2 AND revoked_at IS NULL
	`, tenantID, userUUID)
	if err != nil {
		return fmt.Errorf("revoke sessions: %w", err)
	}

	err = audit.Record(ctx, tx, audit.Entry{
		Action:      audit.ActionDelete,
		EntityType:  "app_user",
		EntityID:    &userUUID,
		EntityCode:  employeeCode,
		ActorUserID: &actorUserID,
		ActorName:   actorName,
		OldData:     map[string]any{"deleted_user": fullName, "employee_code": employeeCode},
	})
	if err != nil {
		return fmt.Errorf("record audit: %w", err)
	}

	return tx.Commit(ctx)
}

// ------------------------------------------------------------------------------------------------
// ROLE & PERMISSION SERVICES
// ------------------------------------------------------------------------------------------------

func (s *Service) ListRoles(ctx context.Context) ([]RoleListItem, error) {
	tenantID, _, _, err := getTenantAndActor(ctx)
	if err != nil {
		return nil, err
	}

	query := `
		SELECT 
			r.id, r.code, r.name, COALESCE(r.description, ''), r.is_system,
			COUNT(DISTINCT u.id) FILTER (WHERE u.deleted_at IS NULL) AS user_count,
			COUNT(DISTINCT rp.permission_code) AS perm_count,
			r.created_at, r.updated_at
		FROM station.role r
		LEFT JOIN station.app_user u ON u.role_id = r.id AND u.tenant_id = r.tenant_id
		LEFT JOIN station.role_permission rp ON rp.role_id = r.id
		WHERE r.tenant_id = $1
		GROUP BY r.id
		ORDER BY r.is_system DESC, r.code ASC
	`

	rows, err := s.pool.Query(ctx, query, tenantID)
	if err != nil {
		return nil, fmt.Errorf("list roles: %w", err)
	}
	defer rows.Close()

	var roles []RoleListItem
	for rows.Next() {
		var (
			roleUUID uuid.UUID
			item     RoleListItem
		)
		err := rows.Scan(
			&roleUUID, &item.Code, &item.Name, &item.Description, &item.IsSystem,
			&item.UserCount, &item.PermissionCount,
			&item.CreatedAt, &item.UpdatedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("scan role: %w", err)
		}
		item.ID = roleUUID.String()
		roles = append(roles, item)
	}

	return roles, nil
}

func (s *Service) GetRole(ctx context.Context, idStr string) (*RoleDetail, error) {
	tenantID, _, _, err := getTenantAndActor(ctx)
	if err != nil {
		return nil, err
	}

	roleUUID, err := uuid.Parse(idStr)
	if err != nil {
		return nil, fmt.Errorf("%w: invalid role ID", apperr.ErrInvalidInput)
	}

	var detail RoleDetail
	err = s.pool.QueryRow(ctx, `
		SELECT id, code, name, COALESCE(description, ''), is_system, created_at, updated_at
		FROM station.role
		WHERE tenant_id = $1 AND id = $2
	`, tenantID, roleUUID).Scan(
		&roleUUID, &detail.Code, &detail.Name, &detail.Description, &detail.IsSystem,
		&detail.CreatedAt, &detail.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, apperr.ErrNotFound
		}
		return nil, fmt.Errorf("query role: %w", err)
	}
	detail.ID = roleUUID.String()

	pRows, err := s.pool.Query(ctx, `SELECT permission_code FROM station.role_permission WHERE role_id = $1 ORDER BY permission_code`, roleUUID)
	if err != nil {
		return nil, fmt.Errorf("query role perms: %w", err)
	}
	defer pRows.Close()

	var perms []string
	for pRows.Next() {
		var p string
		if err := pRows.Scan(&p); err != nil {
			return nil, err
		}
		perms = append(perms, p)
	}
	detail.PermissionCodes = perms

	return &detail, nil
}

func (s *Service) CreateRole(ctx context.Context, req CreateRoleRequest) (*RoleDetail, error) {
	tenantID, actorUserID, actorName, err := getTenantAndActor(ctx)
	if err != nil {
		return nil, err
	}

	req.Code = strings.TrimSpace(strings.ToUpper(req.Code))
	if !rxRoleCode.MatchString(req.Code) {
		return nil, fmt.Errorf("%w: mã vai trò không hợp lệ (2-32 ký tự chữ, số, gạch ngang, gạch dưới)", apperr.ErrInvalidInput)
	}

	req.Name = strings.TrimSpace(req.Name)
	if req.Name == "" {
		return nil, fmt.Errorf("%w: tên vai trò không được để trống", apperr.ErrInvalidInput)
	}

	// Check code duplicate in tenant
	var dupCode bool
	_ = s.pool.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM station.role WHERE tenant_id = $1 AND code = $2)`, tenantID, req.Code).Scan(&dupCode)
	if dupCode {
		return nil, fmt.Errorf("%w: mã vai trò '%s' đã tồn tại", apperr.ErrConflict, req.Code)
	}

	roleUUID := uuid.New()
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return nil, fmt.Errorf("begin tx: %w", err)
	}
	defer tx.Rollback(ctx)

	_, err = tx.Exec(ctx, `
		INSERT INTO station.role (id, tenant_id, code, name, description, is_system)
		VALUES ($1, $2, $3, $4, $5, FALSE)
	`, roleUUID, tenantID, req.Code, req.Name, strings.TrimSpace(req.Description))
	if err != nil {
		return nil, fmt.Errorf("insert role: %w", err)
	}

	for _, perm := range req.PermissionCodes {
		perm = strings.TrimSpace(perm)
		if perm == "" {
			continue
		}
		_, err = tx.Exec(ctx, `
			INSERT INTO station.role_permission (role_id, permission_code)
			VALUES ($1, $2)
			ON CONFLICT DO NOTHING
		`, roleUUID, perm)
		if err != nil {
			return nil, fmt.Errorf("insert role permission: %w", err)
		}
	}

	err = audit.Record(ctx, tx, audit.Entry{
		Action:      audit.ActionCreate,
		EntityType:  "role",
		EntityID:    &roleUUID,
		EntityCode:  req.Code,
		ActorUserID: &actorUserID,
		ActorName:   actorName,
		NewData: map[string]any{
			"code":        req.Code,
			"name":        req.Name,
			"permissions": req.PermissionCodes,
		},
	})
	if err != nil {
		return nil, fmt.Errorf("record audit: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("commit tx: %w", err)
	}

	return s.GetRole(ctx, roleUUID.String())
}

func (s *Service) UpdateRole(ctx context.Context, idStr string, req UpdateRoleRequest) (*RoleDetail, error) {
	tenantID, actorUserID, actorName, err := getTenantAndActor(ctx)
	if err != nil {
		return nil, err
	}

	roleUUID, err := uuid.Parse(idStr)
	if err != nil {
		return nil, fmt.Errorf("%w: invalid role ID", apperr.ErrInvalidInput)
	}

	req.Name = strings.TrimSpace(req.Name)
	if req.Name == "" {
		return nil, fmt.Errorf("%w: tên vai trò không được để trống", apperr.ErrInvalidInput)
	}

	var (
		oldCode     string
		oldName     string
		oldDesc     string
		isSystem    bool
	)
	err = s.pool.QueryRow(ctx, `
		SELECT code, name, COALESCE(description, ''), is_system
		FROM station.role
		WHERE tenant_id = $1 AND id = $2
	`, tenantID, roleUUID).Scan(&oldCode, &oldName, &oldDesc, &isSystem)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, apperr.ErrNotFound
		}
		return nil, fmt.Errorf("query role: %w", err)
	}

	// SAFETY RULE: If this is the current actor's role, actor cannot strip crucial management permissions
	p, ok := authz.FromContext(ctx)
	if ok && p.RoleCode == oldCode {
		permSet := make(map[string]bool)
		for _, perm := range req.PermissionCodes {
			permSet[perm] = true
		}
		requiredAdminPerms := []string{"iam.user:view", "iam.user:update", "iam.role:view", "iam.role:update"}
		for _, required := range requiredAdminPerms {
			if !permSet[required] {
				return nil, fmt.Errorf("%w: bạn không thể tự gỡ quyền quản trị ('%s') khỏi vai trò của mình", apperr.ErrForbidden, required)
			}
		}
	}

	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return nil, fmt.Errorf("begin tx: %w", err)
	}
	defer tx.Rollback(ctx)

	_, err = tx.Exec(ctx, `
		UPDATE station.role
		SET name = $1, description = $2, updated_at = now()
		WHERE tenant_id = $3 AND id = $4
	`, req.Name, strings.TrimSpace(req.Description), tenantID, roleUUID)
	if err != nil {
		return nil, fmt.Errorf("update role: %w", err)
	}

	// Replace role_permissions
	_, err = tx.Exec(ctx, `DELETE FROM station.role_permission WHERE role_id = $1`, roleUUID)
	if err != nil {
		return nil, fmt.Errorf("clear perms: %w", err)
	}

	for _, perm := range req.PermissionCodes {
		perm = strings.TrimSpace(perm)
		if perm == "" {
			continue
		}
		_, err = tx.Exec(ctx, `
			INSERT INTO station.role_permission (role_id, permission_code)
			VALUES ($1, $2)
			ON CONFLICT DO NOTHING
		`, roleUUID, perm)
		if err != nil {
			return nil, fmt.Errorf("insert role perm: %w", err)
		}
	}

	err = audit.Record(ctx, tx, audit.Entry{
		Action:      audit.ActionUpdate,
		EntityType:  "role",
		EntityID:    &roleUUID,
		EntityCode:  oldCode,
		ActorUserID: &actorUserID,
		ActorName:   actorName,
		OldData: map[string]any{
			"name":        oldName,
			"description": oldDesc,
		},
		NewData: map[string]any{
			"name":        req.Name,
			"description": req.Description,
			"permissions": req.PermissionCodes,
		},
	})
	if err != nil {
		return nil, fmt.Errorf("record audit: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("commit tx: %w", err)
	}

	return s.GetRole(ctx, roleUUID.String())
}

func (s *Service) DeleteRole(ctx context.Context, idStr string) error {
	tenantID, actorUserID, actorName, err := getTenantAndActor(ctx)
	if err != nil {
		return err
	}

	roleUUID, err := uuid.Parse(idStr)
	if err != nil {
		return fmt.Errorf("%w: invalid role ID", apperr.ErrInvalidInput)
	}

	var (
		code     string
		name     string
		isSystem bool
	)
	err = s.pool.QueryRow(ctx, `
		SELECT code, name, is_system
		FROM station.role
		WHERE tenant_id = $1 AND id = $2
	`, tenantID, roleUUID).Scan(&code, &name, &isSystem)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return apperr.ErrNotFound
		}
		return fmt.Errorf("query role: %w", err)
	}

	// SAFETY RULE: cannot delete system role
	if isSystem {
		return fmt.Errorf("%w: không thể xóa các vai trò hệ thống mặc định (MANAGER, ACCOUNTANT, IT)", apperr.ErrForbidden)
	}

	// SAFETY RULE: cannot delete role if assigned to active users
	var userCount int
	err = s.pool.QueryRow(ctx, `
		SELECT COUNT(*)
		FROM station.app_user
		WHERE tenant_id = $1 AND role_id = $2 AND deleted_at IS NULL
	`, tenantID, roleUUID).Scan(&userCount)
	if err == nil && userCount > 0 {
		return fmt.Errorf("%w: không thể xóa vai trò đang có %d tài khoản đang sử dụng", apperr.ErrConflict, userCount)
	}

	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return fmt.Errorf("begin tx: %w", err)
	}
	defer tx.Rollback(ctx)

	_, err = tx.Exec(ctx, `DELETE FROM station.role WHERE tenant_id = $1 AND id = $2`, tenantID, roleUUID)
	if err != nil {
		return fmt.Errorf("delete role: %w", err)
	}

	err = audit.Record(ctx, tx, audit.Entry{
		Action:      audit.ActionDelete,
		EntityType:  "role",
		EntityID:    &roleUUID,
		EntityCode:  code,
		ActorUserID: &actorUserID,
		ActorName:   actorName,
		OldData:     map[string]any{"code": code, "name": name},
	})
	if err != nil {
		return fmt.Errorf("record audit: %w", err)
	}

	return tx.Commit(ctx)
}

func (s *Service) ListPermissions(ctx context.Context) ([]PermissionItem, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT code, module, action, description
		FROM station.permission
		ORDER BY module ASC, action ASC
	`)
	if err != nil {
		return nil, fmt.Errorf("list permissions: %w", err)
	}
	defer rows.Close()

	var perms []PermissionItem
	for rows.Next() {
		var p PermissionItem
		if err := rows.Scan(&p.Code, &p.Module, &p.Action, &p.Description); err != nil {
			return nil, err
		}
		perms = append(perms, p)
	}
	return perms, nil
}

func (s *Service) ListBranches(ctx context.Context) ([]BranchOption, error) {
	tenantID, _, _, err := getTenantAndActor(ctx)
	if err != nil {
		return nil, err
	}

	rows, err := s.pool.Query(ctx, `
		SELECT id, code, name, COALESCE(address, '')
		FROM station.branch
		WHERE tenant_id = $1 AND status = 'active'
		ORDER BY code ASC
	`, tenantID)
	if err != nil {
		return nil, fmt.Errorf("list branches: %w", err)
	}
	defer rows.Close()

	var branches []BranchOption
	for rows.Next() {
		var (
			bID   uuid.UUID
			bCode string
			bName string
			bAddr string
		)
		if err := rows.Scan(&bID, &bCode, &bName, &bAddr); err != nil {
			return nil, err
		}
		branches = append(branches, BranchOption{
			ID:      bID.String(),
			Code:    bCode,
			Name:    bName,
			Address: bAddr,
		})
	}
	return branches, nil
}
