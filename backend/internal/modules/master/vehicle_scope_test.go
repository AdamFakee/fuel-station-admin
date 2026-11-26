package master_test

import (
	"context"
	"fmt"
	"strings"
	"testing"
	"time"

	"fuel-station-backend/internal/modules/master"
	"fuel-station-backend/internal/shared/authz"
	"fuel-station-backend/internal/shared/middleware"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

// Test tích hợp dùng DB dev (bỏ qua nếu không nối được), cùng cách với module assets.
const (
	scopeTestDBURL = "postgres://postgres:postgres@localhost:5432/fuel_station_db?sslmode=disable"
	scopeTenantID  = "11111111-1111-1111-1111-111111111111"
	scopeAdminID   = "33333333-3333-3333-3333-333333333331"
)

func scopeSetup(t *testing.T) (*master.Service, *pgxpool.Pool, context.Context, uuid.UUID) {
	ctx := context.Background()
	pool, err := pgxpool.New(ctx, scopeTestDBURL)
	if err != nil {
		t.Skipf("skipping test: database not reachable: %v", err)
	}
	if err := pool.Ping(ctx); err != nil {
		pool.Close()
		t.Skipf("skipping test: database ping failed: %v", err)
	}

	var fuelTypeID uuid.UUID
	if err := pool.QueryRow(ctx, `SELECT id FROM station.fuel_type WHERE tenant_id = $1 ORDER BY created_at LIMIT 1`, scopeTenantID).Scan(&fuelTypeID); err != nil {
		pool.Close()
		t.Skipf("skipping test: no fuel type: %v", err)
	}

	ctx = middleware.WithTenantID(ctx, scopeTenantID)
	ctx = authz.WithPrincipal(ctx, authz.NewPrincipal(scopeAdminID, scopeTenantID, "MANAGER", []authz.Permission{
		"master.vehicle:view", "master.vehicle:create", "master.vehicle:update", "master.vehicle:delete",
		"master.driver:view", "master.driver:create", "master.driver:update",
	}))
	return master.NewService(pool, nil), pool, ctx, fuelTypeID
}

// Xe là dữ liệu cấp công ty (đổ được ở mọi trạm xăng): tạo và sửa không cần, cũng không trả về, danh sách trạm xăng.
func TestVehicleIsCompanyLevel(t *testing.T) {
	svc, pool, ctx, fuelTypeID := scopeSetup(t)
	defer pool.Close()

	suffix := time.Now().UnixNano() % 1000000
	created, err := svc.CreateVehicle(ctx, master.CreateVehicleRequest{
		Plate: fmt.Sprintf("99Z-%06d", suffix), FuelTypeID: fuelTypeID,
		CardNumber: fmt.Sprintf("%010d", 3000000000+suffix%1000000),
	})
	if err != nil {
		t.Fatalf("CreateVehicle failed: %v", err)
	}
	defer func() { _ = svc.DeleteVehicle(ctx, created.ID) }()
	if created.Code == "" {
		t.Fatal("expected a generated vehicle code")
	}

	versionBefore := created.Version
	updated, err := svc.UpdateVehicle(ctx, created.ID, master.UpdateVehicleRequest{
		Plate: created.Plate, FuelTypeID: fuelTypeID, Note: "đổi ghi chú",
	})
	if err != nil {
		t.Fatalf("UpdateVehicle failed: %v", err)
	}
	if updated.Version <= versionBefore {
		t.Fatalf("expected the vehicle version to increase (was %d, now %d)", versionBefore, updated.Version)
	}
}

// Tài xế là dữ liệu cấp công ty: tạo không cần trạm xăng hay vị trí.
func TestDriverHasNoStoreOrPosition(t *testing.T) {
	svc, pool, ctx, _ := scopeSetup(t)
	defer pool.Close()

	created, err := svc.CreateDriver(ctx, master.CreateDriverRequest{FullName: "Tài xế cấp công ty"})
	if err != nil {
		t.Fatalf("CreateDriver without branch/position failed: %v", err)
	}
	defer func() { _ = svc.DeleteDriver(ctx, created.ID) }()
	if created.Status != "active" {
		t.Fatalf("expected default status active, got %s", created.Status)
	}
	// Mã do hệ thống sinh, chỉ chữ và số (dùng làm employeeNo trên máy chấm công).
	if !strings.HasPrefix(created.Code, "TX") || strings.ContainsAny(created.Code, "-_ ") {
		t.Fatalf("expected a generated alphanumeric code TX..., got %q", created.Code)
	}
}
