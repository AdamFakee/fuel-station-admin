package auth

import "time"

// LoginRequest carries payload for user authentication.
type LoginRequest struct {
	TenantCode string `json:"tenant_code"`
	Username   string `json:"username"`
	Password   string `json:"password"`
	RememberMe bool   `json:"remember_me"`
}

// TenantSummary represents company / tenant basic info.
type TenantSummary struct {
	ID   string `json:"id"`
	Code string `json:"code"`
	Name string `json:"name"`
}

// UserProfile represents full user identity, tenant, role, and permission scopes.
type UserProfile struct {
	ID                 string     `json:"id"`
	TenantID           string     `json:"tenant_id"`
	TenantCode         string     `json:"tenant_code"`
	TenantName         string     `json:"tenant_name"`
	EmployeeCode       string     `json:"employee_code"`
	FullName           string     `json:"full_name"`
	Email              string     `json:"email"`
	Phone              string     `json:"phone,omitempty"`
	Username           string     `json:"username"`
	RoleID             string     `json:"role_id"`
	RoleCode           string     `json:"role_code"`
	RoleName           string     `json:"role_name"`
	Status             string     `json:"status"`
	MustChangePassword bool       `json:"must_change_password"`
	BranchIDs          []string   `json:"branch_ids"`
	Permissions        []string   `json:"permissions"`
	LastLoginAt        *time.Time `json:"last_login_at,omitempty"`
}

// LoginResponse returns token, expiry, and user profile with permissions.
type LoginResponse struct {
	Token     string      `json:"token"`
	ExpiresAt time.Time   `json:"expires_at"`
	User      UserProfile `json:"user"`
}

// MeResponse returns current authenticated profile.
type MeResponse struct {
	User UserProfile `json:"user"`
}

// ChangePasswordRequest carries credentials for updating user password.
type ChangePasswordRequest struct {
	OldPassword string `json:"old_password"`
	NewPassword string `json:"new_password"`
}
