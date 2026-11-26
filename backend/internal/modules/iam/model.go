package iam

import (
	"time"

	"github.com/google/uuid"
)

type UserListItem struct {
	ID                 string     `json:"id"`
	EmployeeCode       string     `json:"employee_code"`
	FullName           string     `json:"full_name"`
	Email              string     `json:"email"`
	Phone              string     `json:"phone"`
	Username           string     `json:"username"`
	RoleID             string     `json:"role_id"`
	RoleCode           string     `json:"role_code"`
	RoleName           string     `json:"role_name"`
	Status             string     `json:"status"`
	MustChangePassword bool       `json:"must_change_password"`
	LastLoginAt        *time.Time `json:"last_login_at,omitempty"`
	CreatedAt          time.Time  `json:"created_at"`
	UpdatedAt          time.Time  `json:"updated_at"`
}

type UserDetail struct {
	UserListItem
}

type CreateUserRequest struct {
	EmployeeCode string `json:"employee_code"`
	FullName     string `json:"full_name"`
	Email        string `json:"email"`
	Phone        string `json:"phone"`
	Username     string `json:"username"`
	Password     string `json:"password"`
	RoleID       string `json:"role_id"`
}

type UpdateUserRequest struct {
	FullName string `json:"full_name"`
	Email    string `json:"email"`
	Phone    string `json:"phone"`
	RoleID   string `json:"role_id"`
}

type UpdateUserStatusRequest struct {
	Status string `json:"status"` // 'active' | 'locked'
}

type ResetPasswordRequest struct {
	NewPassword string `json:"new_password"`
}

type RoleListItem struct {
	ID              string    `json:"id"`
	Code            string    `json:"code"`
	Name            string    `json:"name"`
	Description     string    `json:"description"`
	IsSystem        bool      `json:"is_system"`
	UserCount       int       `json:"user_count"`
	PermissionCount int       `json:"permission_count"`
	CreatedAt       time.Time `json:"created_at"`
	UpdatedAt       time.Time `json:"updated_at"`
}

type RoleDetail struct {
	ID              string    `json:"id"`
	Code            string    `json:"code"`
	Name            string    `json:"name"`
	Description     string    `json:"description"`
	IsSystem        bool      `json:"is_system"`
	PermissionCodes []string  `json:"permission_codes"`
	CreatedAt       time.Time `json:"created_at"`
	UpdatedAt       time.Time `json:"updated_at"`
}

type CreateRoleRequest struct {
	Code            string   `json:"code"`
	Name            string   `json:"name"`
	Description     string   `json:"description"`
	PermissionCodes []string `json:"permission_codes"`
}

type UpdateRoleRequest struct {
	Name            string   `json:"name"`
	Description     string   `json:"description"`
	PermissionCodes []string `json:"permission_codes"`
}

type PermissionItem struct {
	Code        string `json:"code"`
	Module      string `json:"module"`
	Action      string `json:"action"`
	Description string `json:"description"`
	// Chỉ vai trò Quản trị hệ thống được giữ: ma trận quyền khóa ô này.
	SuperAdminOnly bool `json:"super_admin_only"`
}

type BranchOption struct {
	ID      string `json:"id"`
	Code    string `json:"code"`
	Name    string `json:"name"`
	Address string `json:"address,omitempty"`
}

type UserListQuery struct {
	Page     int    `json:"page"`
	PageSize int    `json:"page_size"`
	Search   string `json:"search"`
	RoleID   string `json:"role_id"`
	Status   string `json:"status"`
}

type PagedResponse[T any] struct {
	Items      []T `json:"items"`
	Total      int `json:"total"`
	Page       int `json:"page"`
	PageSize   int `json:"page_size"`
	TotalPages int `json:"total_pages"`
}

func parseUUID(s string) (uuid.UUID, error) {
	return uuid.Parse(s)
}
