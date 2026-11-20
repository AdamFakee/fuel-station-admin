package iam_test

import (
	"context"
	"testing"

	"fuel-station-backend/internal/modules/iam"
	"fuel-station-backend/internal/shared/authz"
	"fuel-station-backend/internal/shared/middleware"
	"github.com/jackc/pgx/v5/pgxpool"
)

const (
	testDBURL       = "postgres://postgres:postgres@localhost:5432/fuel_station_db?sslmode=disable"
	defaultTenantID = "11111111-1111-1111-1111-111111111111"
	adminUserID     = "33333333-3333-3333-3333-333333333331"
	branch1ID       = "22222222-2222-2222-2222-222222222221"
)

func setupTest(t *testing.T) (*iam.Service, *pgxpool.Pool, context.Context) {
	ctx := context.Background()
	pool, err := pgxpool.New(ctx, testDBURL)
	if err != nil {
		t.Skipf("skipping test: database not reachable: %v", err)
	}

	// Verify connection
	if err := pool.Ping(ctx); err != nil {
		pool.Close()
		t.Skipf("skipping test: database ping failed: %v", err)
	}

	// Context with TenantID and Admin Principal
	ctx = middleware.WithTenantID(ctx, defaultTenantID)
	principal := authz.NewPrincipal(
		adminUserID,
		defaultTenantID,
		"MANAGER",
		[]string{branch1ID},
		[]authz.Permission{
			"iam.user:view", "iam.user:create", "iam.user:update", "iam.user:delete",
			"iam.role:view", "iam.role:create", "iam.role:update", "iam.role:delete",
		},
	)
	ctx = authz.WithPrincipal(ctx, principal)

	svc := iam.NewService(pool)
	return svc, pool, ctx
}

func TestListPermissionsAndBranches(t *testing.T) {
	svc, pool, ctx := setupTest(t)
	defer pool.Close()

	perms, err := svc.ListPermissions(ctx)
	if err != nil {
		t.Fatalf("ListPermissions failed: %v", err)
	}
	if len(perms) != 61 {
		t.Errorf("expected 61 permissions according to BRD/seed, got %d", len(perms))
	}

	branches, err := svc.ListBranches(ctx)
	if err != nil {
		t.Fatalf("ListBranches failed: %v", err)
	}
	if len(branches) == 0 {
		t.Errorf("expected at least 1 branch, got %d", len(branches))
	}
}

func TestListRoles(t *testing.T) {
	svc, pool, ctx := setupTest(t)
	defer pool.Close()

	roles, err := svc.ListRoles(ctx)
	if err != nil {
		t.Fatalf("ListRoles failed: %v", err)
	}
	if len(roles) < 3 {
		t.Errorf("expected at least 3 system roles, got %d", len(roles))
	}

	// Verify 3 system roles exist
	hasManager, hasAccountant, hasIT := false, false, false
	for _, r := range roles {
		switch r.Code {
		case "MANAGER":
			hasManager = true
		case "ACCOUNTANT":
			hasAccountant = true
		case "IT":
			hasIT = true
		}
	}
	if !hasManager || !hasAccountant || !hasIT {
		t.Errorf("missing one of default roles: MANAGER=%v, ACCOUNTANT=%v, IT=%v", hasManager, hasAccountant, hasIT)
	}
}

func TestUserLifecycleAndProtections(t *testing.T) {
	svc, pool, ctx := setupTest(t)
	defer pool.Close()

	// 1. Fetch accountant role ID for testing
	roles, err := svc.ListRoles(ctx)
	if err != nil {
		t.Fatalf("list roles: %v", err)
	}
	var accRoleID string
	for _, r := range roles {
		if r.Code == "ACCOUNTANT" {
			accRoleID = r.ID
			break
		}
	}
	if accRoleID == "" {
		t.Fatal("ACCOUNTANT role not found")
	}

	// 2. Create User
	req := iam.CreateUserRequest{
		EmployeeCode: "NV-TEST-99",
		FullName:     "Nhân Viên Thử Nghiệm",
		Email:        "test.user99@petrovn.vn",
		Phone:        "0911223344",
		Username:     "testuser99",
		Password:     "Password@123456",
		RoleID:       accRoleID,
		BranchIDs:    []string{branch1ID},
	}

	created, err := svc.CreateUser(ctx, req)
	if err != nil {
		t.Fatalf("CreateUser failed: %v", err)
	}
	if created.EmployeeCode != req.EmployeeCode {
		t.Errorf("expected code %s, got %s", req.EmployeeCode, created.EmployeeCode)
	}

	defer func() {
		// Clean up created user if still exists
		_, _ = pool.Exec(context.Background(), `DELETE FROM station.user_branch WHERE user_id = $1`, created.ID)
		_, _ = pool.Exec(context.Background(), `DELETE FROM station.app_user WHERE id = $1`, created.ID)
	}()

	// 3. Duplicate checks
	_, err = svc.CreateUser(ctx, req)
	if err == nil {
		t.Error("expected duplicate code error, got nil")
	}

	// 4. Get User
	fetched, err := svc.GetUser(ctx, created.ID)
	if err != nil {
		t.Fatalf("GetUser failed: %v", err)
	}
	if fetched.ID != created.ID || fetched.FullName != req.FullName {
		t.Errorf("fetched user mismatch: %+v", fetched)
	}

	// 5. Update User
	updateReq := iam.UpdateUserRequest{
		FullName:  "Nhân Viên Đã Cập Nhật",
		Email:     "test.updated99@petrovn.vn",
		Phone:     "0988776655",
		RoleID:    accRoleID,
		BranchIDs: []string{branch1ID},
	}
	updated, err := svc.UpdateUser(ctx, created.ID, updateReq)
	if err != nil {
		t.Fatalf("UpdateUser failed: %v", err)
	}
	if updated.FullName != updateReq.FullName {
		t.Errorf("expected updated name %s, got %s", updateReq.FullName, updated.FullName)
	}

	// 6. Lock and Unlock User
	err = svc.UpdateUserStatus(ctx, created.ID, "locked")
	if err != nil {
		t.Fatalf("lock user failed: %v", err)
	}

	err = svc.UpdateUserStatus(ctx, created.ID, "active")
	if err != nil {
		t.Fatalf("unlock user failed: %v", err)
	}

	// 7. Reset Password
	err = svc.ResetPassword(ctx, created.ID, "NewPassword@654321")
	if err != nil {
		t.Fatalf("reset password failed: %v", err)
	}

	// 8. Delete User
	err = svc.DeleteUser(ctx, created.ID)
	if err != nil {
		t.Fatalf("delete user failed: %v", err)
	}

	// SAFETY TEST: Cannot self-lock
	err = svc.UpdateUserStatus(ctx, adminUserID, "locked")
	if err == nil {
		t.Error("expected error when admin locks own account, got nil")
	}

	// SAFETY TEST: Cannot self-delete
	err = svc.DeleteUser(ctx, adminUserID)
	if err == nil {
		t.Error("expected error when admin deletes own account, got nil")
	}
}

func TestRoleLifecycleAndProtections(t *testing.T) {
	svc, pool, ctx := setupTest(t)
	defer pool.Close()

	// 1. Fetch a system role ID (MANAGER)
	roles, err := svc.ListRoles(ctx)
	if err != nil {
		t.Fatalf("list roles: %v", err)
	}
	var managerRoleID string
	for _, r := range roles {
		if r.Code == "MANAGER" {
			managerRoleID = r.ID
			break
		}
	}

	// SAFETY TEST: Cannot delete system role
	err = svc.DeleteRole(ctx, managerRoleID)
	if err == nil {
		t.Error("expected error when deleting system role MANAGER, got nil")
	}

	// 2. Create custom role
	createRoleReq := iam.CreateRoleRequest{
		Code:            "DISPATCHER",
		Name:            "Điều phối viên",
		Description:     "Chuyên điều phối xe và tài xế",
		PermissionCodes: []string{"master.vehicle:view", "master.driver:view"},
	}

	role, err := svc.CreateRole(ctx, createRoleReq)
	if err != nil {
		t.Fatalf("CreateRole failed: %v", err)
	}
	defer func() {
		_, _ = pool.Exec(context.Background(), `DELETE FROM station.role_permission WHERE role_id = $1`, role.ID)
		_, _ = pool.Exec(context.Background(), `DELETE FROM station.role WHERE id = $1`, role.ID)
	}()

	if role.Code != createRoleReq.Code || len(role.PermissionCodes) != 2 {
		t.Errorf("role created mismatch: %+v", role)
	}

	// 3. Update custom role
	updateRoleReq := iam.UpdateRoleRequest{
		Name:            "Điều phối viên Đội xe",
		Description:     "Điều phối xe, tài xế và hạn mức",
		PermissionCodes: []string{"master.vehicle:view", "master.driver:view", "master.quota:view"},
	}
	updatedRole, err := svc.UpdateRole(ctx, role.ID, updateRoleReq)
	if err != nil {
		t.Fatalf("UpdateRole failed: %v", err)
	}
	if len(updatedRole.PermissionCodes) != 3 {
		t.Errorf("expected 3 permissions after update, got %d", len(updatedRole.PermissionCodes))
	}

	// 4. Delete custom role
	err = svc.DeleteRole(ctx, role.ID)
	if err != nil {
		t.Fatalf("DeleteRole failed: %v", err)
	}
}
