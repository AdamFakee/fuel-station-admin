package master_test

import (
	"context"
	"errors"
	"fmt"
	"testing"
	"time"

	"fuel-station-backend/internal/modules/master"
	"fuel-station-backend/internal/shared/apperr"
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
	scopeBranchA   = "22222222-2222-2222-2222-222222222221"
	scopeBranchB   = "22222222-2222-2222-2222-222222222222"
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
	ctx = authz.WithPrincipal(ctx, authz.NewPrincipal(scopeAdminID, scopeTenantID, "MANAGER", nil, []authz.Permission{
		"master.vehicle:view", "master.vehicle:create", "master.vehicle:update", "master.vehicle:delete",
		"master.driver:view", "master.driver:create", "master.driver:update",
	}))
	return master.NewService(pool, nil), pool, ctx, fuelTypeID
}

func branchSet(ids []uuid.UUID) map[string]bool {
	out := make(map[string]bool, len(ids))
	for _, id := range ids {
		out[id.String()] = true
	}
	return out
}

// Xe nhiều-nhiều trạm xăng được phép: tạo, đổi, lọc theo trạm xăng; không chọn thì không được đổ ở đâu.
func TestVehicleAllowedStoresLifecycle(t *testing.T) {
	svc, pool, ctx, fuelTypeID := scopeSetup(t)
	defer pool.Close()

	a, b := uuid.MustParse(scopeBranchA), uuid.MustParse(scopeBranchB)
	suffix := time.Now().UnixNano() % 1000000

	// 1. Tạo xe chỉ được phép ở A
	created, err := svc.CreateVehicle(ctx, master.CreateVehicleRequest{
		Plate: fmt.Sprintf("99Z-%06d", suffix), FuelTypeID: fuelTypeID,
		BranchIDs:  []uuid.UUID{a, a}, // trùng thì được gộp
		CardNumber: fmt.Sprintf("%010d", 3000000000+suffix%1000000),
	})
	if err != nil {
		t.Fatalf("CreateVehicle failed: %v", err)
	}
	defer func() { _ = svc.DeleteVehicle(ctx, created.ID) }()
	code := created.Code // mã do hệ thống sinh
	if code == "" {
		t.Fatal("expected a generated vehicle code")
	}
	if got := branchSet(created.BranchIDs); len(got) != 1 || !got[a.String()] {
		t.Fatalf("expected only store A, got %v", created.BranchIDs)
	}

	// 2. Lọc theo trạm xăng: thấy ở A, không thấy ở B
	inA, _, err := svc.ListVehicles(ctx, master.VehicleListQuery{Search: code, BranchID: &a, PageSize: 20})
	if err != nil || len(inA) != 1 {
		t.Fatalf("expected the vehicle in store A, got %d (err %v)", len(inA), err)
	}
	inB, _, err := svc.ListVehicles(ctx, master.VehicleListQuery{Search: code, BranchID: &b, PageSize: 20})
	if err != nil || len(inB) != 0 {
		t.Fatalf("expected the vehicle NOT in store B, got %d (err %v)", len(inB), err)
	}

	// 3. Sửa sang A và B: phiên bản của xe tăng để Edge Agent kéo lại
	versionBefore := created.Version
	updated, err := svc.UpdateVehicle(ctx, created.ID, master.UpdateVehicleRequest{
		Plate: created.Plate, FuelTypeID: fuelTypeID, BranchIDs: []uuid.UUID{a, b},
	})
	if err != nil {
		t.Fatalf("UpdateVehicle failed: %v", err)
	}
	if got := branchSet(updated.BranchIDs); len(got) != 2 || !got[a.String()] || !got[b.String()] {
		t.Fatalf("expected stores A and B, got %v", updated.BranchIDs)
	}
	if updated.Version <= versionBefore {
		t.Fatalf("expected the vehicle version to increase (was %d, now %d)", versionBefore, updated.Version)
	}

	// 4. Bỏ hết trạm xăng: xe không được đổ ở đâu cả
	cleared, err := svc.UpdateVehicle(ctx, created.ID, master.UpdateVehicleRequest{
		Plate: created.Plate, FuelTypeID: fuelTypeID, BranchIDs: nil,
	})
	if err != nil {
		t.Fatalf("UpdateVehicle (clear) failed: %v", err)
	}
	if len(cleared.BranchIDs) != 0 {
		t.Fatalf("expected no allowed stores, got %v", cleared.BranchIDs)
	}

	// 5. Trạm xăng không tồn tại bị từ chối
	_, err = svc.UpdateVehicle(ctx, created.ID, master.UpdateVehicleRequest{
		Plate: created.Plate, FuelTypeID: fuelTypeID, BranchIDs: []uuid.UUID{uuid.New()},
	})
	if err == nil || !isInvalidInput(err) {
		t.Fatalf("expected ErrInvalidInput for an unknown store, got %v", err)
	}
}

func isInvalidInput(err error) bool {
	for e := err; e != nil; {
		if e == apperr.ErrInvalidInput {
			return true
		}
		u, ok := e.(interface{ Unwrap() error })
		if !ok {
			return false
		}
		e = u.Unwrap()
	}
	return false
}

// Tài xế là dữ liệu cấp công ty: tạo không cần trạm xăng hay vị trí.
func TestDriverHasNoStoreOrPosition(t *testing.T) {
	svc, pool, ctx, _ := scopeSetup(t)
	defer pool.Close()

	suffix := time.Now().UnixNano() % 1000000
	created, err := svc.CreateDriver(ctx, master.CreateDriverRequest{
		Code: fmt.Sprintf("DS%d", suffix), FullName: "Tài xế cấp công ty",
	})
	if err != nil {
		t.Fatalf("CreateDriver without branch/position failed: %v", err)
	}
	defer func() { _ = svc.DeleteDriver(ctx, created.ID) }()
	if created.Status != "active" {
		t.Fatalf("expected default status active, got %s", created.Status)
	}
}

// Người thao tác chỉ có trạm xăng B không được thấy hay sửa xe chỉ được đổ ở trạm xăng A.
func TestVehicleBranchScopeIsolation(t *testing.T) {
	svc, pool, ctx, fuelTypeID := scopeSetup(t)
	defer pool.Close()

	a, _ := uuid.Parse(scopeBranchA)
	suffix := time.Now().UnixNano() % 1000000
	created, err := svc.CreateVehicle(ctx, master.CreateVehicleRequest{
		Plate: fmt.Sprintf("99S-%d", suffix), FuelTypeID: fuelTypeID, BranchIDs: []uuid.UUID{a},
		CardNumber: fmt.Sprintf("%010d", 4000000000+suffix),
	})
	if err != nil {
		t.Fatalf("CreateVehicle failed: %v", err)
	}
	defer func() { _ = svc.DeleteVehicle(ctx, created.ID) }()

	onlyB := authz.WithPrincipal(ctx, authz.NewPrincipal(scopeAdminID, scopeTenantID, "MANAGER", []string{scopeBranchB}, []authz.Permission{
		"master.vehicle:view", "master.vehicle:update",
	}))
	if _, err := svc.GetVehicle(onlyB, created.ID); !errors.Is(err, apperr.ErrNotFound) {
		t.Fatalf("expected ErrNotFound for a vehicle outside the scope, got %v", err)
	}
	if err := svc.DeleteVehicle(onlyB, created.ID); !errors.Is(err, apperr.ErrNotFound) {
		t.Fatalf("expected ErrNotFound when deleting a vehicle outside the scope, got %v", err)
	}
	// Không được tự gán xe sang trạm xăng khác phạm vi của mình
	if _, err := svc.CreateVehicle(onlyB, master.CreateVehicleRequest{
		Plate: fmt.Sprintf("99T-%d", suffix), FuelTypeID: fuelTypeID, BranchIDs: []uuid.UUID{a},
		CardNumber: fmt.Sprintf("%010d", 5000000000+suffix),
	}); !errors.Is(err, apperr.ErrForbidden) {
		t.Fatalf("expected ErrForbidden when assigning an out-of-scope store, got %v", err)
	}
}
