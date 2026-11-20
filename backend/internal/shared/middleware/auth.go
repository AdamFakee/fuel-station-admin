package middleware

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"strings"

	"fuel-station-backend/internal/shared/apperr"
	"fuel-station-backend/internal/shared/authz"
	"fuel-station-backend/internal/shared/httpx"
	"github.com/jackc/pgx/v5/pgxpool"
)

// SessionUserData holds user identity, tenant, role, branch scopes, and permissions.
type SessionUserData struct {
	UserID      string
	TenantID    string
	RoleCode    string
	BranchIDs   []string
	Permissions []string
}

// SessionValidator defines an interface for validating session tokens.
type SessionValidator interface {
	ValidateToken(ctx context.Context, tokenHash string) (*SessionUserData, error)
}

// PostgresSessionValidator validates session tokens against PostgreSQL tables.
type PostgresSessionValidator struct {
	pool *pgxpool.Pool
}

// NewPostgresSessionValidator creates a new PostgresSessionValidator.
func NewPostgresSessionValidator(pool *pgxpool.Pool) *PostgresSessionValidator {
	return &PostgresSessionValidator{pool: pool}
}

// ValidateToken verifies token existence, expiration, revocation, and active user status.
func (v *PostgresSessionValidator) ValidateToken(ctx context.Context, tokenHash string) (*SessionUserData, error) {
	if v.pool == nil {
		return nil, errors.New("database pool is not initialized")
	}

	query := `
		SELECT s.tenant_id, s.user_id, r.id AS role_id, r.code AS role_code
		FROM station.auth_session s
		JOIN station.app_user u ON u.id = s.user_id AND u.tenant_id = s.tenant_id
		JOIN station.role r ON r.id = u.role_id AND r.tenant_id = u.tenant_id
		WHERE s.token_hash = $1
		  AND s.revoked_at IS NULL
		  AND s.expires_at > now()
		  AND u.deleted_at IS NULL
		  AND u.status = 'active'
	`

	var (
		tenantID string
		userID   string
		roleID   string
		roleCode string
	)

	err := v.pool.QueryRow(ctx, query, tokenHash).Scan(&tenantID, &userID, &roleID, &roleCode)
	if err != nil {
		return nil, fmt.Errorf("lookup session: %w", err)
	}

	// Fetch permissions
	permQuery := `SELECT permission_code FROM station.role_permission WHERE role_id = $1`
	rows, err := v.pool.Query(ctx, permQuery, roleID)
	if err != nil {
		return nil, fmt.Errorf("query permissions: %w", err)
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

	// Fetch assigned branch IDs
	branchQuery := `SELECT branch_id FROM station.user_branch WHERE tenant_id = $1 AND user_id = $2`
	bRows, err := v.pool.Query(ctx, branchQuery, tenantID, userID)
	if err != nil {
		return nil, fmt.Errorf("query branches: %w", err)
	}
	defer bRows.Close()

	var branchIDs []string
	for bRows.Next() {
		var b string
		if err := bRows.Scan(&b); err != nil {
			return nil, fmt.Errorf("scan branch: %w", err)
		}
		branchIDs = append(branchIDs, b)
	}

	return &SessionUserData{
		UserID:      userID,
		TenantID:    tenantID,
		RoleCode:    roleCode,
		BranchIDs:   branchIDs,
		Permissions: perms,
	}, nil
}

// HashToken hashes a raw plain token using SHA-256 to compare with token_hash in DB.
func HashToken(rawToken string) string {
	sum := sha256.Sum256([]byte(rawToken))
	return hex.EncodeToString(sum[:])
}

// ExtractToken retrieves raw session token from Cookie or Authorization header.
func ExtractToken(r *http.Request) string {
	if cookie, err := r.Cookie("session_token"); err == nil && cookie.Value != "" {
		return cookie.Value
	}

	authHeader := r.Header.Get("Authorization")
	if strings.HasPrefix(strings.ToLower(authHeader), "bearer ") {
		return strings.TrimSpace(authHeader[7:])
	}

	return ""
}

// RequireAuth requires a valid session token, establishes Principal and TenantID context.
func RequireAuth(validator SessionValidator, log *slog.Logger) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			rawToken := ExtractToken(r)
			if rawToken == "" {
				httpx.Error(w, r, log, apperr.ErrUnauthorized)
				return
			}

			tokenHash := HashToken(rawToken)
			userData, err := validator.ValidateToken(r.Context(), tokenHash)
			if err != nil {
				log.WarnContext(r.Context(), "invalid session token", "err", err)
				httpx.Error(w, r, log, apperr.ErrUnauthorized)
				return
			}

			perms := make([]authz.Permission, len(userData.Permissions))
			for i, p := range userData.Permissions {
				perms[i] = authz.Permission(p)
			}

			principal := authz.NewPrincipal(
				userData.UserID,
				userData.TenantID,
				userData.RoleCode,
				userData.BranchIDs,
				perms,
			)

			ctx := authz.WithPrincipal(r.Context(), principal)
			ctx = WithTenantID(ctx, principal.TenantID)

			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}
