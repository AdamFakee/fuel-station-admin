package auth_test

import (
	"context"
	"errors"
	"io"
	"log/slog"
	"testing"
	"time"

	"fuel-station-backend/internal/modules/auth"
	"fuel-station-backend/internal/platform/crypto"
	"fuel-station-backend/internal/shared/apperr"
	"fuel-station-backend/internal/shared/authz"
)

type mockRepo struct {
	findTenantByCodeFunc      func(ctx context.Context, code string) (*auth.TenantSummary, error)
	findUserByLoginFunc       func(ctx context.Context, tenantID, identifier string) (*auth.UserRecord, error)
	findUserAcrossTenantsFunc func(ctx context.Context, identifier string) ([]*auth.UserRecord, error)
	getTenantSettingFunc      func(ctx context.Context, tenantID string) (*auth.TenantSettingRecord, error)
	recordFailedLoginFunc     func(ctx context.Context, tenantID, userID string, maxFailed, lockoutMinutes int) (int, *time.Time, error)
	resetFailedLoginFunc      func(ctx context.Context, tenantID, userID, ip string) error
	createSessionFunc         func(ctx context.Context, tenantID, userID, tokenHash string, rememberMe bool, ip, userAgent string, expiresAt time.Time) error
	revokeSessionFunc         func(ctx context.Context, tokenHash string) error
	revokeAllUserSessionsFunc func(ctx context.Context, tenantID, userID string) error
	getUserPermissionsFunc    func(ctx context.Context, roleID string) ([]string, error)
	getUserBranchIDsFunc      func(ctx context.Context, tenantID, userID string) ([]string, error)
	updatePasswordFunc        func(ctx context.Context, tenantID, userID, newHash string) error
	getUserProfileFunc        func(ctx context.Context, tenantID, userID string) (*auth.UserRecord, error)
}

func (m *mockRepo) FindTenantByCode(ctx context.Context, code string) (*auth.TenantSummary, error) {
	if m.findTenantByCodeFunc != nil {
		return m.findTenantByCodeFunc(ctx, code)
	}
	return nil, apperr.ErrNotFound
}

func (m *mockRepo) FindUserByLogin(ctx context.Context, tenantID, identifier string) (*auth.UserRecord, error) {
	if m.findUserByLoginFunc != nil {
		return m.findUserByLoginFunc(ctx, tenantID, identifier)
	}
	return nil, apperr.ErrNotFound
}

func (m *mockRepo) FindUserAcrossTenants(ctx context.Context, identifier string) ([]*auth.UserRecord, error) {
	if m.findUserAcrossTenantsFunc != nil {
		return m.findUserAcrossTenantsFunc(ctx, identifier)
	}
	return nil, nil
}

func (m *mockRepo) GetTenantSetting(ctx context.Context, tenantID string) (*auth.TenantSettingRecord, error) {
	if m.getTenantSettingFunc != nil {
		return m.getTenantSettingFunc(ctx, tenantID)
	}
	return &auth.TenantSettingRecord{MaxFailedLogins: 5, LockoutMinutes: 15}, nil
}

func (m *mockRepo) RecordFailedLogin(ctx context.Context, tenantID, userID string, maxFailed, lockoutMinutes int) (int, *time.Time, error) {
	if m.recordFailedLoginFunc != nil {
		return m.recordFailedLoginFunc(ctx, tenantID, userID, maxFailed, lockoutMinutes)
	}
	return 1, nil, nil
}

func (m *mockRepo) ResetFailedLogin(ctx context.Context, tenantID, userID, ip string) error {
	if m.resetFailedLoginFunc != nil {
		return m.resetFailedLoginFunc(ctx, tenantID, userID, ip)
	}
	return nil
}

func (m *mockRepo) CreateSession(ctx context.Context, tenantID, userID, tokenHash string, rememberMe bool, ip, userAgent string, expiresAt time.Time) error {
	if m.createSessionFunc != nil {
		return m.createSessionFunc(ctx, tenantID, userID, tokenHash, rememberMe, ip, userAgent, expiresAt)
	}
	return nil
}

func (m *mockRepo) RevokeSession(ctx context.Context, tokenHash string) error {
	if m.revokeSessionFunc != nil {
		return m.revokeSessionFunc(ctx, tokenHash)
	}
	return nil
}

func (m *mockRepo) RevokeAllUserSessions(ctx context.Context, tenantID, userID string) error {
	if m.revokeAllUserSessionsFunc != nil {
		return m.revokeAllUserSessionsFunc(ctx, tenantID, userID)
	}
	return nil
}

func (m *mockRepo) GetUserPermissions(ctx context.Context, roleID string) ([]string, error) {
	if m.getUserPermissionsFunc != nil {
		return m.getUserPermissionsFunc(ctx, roleID)
	}
	return []string{"dashboard:view"}, nil
}

func (m *mockRepo) GetUserBranchIDs(ctx context.Context, tenantID, userID string) ([]string, error) {
	if m.getUserBranchIDsFunc != nil {
		return m.getUserBranchIDsFunc(ctx, tenantID, userID)
	}
	return []string{"b1"}, nil
}

func (m *mockRepo) UpdatePassword(ctx context.Context, tenantID, userID, newHash string) error {
	if m.updatePasswordFunc != nil {
		return m.updatePasswordFunc(ctx, tenantID, userID, newHash)
	}
	return nil
}

func (m *mockRepo) GetUserProfile(ctx context.Context, tenantID, userID string) (*auth.UserRecord, error) {
	if m.getUserProfileFunc != nil {
		return m.getUserProfileFunc(ctx, tenantID, userID)
	}
	return nil, apperr.ErrNotFound
}

func testLogger() *slog.Logger {
	return slog.New(slog.NewTextHandler(io.Discard, nil))
}

func TestAuthService_LoginValidation(t *testing.T) {
	repo := &mockRepo{}
	svc := auth.NewService(repo, nil, testLogger())

	// Empty credentials
	_, err := svc.Login(context.Background(), auth.LoginRequest{Username: "", Password: ""}, "127.0.0.1", "test")
	if !errors.Is(err, apperr.ErrInvalidInput) {
		t.Fatalf("expected ErrInvalidInput, got %v", err)
	}
}

func TestAuthService_LockedAccount(t *testing.T) {
	repo := &mockRepo{
		findUserAcrossTenantsFunc: func(ctx context.Context, identifier string) ([]*auth.UserRecord, error) {
			return []*auth.UserRecord{
				{
					ID:       "u1",
					TenantID: "t1",
					Username: "locked_user",
					Status:   "locked",
				},
			}, nil
		},
	}
	svc := auth.NewService(repo, nil, testLogger())

	_, err := svc.Login(context.Background(), auth.LoginRequest{Username: "locked_user", Password: "any"}, "127.0.0.1", "test")
	if !errors.Is(err, apperr.ErrForbidden) {
		t.Fatalf("expected ErrForbidden for locked user, got %v", err)
	}
}

func TestAuthService_TemporaryLockout(t *testing.T) {
	futureLock := time.Now().UTC().Add(10 * time.Minute)
	repo := &mockRepo{
		findUserAcrossTenantsFunc: func(ctx context.Context, identifier string) ([]*auth.UserRecord, error) {
			return []*auth.UserRecord{
				{
					ID:          "u1",
					TenantID:    "t1",
					Username:    "temp_locked",
					Status:      "active",
					LockedUntil: &futureLock,
				},
			}, nil
		},
	}
	svc := auth.NewService(repo, nil, testLogger())

	_, err := svc.Login(context.Background(), auth.LoginRequest{Username: "temp_locked", Password: "any"}, "127.0.0.1", "test")
	if !errors.Is(err, apperr.ErrForbidden) {
		t.Fatalf("expected ErrForbidden for temporarily locked user, got %v", err)
	}
}

func TestAuthService_SuccessfulLogin(t *testing.T) {
	passHash, _ := crypto.HashPassword("Secret123")
	repo := &mockRepo{
		findUserAcrossTenantsFunc: func(ctx context.Context, identifier string) ([]*auth.UserRecord, error) {
			return []*auth.UserRecord{
				{
					ID:           "u1",
					TenantID:     "t1",
					TenantCode:   "CTY1",
					TenantName:   "Công ty 1",
					Username:     "valid_user",
					PasswordHash: passHash,
					RoleID:       "r1",
					RoleCode:     "MANAGER",
					RoleName:     "Quản lý",
					Status:       "active",
				},
			}, nil
		},
	}
	svc := auth.NewService(repo, nil, testLogger())

	resp, err := svc.Login(context.Background(), auth.LoginRequest{
		Username:   "valid_user",
		Password:   "Secret123",
		RememberMe: true,
	}, "127.0.0.1", "test")

	if err != nil {
		t.Fatalf("unexpected login error: %v", err)
	}
	if resp.Token == "" {
		t.Fatal("expected token in response")
	}
	if resp.User.Username != "valid_user" {
		t.Fatalf("expected valid_user, got %s", resp.User.Username)
	}
}

func TestAuthService_ChangePassword(t *testing.T) {
	oldHash, _ := crypto.HashPassword("OldPass123")
	repo := &mockRepo{
		getUserProfileFunc: func(ctx context.Context, tenantID, userID string) (*auth.UserRecord, error) {
			return &auth.UserRecord{
				ID:           userID,
				TenantID:     tenantID,
				PasswordHash: oldHash,
			}, nil
		},
	}
	svc := auth.NewService(repo, nil, testLogger())

	principal := authz.NewPrincipal("u1", "t1", "MANAGER", nil)
	ctx := authz.WithPrincipal(context.Background(), principal)

	// Short password
	err := svc.ChangePassword(ctx, auth.ChangePasswordRequest{OldPassword: "OldPass123", NewPassword: "short"})
	if !errors.Is(err, apperr.ErrInvalidInput) {
		t.Fatalf("expected ErrInvalidInput for short password, got %v", err)
	}

	// Same password
	err = svc.ChangePassword(ctx, auth.ChangePasswordRequest{OldPassword: "OldPass123", NewPassword: "OldPass123"})
	if !errors.Is(err, apperr.ErrInvalidInput) {
		t.Fatalf("expected ErrInvalidInput for same password, got %v", err)
	}

	// Wrong old password
	err = svc.ChangePassword(ctx, auth.ChangePasswordRequest{OldPassword: "WrongOldPassword", NewPassword: "NewValidPassword123"})
	if !errors.Is(err, apperr.ErrInvalidInput) {
		t.Fatalf("expected ErrInvalidInput for wrong old password, got %v", err)
	}

	// Success
	err = svc.ChangePassword(ctx, auth.ChangePasswordRequest{OldPassword: "OldPass123", NewPassword: "NewValidPassword123"})
	if err != nil {
		t.Fatalf("unexpected change password error: %v", err)
	}
}
