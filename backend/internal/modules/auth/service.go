package auth

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"fmt"
	"log/slog"
	"net"
	"strings"
	"time"

	"fuel-station-backend/internal/platform/crypto"
	"fuel-station-backend/internal/shared/apperr"
	"fuel-station-backend/internal/shared/audit"
	"fuel-station-backend/internal/shared/authz"
	"fuel-station-backend/internal/shared/middleware"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

type Service interface {
	Login(ctx context.Context, req LoginRequest, ip, userAgent string) (*LoginResponse, error)
	Me(ctx context.Context) (*MeResponse, error)
	ChangePassword(ctx context.Context, req ChangePasswordRequest) error
	Logout(ctx context.Context, rawToken string) error
}

type service struct {
	repo Repository
	pool *pgxpool.Pool
	log  *slog.Logger
}

func NewService(repo Repository, pool *pgxpool.Pool, log *slog.Logger) Service {
	return &service{
		repo: repo,
		pool: pool,
		log:  log,
	}
}

func (s *service) Login(ctx context.Context, req LoginRequest, ip, userAgent string) (*LoginResponse, error) {
	username := strings.TrimSpace(req.Username)
	if username == "" || req.Password == "" {
		return nil, fmt.Errorf("%w: tên đăng nhập và mật khẩu không được để trống", apperr.ErrInvalidInput)
	}

	var user *UserRecord
	var err error

	tenantCode := strings.TrimSpace(req.TenantCode)
	if tenantCode != "" {
		tenant, tErr := s.repo.FindTenantByCode(ctx, tenantCode)
		if tErr != nil {
			s.log.WarnContext(ctx, "login failed: tenant not found", "tenant_code", tenantCode)
			return nil, fmt.Errorf("%w: thông tin đăng nhập không chính xác", apperr.ErrUnauthorized)
		}
		user, err = s.repo.FindUserByLogin(ctx, tenant.ID, username)
	} else {
		users, uErr := s.repo.FindUserAcrossTenants(ctx, username)
		if uErr != nil {
			return nil, fmt.Errorf("search users: %w", uErr)
		}
		if len(users) == 0 {
			return nil, fmt.Errorf("%w: thông tin đăng nhập không chính xác", apperr.ErrUnauthorized)
		}
		if len(users) > 1 {
			return nil, fmt.Errorf("%w: tài khoản tồn tại trên nhiều công ty, vui lòng nhập mã công ty (tenant code)", apperr.ErrInvalidInput)
		}
		user = users[0]
	}

	if err != nil {
		s.log.WarnContext(ctx, "login failed: user not found", "username", username)
		return nil, fmt.Errorf("%w: thông tin đăng nhập không chính xác", apperr.ErrUnauthorized)
	}

	// 1. Check permanent administrative lock
	if user.Status == "locked" {
		return nil, fmt.Errorf("%w: tài khoản đã bị khóa bởi Quản trị viên", apperr.ErrForbidden)
	}

	// 2. Check temporary lockout from failed attempts
	now := time.Now().UTC()
	if user.LockedUntil != nil && user.LockedUntil.After(now) {
		remainingMinutes := int(user.LockedUntil.Sub(now).Minutes()) + 1
		return nil, fmt.Errorf("%w: tài khoản tạm thời bị khóa do đăng nhập sai nhiều lần, vui lòng thử lại sau %d phút", apperr.ErrForbidden, remainingMinutes)
	}

	setting, _ := s.repo.GetTenantSetting(ctx, user.TenantID)
	maxFailed := 5
	lockoutMins := 15
	if setting != nil {
		if setting.MaxFailedLogins > 0 {
			maxFailed = setting.MaxFailedLogins
		}
		if setting.LockoutMinutes > 0 {
			lockoutMins = setting.LockoutMinutes
		}
	}

	// 3. Verify Argon2id Password Hash
	matched, vErr := crypto.VerifyPassword(req.Password, user.PasswordHash)
	if vErr != nil || !matched {
		s.log.WarnContext(ctx, "login failed: password mismatch", "username", username, "user_id", user.ID)
		count, lockedUntil, recordErr := s.repo.RecordFailedLogin(ctx, user.TenantID, user.ID, maxFailed, lockoutMins)
		if recordErr != nil {
			s.log.ErrorContext(ctx, "failed to record failed login attempt", "err", recordErr)
		}

		if lockedUntil != nil && lockedUntil.After(now) {
			_ = s.recordAudit(ctx, user.TenantID, user.ID, user.FullName, audit.ActionLock, "app_user", user.ID, user.Username, ip, "Tài khoản bị tự động khóa do nhập sai mật khẩu")
			return nil, fmt.Errorf("%w: mật khẩu sai quá %d lần, tài khoản đã bị khóa trong %d phút", apperr.ErrForbidden, maxFailed, lockoutMins)
		}

		remaining := maxFailed - count
		if remaining > 0 && remaining <= 3 {
			return nil, fmt.Errorf("%w: mật khẩu không chính xác, bạn còn %d lần thử trước khi bị khóa", apperr.ErrUnauthorized, remaining)
		}
		return nil, fmt.Errorf("%w: thông tin đăng nhập không chính xác", apperr.ErrUnauthorized)
	}

	// 4. Success: Reset failed count & update last login
	cleanIP := sanitizeIP(ip)
	_ = s.repo.ResetFailedLogin(ctx, user.TenantID, user.ID, cleanIP)

	// 5. Generate secure session token
	tokenBytes := make([]byte, 32)
	if _, rErr := rand.Read(tokenBytes); rErr != nil {
		return nil, fmt.Errorf("generate session token: %w", rErr)
	}
	rawToken := hex.EncodeToString(tokenBytes)
	tokenHash := middleware.HashToken(rawToken)

	var expiresAt time.Time
	if req.RememberMe {
		expiresAt = now.Add(30 * 24 * time.Hour)
	} else {
		expiresAt = now.Add(24 * time.Hour)
	}

	if sErr := s.repo.CreateSession(ctx, user.TenantID, user.ID, tokenHash, req.RememberMe, cleanIP, userAgent, expiresAt); sErr != nil {
		return nil, fmt.Errorf("save auth session: %w", sErr)
	}

	// 6. Fetch permissions
	perms, _ := s.repo.GetUserPermissions(ctx, user.RoleID)

	// 7. Audit log
	_ = s.recordAudit(ctx, user.TenantID, user.ID, user.FullName, audit.ActionLogin, "app_user", user.ID, user.Username, cleanIP, "Đăng nhập thành công")

	return &LoginResponse{
		Token:     rawToken,
		ExpiresAt: expiresAt,
		User: UserProfile{
			ID:                 user.ID,
			TenantID:           user.TenantID,
			TenantCode:         user.TenantCode,
			TenantName:         user.TenantName,
			EmployeeCode:       user.EmployeeCode,
			FullName:           user.FullName,
			Email:              user.Email,
			Username:           user.Username,
			RoleID:             user.RoleID,
			RoleCode:           user.RoleCode,
			RoleName:           user.RoleName,
			Status:             user.Status,
			MustChangePassword: user.MustChangePassword,
			Permissions:        perms,
		},
	}, nil
}

func (s *service) Me(ctx context.Context) (*MeResponse, error) {
	principal, ok := authz.FromContext(ctx)
	if !ok || principal.UserID == "" {
		return nil, apperr.ErrUnauthorized
	}

	user, err := s.repo.GetUserProfile(ctx, principal.TenantID, principal.UserID)
	if err != nil {
		return nil, err
	}

	perms, _ := s.repo.GetUserPermissions(ctx, user.RoleID)

	return &MeResponse{
		User: UserProfile{
			ID:                 user.ID,
			TenantID:           user.TenantID,
			TenantCode:         user.TenantCode,
			TenantName:         user.TenantName,
			EmployeeCode:       user.EmployeeCode,
			FullName:           user.FullName,
			Email:              user.Email,
			Username:           user.Username,
			RoleID:             user.RoleID,
			RoleCode:           user.RoleCode,
			RoleName:           user.RoleName,
			Status:             user.Status,
			MustChangePassword: user.MustChangePassword,
			Permissions:        perms,
		},
	}, nil
}

func (s *service) ChangePassword(ctx context.Context, req ChangePasswordRequest) error {
	if req.OldPassword == "" || req.NewPassword == "" {
		return fmt.Errorf("%w: mật khẩu cũ và mật khẩu mới không được để trống", apperr.ErrInvalidInput)
	}
	if len(req.NewPassword) < 8 {
		return fmt.Errorf("%w: mật khẩu mới phải có tối thiểu 8 ký tự", apperr.ErrInvalidInput)
	}
	if req.OldPassword == req.NewPassword {
		return fmt.Errorf("%w: mật khẩu mới không được trùng với mật khẩu cũ", apperr.ErrInvalidInput)
	}

	principal, ok := authz.FromContext(ctx)
	if !ok || principal.UserID == "" {
		return apperr.ErrUnauthorized
	}

	user, err := s.repo.GetUserProfile(ctx, principal.TenantID, principal.UserID)
	if err != nil {
		return err
	}

	matched, vErr := crypto.VerifyPassword(req.OldPassword, user.PasswordHash)
	if vErr != nil || !matched {
		return fmt.Errorf("%w: mật khẩu hiện tại không chính xác", apperr.ErrInvalidInput)
	}

	newHash, hErr := crypto.HashPassword(req.NewPassword)
	if hErr != nil {
		return fmt.Errorf("hash new password: %w", hErr)
	}

	if err := s.repo.UpdatePassword(ctx, principal.TenantID, principal.UserID, newHash); err != nil {
		return err
	}

	_ = s.recordAudit(ctx, principal.TenantID, principal.UserID, user.FullName, audit.ActionUpdate, "app_user", principal.UserID, user.Username, "", "Đổi mật khẩu thành công")

	return nil
}

func (s *service) Logout(ctx context.Context, rawToken string) error {
	if rawToken != "" {
		tokenHash := middleware.HashToken(rawToken)
		_ = s.repo.RevokeSession(ctx, tokenHash)
	}
	return nil
}

func (s *service) recordAudit(ctx context.Context, tenantID, actorID, actorName, action, entityType, entityIDStr, entityCode, ip, details string) error {
	if s.pool == nil {
		return nil
	}
	ctxWithTenant := middleware.WithTenantID(ctx, tenantID)

	var entUUID *uuid.UUID
	if entityIDStr != "" {
		if parsed, err := uuid.Parse(entityIDStr); err == nil {
			entUUID = &parsed
		}
	}
	var actUUID *uuid.UUID
	if actorID != "" {
		if parsed, err := uuid.Parse(actorID); err == nil {
			actUUID = &parsed
		}
	}

	return audit.Record(ctxWithTenant, s.pool, audit.Entry{
		Action:      action,
		EntityType:  entityType,
		EntityID:    entUUID,
		EntityCode:  entityCode,
		ActorUserID: actUUID,
		ActorName:   actorName,
		IP:          ip,
		NewData:     map[string]any{"note": details},
	})
}

func sanitizeIP(remoteAddr string) string {
	if remoteAddr == "" {
		return ""
	}
	host, _, err := net.SplitHostPort(remoteAddr)
	if err == nil {
		return host
	}
	return remoteAddr
}

var _ = errors.New
