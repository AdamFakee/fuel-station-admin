package main

import (
	"context"
	"fmt"
	"log"

	"fuel-station-backend/internal/platform/crypto"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

const (
	defaultTenantID = "11111111-1111-1111-1111-111111111111"
	branch1ID       = "22222222-2222-2222-2222-222222222221"
	branch2ID       = "22222222-2222-2222-2222-222222222222"
	adminUserID     = "33333333-3333-3333-3333-333333333331"
	accountantID    = "33333333-3333-3333-3333-333333333332"
	itUserID        = "33333333-3333-3333-3333-333333333333"
)

func main() {
	ctx := context.Background()
	dbURL := "postgres://postgres:postgres@localhost:5432/fuel_station_db?sslmode=disable"

	pool, err := pgxpool.New(ctx, dbURL)
	if err != nil {
		log.Fatalf("connect to db: %v", err)
	}
	defer pool.Close()

	tenantUUID := uuid.MustParse(defaultTenantID)

	// 1. Seed Tenant
	_, err = pool.Exec(ctx, `
		INSERT INTO station.tenant (id, code, name, status)
		VALUES ($1, 'PETRO-VN', 'Tổng Công ty Xăng dầu Demo', 'active')
		ON CONFLICT (id) DO NOTHING;
	`, tenantUUID)
	if err != nil {
		log.Fatalf("seed tenant: %v", err)
	}

	// 2. Seed Tenant Defaults (Setting, 3 system roles: MANAGER, ACCOUNTANT, IT + permissions)
	_, err = pool.Exec(ctx, `SELECT station.seed_tenant_defaults($1);`, tenantUUID)
	if err != nil {
		log.Fatalf("seed tenant defaults: %v", err)
	}

	// 3. Seed Branches
	_, err = pool.Exec(ctx, `
		INSERT INTO station.branch (id, tenant_id, code, name, address, manager_name, phone, status)
		VALUES 
			($1, $2, 'BR-01', 'Trạm Xăng Cầu Giấy', '123 Đường Cầu Giấy, Hà Nội', 'Nguyễn Văn Quản Lý', '0901234567', 'active'),
			($3, $2, 'BR-02', 'Kho Nhiên Liệu Hải Phòng', '456 Cảng Đình Vũ, Hải Phòng', 'Lê Kế Toán', '0912345678', 'active')
		ON CONFLICT (tenant_id, id) DO NOTHING;
	`, uuid.MustParse(branch1ID), tenantUUID, uuid.MustParse(branch2ID))
	if err != nil {
		log.Fatalf("seed branches: %v", err)
	}

	// 4. Retrieve Role IDs
	var managerRoleID, accountantRoleID, itRoleID uuid.UUID
	err = pool.QueryRow(ctx, `SELECT id FROM station.role WHERE tenant_id = $1 AND code = 'MANAGER'`, tenantUUID).Scan(&managerRoleID)
	if err != nil {
		log.Fatalf("query manager role: %v", err)
	}
	err = pool.QueryRow(ctx, `SELECT id FROM station.role WHERE tenant_id = $1 AND code = 'ACCOUNTANT'`, tenantUUID).Scan(&accountantRoleID)
	if err != nil {
		log.Fatalf("query accountant role: %v", err)
	}
	err = pool.QueryRow(ctx, `SELECT id FROM station.role WHERE tenant_id = $1 AND code = 'IT'`, tenantUUID).Scan(&itRoleID)
	if err != nil {
		log.Fatalf("query it role: %v", err)
	}

	// 5. Hash passwords
	adminHash, err := crypto.HashPassword("Admin@123456")
	if err != nil {
		log.Fatalf("hash admin pw: %v", err)
	}
	accHash, err := crypto.HashPassword("Accountant@123456")
	if err != nil {
		log.Fatalf("hash acc pw: %v", err)
	}
	itHash, err := crypto.HashPassword("TechIT@123456")
	if err != nil {
		log.Fatalf("hash it pw: %v", err)
	}

	// 6. Seed Users
	users := []struct {
		id       string
		code     string
		name     string
		email    string
		phone    string
		username string
		hash     string
		roleID   uuid.UUID
	}{
		{adminUserID, "NV-0001", "Nguyễn Văn Quản Lý", "admin@petrovn.vn", "0901234567", "admin", adminHash, managerRoleID},
		{accountantID, "NV-0002", "Trần Thị Kế Toán", "ketoan@petrovn.vn", "0912345678", "ketoan", accHash, accountantRoleID},
		{itUserID, "NV-0003", "Phạm Kỹ Thuật", "it@petrovn.vn", "0987654321", "itadmin", itHash, itRoleID},
	}

	for _, u := range users {
		_, err = pool.Exec(ctx, `
			INSERT INTO station.app_user (id, tenant_id, employee_code, full_name, email, phone, username, password_hash, role_id, status, must_change_password)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'active', FALSE)
			ON CONFLICT (tenant_id, id) DO NOTHING;
		`, uuid.MustParse(u.id), tenantUUID, u.code, u.name, u.email, u.phone, u.username, u.hash, u.roleID)
		if err != nil {
			log.Fatalf("seed user %s: %v", u.username, err)
		}

		// Assign both branches to all users
		_, err = pool.Exec(ctx, `
			INSERT INTO station.user_branch (tenant_id, user_id, branch_id)
			VALUES 
				($1, $2, $3),
				($1, $2, $4)
			ON CONFLICT (user_id, branch_id) DO NOTHING;
		`, tenantUUID, uuid.MustParse(u.id), uuid.MustParse(branch1ID), uuid.MustParse(branch2ID))
		if err != nil {
			log.Fatalf("seed user_branch %s: %v", u.username, err)
		}
	}

	fmt.Println("Database seeded successfully with Tenant, Roles, Branches, and 3 Users (admin, ketoan, itadmin)!")
}
