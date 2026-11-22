package auth

import (
	"context"
	"errors"
	"fmt"
	"time"

	"fuel-station-backend/internal/shared/apperr"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type UserRecord struct {
	ID                 string
	TenantID           string
	EmployeeCode       string
	FullName           string
	Email              string
	Username           string
	PasswordHash       string
	RoleID             string
	RoleCode           string
	RoleName           string
	TenantCode         string
	TenantName         string
	Status             string
	MustChangePassword bool
	FailedLoginCount   int
	LockedUntil        *time.Time
}

type TenantSettingRecord struct {
	MaxFailedLogins int
	LockoutMinutes  int
}

type Repository interface {
	FindTenantByCode(ctx context.Context, code string) (*TenantSummary, error)
	FindUserByLogin(ctx context.Context, tenantID, identifier string) (*UserRecord, error)
	FindUserAcrossTenants(ctx context.Context, identifier string) ([]*UserRecord, error)
	GetTenantSetting(ctx context.Context, tenantID string) (*TenantSettingRecord, error)
	RecordFailedLogin(ctx context.Context, tenantID, userID string, maxFailed, lockoutMinutes int) (int, *time.Time, error)
	ResetFailedLogin(ctx context.Context, tenantID, userID, ip string) error
	CreateSession(ctx context.Context, tenantID, userID, tokenHash string, rememberMe bool, ip, userAgent string, expiresAt time.Time) error
	RevokeSession(ctx context.Context, tokenHash string) error
	RevokeAllUserSessions(ctx context.Context, tenantID, userID string) error
	GetUserPermissions(ctx context.Context, roleID string) ([]string, error)
	UpdatePassword(ctx context.Context, tenantID, userID, newHash string) error
	GetUserProfile(ctx context.Context, tenantID, userID string) (*UserRecord, error)
}

type postgresRepository struct {
	pool *pgxpool.Pool
}

func NewRepository(pool *pgxpool.Pool) Repository {
	return &postgresRepository{pool: pool}
}

func (r *postgresRepository) FindTenantByCode(ctx context.Context, code string) (*TenantSummary, error) {
	if r.pool == nil {
		return nil, errors.New("db pool not initialized")
	}

	query := `
		SELECT id, code, name
		FROM station.tenant
		WHERE lower(code) = lower($1) AND status = 'active'
	`
	var t TenantSummary
	err := r.pool.QueryRow(ctx, query, code).Scan(&t.ID, &t.Code, &t.Name)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, apperr.ErrNotFound
		}
		return nil, fmt.Errorf("find tenant: %w", err)
	}
	return &t, nil
}

func (r *postgresRepository) FindUserByLogin(ctx context.Context, tenantID, identifier string) (*UserRecord, error) {
	if r.pool == nil {
		return nil, errors.New("db pool not initialized")
	}

	query := `
		SELECT u.id, u.tenant_id, u.employee_code, u.full_name, u.email, u.username,
		       u.password_hash, u.role_id, r.code, r.name, t.code, t.name,
		       u.status, u.must_change_password, u.failed_login_count, u.locked_until
		FROM station.app_user u
		JOIN station.role r ON r.id = u.role_id AND r.tenant_id = u.tenant_id
		JOIN station.tenant t ON t.id = u.tenant_id
		WHERE u.tenant_id = $1
		  AND (lower(u.username) = lower($2) OR lower(u.email) = lower($2))
		  AND u.deleted_at IS NULL
	`

	var u UserRecord
	err := r.pool.QueryRow(ctx, query, tenantID, identifier).Scan(
		&u.ID, &u.TenantID, &u.EmployeeCode, &u.FullName, &u.Email, &u.Username,
		&u.PasswordHash, &u.RoleID, &u.RoleCode, &u.RoleName, &u.TenantCode, &u.TenantName,
		&u.Status, &u.MustChangePassword, &u.FailedLoginCount, &u.LockedUntil,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, apperr.ErrNotFound
		}
		return nil, fmt.Errorf("find user: %w", err)
	}

	return &u, nil
}

func (r *postgresRepository) FindUserAcrossTenants(ctx context.Context, identifier string) ([]*UserRecord, error) {
	if r.pool == nil {
		return nil, errors.New("db pool not initialized")
	}

	query := `
		SELECT u.id, u.tenant_id, u.employee_code, u.full_name, u.email, u.username,
		       u.password_hash, u.role_id, r.code, r.name, t.code, t.name,
		       u.status, u.must_change_password, u.failed_login_count, u.locked_until
		FROM station.app_user u
		JOIN station.role r ON r.id = u.role_id AND r.tenant_id = u.tenant_id
		JOIN station.tenant t ON t.id = u.tenant_id
		WHERE (lower(u.username) = lower($1) OR lower(u.email) = lower($1))
		  AND u.deleted_at IS NULL
		  AND t.status = 'active'
	`

	rows, err := r.pool.Query(ctx, query, identifier)
	if err != nil {
		return nil, fmt.Errorf("find user across tenants: %w", err)
	}
	defer rows.Close()

	var records []*UserRecord
	for rows.Next() {
		var u UserRecord
		if err := rows.Scan(
			&u.ID, &u.TenantID, &u.EmployeeCode, &u.FullName, &u.Email, &u.Username,
			&u.PasswordHash, &u.RoleID, &u.RoleCode, &u.RoleName, &u.TenantCode, &u.TenantName,
			&u.Status, &u.MustChangePassword, &u.FailedLoginCount, &u.LockedUntil,
		); err != nil {
			return nil, fmt.Errorf("scan user across tenants: %w", err)
		}
		records = append(records, &u)
	}

	return records, nil
}

func (r *postgresRepository) GetTenantSetting(ctx context.Context, tenantID string) (*TenantSettingRecord, error) {
	if r.pool == nil {
		return &TenantSettingRecord{MaxFailedLogins: 5, LockoutMinutes: 15}, nil
	}

	query := `SELECT max_failed_logins, lockout_minutes FROM station.tenant_setting WHERE tenant_id = $1`
	var s TenantSettingRecord
	err := r.pool.QueryRow(ctx, query, tenantID).Scan(&s.MaxFailedLogins, &s.LockoutMinutes)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return &TenantSettingRecord{MaxFailedLogins: 5, LockoutMinutes: 15}, nil
		}
		return nil, fmt.Errorf("get tenant setting: %w", err)
	}
	return &s, nil
}

func (r *postgresRepository) RecordFailedLogin(ctx context.Context, tenantID, userID string, maxFailed, lockoutMinutes int) (int, *time.Time, error) {
	if r.pool == nil {
		return 0, nil, errors.New("db pool not initialized")
	}

	query := `
		UPDATE station.app_user
		SET failed_login_count = failed_login_count + 1,
		    locked_until = CASE
		        WHEN failed_login_count + 1 >= $3 THEN now() + ($4 || ' minutes')::interval
		        ELSE locked_until
		    END,
		    updated_at = now()
		WHERE tenant_id = $1 AND id = $2
		RETURNING failed_login_count, locked_until
	`

	var count int
	var lockedUntil *time.Time
	err := r.pool.QueryRow(ctx, query, tenantID, userID, maxFailed, lockoutMinutes).Scan(&count, &lockedUntil)
	if err != nil {
		return 0, nil, fmt.Errorf("update failed login: %w", err)
	}

	return count, lockedUntil, nil
}

func (r *postgresRepository) ResetFailedLogin(ctx context.Context, tenantID, userID, ip string) error {
	if r.pool == nil {
		return errors.New("db pool not initialized")
	}

	var ipArg any
	if ip != "" {
		ipArg = ip
	}

	query := `
		UPDATE station.app_user
		SET failed_login_count = 0,
		    locked_until = NULL,
		    last_login_at = now(),
		    last_login_ip = $3::inet,
		    updated_at = now()
		WHERE tenant_id = $1 AND id = $2
	`
	_, err := r.pool.Exec(ctx, query, tenantID, userID, ipArg)
	if err != nil {
		// Fallback without inet cast if ip format was invalid/local
		fallbackQuery := `
			UPDATE station.app_user
			SET failed_login_count = 0,
			    locked_until = NULL,
			    last_login_at = now(),
			    updated_at = now()
			WHERE tenant_id = $1 AND id = $2
		`
		if _, fallbackErr := r.pool.Exec(ctx, fallbackQuery, tenantID, userID); fallbackErr != nil {
			return fmt.Errorf("reset login stats: %w", fallbackErr)
		}
	}
	return nil
}

func (r *postgresRepository) CreateSession(ctx context.Context, tenantID, userID, tokenHash string, rememberMe bool, ip, userAgent string, expiresAt time.Time) error {
	if r.pool == nil {
		return errors.New("db pool not initialized")
	}

	var ipArg any
	if ip != "" {
		ipArg = ip
	}

	query := `
		INSERT INTO station.auth_session (
			tenant_id, user_id, token_hash, remember_me, ip, user_agent, expires_at
		) VALUES (
			$1, $2, $3, $4, $5::inet, $6, $7
		)
	`
	_, err := r.pool.Exec(ctx, query, tenantID, userID, tokenHash, rememberMe, ipArg, userAgent, expiresAt)
	if err != nil {
		fallbackQuery := `
			INSERT INTO station.auth_session (
				tenant_id, user_id, token_hash, remember_me, user_agent, expires_at
			) VALUES (
				$1, $2, $3, $4, $5, $6
			)
		`
		if _, fallbackErr := r.pool.Exec(ctx, fallbackQuery, tenantID, userID, tokenHash, rememberMe, userAgent, expiresAt); fallbackErr != nil {
			return fmt.Errorf("create session: %w", fallbackErr)
		}
	}
	return nil
}

func (r *postgresRepository) RevokeSession(ctx context.Context, tokenHash string) error {
	if r.pool == nil {
		return errors.New("db pool not initialized")
	}

	query := `UPDATE station.auth_session SET revoked_at = now() WHERE token_hash = $1 AND revoked_at IS NULL`
	_, err := r.pool.Exec(ctx, query, tokenHash)
	if err != nil {
		return fmt.Errorf("revoke session: %w", err)
	}
	return nil
}

func (r *postgresRepository) RevokeAllUserSessions(ctx context.Context, tenantID, userID string) error {
	if r.pool == nil {
		return errors.New("db pool not initialized")
	}

	query := `UPDATE station.auth_session SET revoked_at = now() WHERE tenant_id = $1 AND user_id = $2 AND revoked_at IS NULL`
	_, err := r.pool.Exec(ctx, query, tenantID, userID)
	if err != nil {
		return fmt.Errorf("revoke user sessions: %w", err)
	}
	return nil
}

func (r *postgresRepository) GetUserPermissions(ctx context.Context, roleID string) ([]string, error) {
	if r.pool == nil {
		return nil, errors.New("db pool not initialized")
	}

	query := `SELECT permission_code FROM station.role_permission WHERE role_id = $1`
	rows, err := r.pool.Query(ctx, query, roleID)
	if err != nil {
		return nil, fmt.Errorf("get permissions: %w", err)
	}
	defer rows.Close()

	var perms []string
	for rows.Next() {
		var p string
		if err := rows.Scan(&p); err != nil {
			return nil, fmt.Errorf("scan permission: %w", err)
		}
		perms = append(perms, p)
	}
	return perms, nil
}

func (r *postgresRepository) UpdatePassword(ctx context.Context, tenantID, userID, newHash string) error {
	if r.pool == nil {
		return errors.New("db pool not initialized")
	}

	query := `
		UPDATE station.app_user
		SET password_hash = $3,
		    must_change_password = FALSE,
		    updated_at = now()
		WHERE tenant_id = $1 AND id = $2
	`
	tag, err := r.pool.Exec(ctx, query, tenantID, userID, newHash)
	if err != nil {
		return fmt.Errorf("update password: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return apperr.ErrNotFound
	}
	return nil
}

func (r *postgresRepository) GetUserProfile(ctx context.Context, tenantID, userID string) (*UserRecord, error) {
	if r.pool == nil {
		return nil, errors.New("db pool not initialized")
	}

	query := `
		SELECT u.id, u.tenant_id, u.employee_code, u.full_name, u.email, u.username,
		       u.password_hash, u.role_id, r.code, r.name, t.code, t.name,
		       u.status, u.must_change_password, u.failed_login_count, u.locked_until
		FROM station.app_user u
		JOIN station.role r ON r.id = u.role_id AND r.tenant_id = u.tenant_id
		JOIN station.tenant t ON t.id = u.tenant_id
		WHERE u.tenant_id = $1 AND u.id = $2 AND u.deleted_at IS NULL
	`

	var u UserRecord
	err := r.pool.QueryRow(ctx, query, tenantID, userID).Scan(
		&u.ID, &u.TenantID, &u.EmployeeCode, &u.FullName, &u.Email, &u.Username,
		&u.PasswordHash, &u.RoleID, &u.RoleCode, &u.RoleName, &u.TenantCode, &u.TenantName,
		&u.Status, &u.MustChangePassword, &u.FailedLoginCount, &u.LockedUntil,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, apperr.ErrNotFound
		}
		return nil, fmt.Errorf("get profile: %w", err)
	}

	return &u, nil
}

// Ensure interface compatibility
var _ Repository = (*postgresRepository)(nil)
var _ = uuid.Nil
