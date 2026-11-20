package assets_test

import (
	"context"
	"fmt"
	"strings"
	"testing"
	"time"

	"fuel-station-backend/internal/modules/assets"
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

func setupTest(t *testing.T) (*assets.Service, *pgxpool.Pool, context.Context) {
	ctx := context.Background()
	pool, err := pgxpool.New(ctx, testDBURL)
	if err != nil {
		t.Skipf("skipping test: database not reachable: %v", err)
	}

	if err := pool.Ping(ctx); err != nil {
		pool.Close()
		t.Skipf("skipping test: database ping failed: %v", err)
	}

	ctx = middleware.WithTenantID(ctx, defaultTenantID)
	principal := authz.NewPrincipal(
		adminUserID,
		defaultTenantID,
		"MANAGER",
		[]string{branch1ID},
		[]authz.Permission{
			"org.branch:view", "org.branch:create", "org.branch:update", "org.branch:delete",
			"asset.tank:view", "asset.tank:create", "asset.tank:update", "asset.tank:delete",
			"asset.pump:view", "asset.pump:create", "asset.pump:update", "asset.pump:delete",
			"asset.device:view", "asset.device:update",
			"master.catalog:view", "master.catalog:create",
		},
	)
	ctx = authz.WithPrincipal(ctx, principal)

	svc := assets.NewService(pool)
	return svc, pool, ctx
}

func TestBranchLifecycle(t *testing.T) {
	svc, pool, ctx := setupTest(t)
	defer pool.Close()

	uniqueCode := fmt.Sprintf("BR-%d", time.Now().UnixNano()%100000)
	addr := "123 Đường Test"
	mgr := "Quản lý Test"
	phone := "0912345678"

	// 1. Create Branch
	created, err := svc.CreateBranch(ctx, assets.CreateBranchRequest{
		Code:        uniqueCode,
		Name:        "Chi nhánh Test M4",
		Address:     &addr,
		ManagerName: &mgr,
		Phone:       &phone,
	})
	if err != nil {
		t.Fatalf("CreateBranch failed: %v", err)
	}
	if created.Code != uniqueCode {
		t.Fatalf("expected code %s, got %s", uniqueCode, created.Code)
	}

	// 2. Get Branch
	found, err := svc.GetBranch(ctx, created.ID)
	if err != nil {
		t.Fatalf("GetBranch failed: %v", err)
	}
	if found.Name != "Chi nhánh Test M4" {
		t.Fatalf("unexpected branch name: %s", found.Name)
	}

	// 3. Update Branch
	updatedName := "Chi nhánh Test M4 - Updated"
	updated, err := svc.UpdateBranch(ctx, created.ID, assets.UpdateBranchRequest{
		Name:        updatedName,
		Address:     &addr,
		ManagerName: &mgr,
		Phone:       &phone,
		Status:      "active",
	})
	if err != nil {
		t.Fatalf("UpdateBranch failed: %v", err)
	}
	if updated.Name != updatedName {
		t.Fatalf("expected updated name %s, got %s", updatedName, updated.Name)
	}

	// 4. Soft-delete / deactivate
	if err := svc.DeleteBranch(ctx, created.ID); err != nil {
		t.Fatalf("DeleteBranch failed: %v", err)
	}
}

func TestFuelTypeAndTankLifecycle(t *testing.T) {
	svc, pool, ctx := setupTest(t)
	defer pool.Close()

	// 1. Ensure Fuel Type exists
	fuelCode := fmt.Sprintf("DO-%d", time.Now().UnixNano()%100000000)
	ft, err := svc.CreateFuelType(ctx, assets.CreateFuelTypeRequest{
		Code: fuelCode,
		Name: "Dầu DO M4 Test",
	})
	if err != nil {
		t.Fatalf("CreateFuelType failed: %v", err)
	}

	// 2. Create Tank with opening stock
	tankCode := fmt.Sprintf("TK-%d", time.Now().UnixNano()%100000000)
	tank, err := svc.CreateTank(ctx, assets.CreateTankRequest{
		BranchID:            branch1ID,
		Code:                tankCode,
		Name:                "Bể dầu DO 01",
		FuelTypeID:          ft.ID,
		DesignCapacityML:    25000000, // 25,000 L
		MaxUsableCapacityML: 24000000, // 24,000 L
		LowStockThresholdML: 3000000,  // 3,000 L
		LossTolerancePct:    0.5,
		OpeningStockML:      15000000, // 15,000 L
	})
	if err != nil {
		t.Fatalf("CreateTank failed: %v", err)
	}
	if tank.Code != tankCode {
		t.Fatalf("expected tank code %s, got %s", tankCode, tank.Code)
	}
	if tank.CurrentStockML != 15000000 {
		t.Fatalf("expected opening stock 15000000 ml, got %d", tank.CurrentStockML)
	}

	// 3. List tanks and verify current_stock_ml
	tanks, total, err := svc.ListTanks(ctx, assets.TankListQuery{
		Search: tankCode,
	})
	if err != nil {
		t.Fatalf("ListTanks failed: %v", err)
	}
	if total == 0 || len(tanks) == 0 {
		t.Fatalf("expected at least 1 tank in list")
	}
	if tanks[0].CurrentStockML != 15000000 {
		t.Fatalf("expected list tank to have 15000000 ml, got %d", tanks[0].CurrentStockML)
	}

	// 4. Update and Deactivate Tank
	_, err = svc.UpdateTank(ctx, tank.ID, assets.UpdateTankRequest{
		Name:                "Bể dầu DO 01 (Đã đổi tên)",
		FuelTypeID:          ft.ID,
		DesignCapacityML:    25000000,
		MaxUsableCapacityML: 24000000,
		LowStockThresholdML: 3000000,
		LossTolerancePct:    0.4,
		Status:              "active",
	})
	if err != nil {
		t.Fatalf("UpdateTank failed: %v", err)
	}

	if err := svc.DeleteTank(ctx, tank.ID); err != nil {
		t.Fatalf("DeleteTank failed: %v", err)
	}
}

func TestPumpAndDeviceLifecycle(t *testing.T) {
	svc, pool, ctx := setupTest(t)
	defer pool.Close()

	// 1. Get a tank for nozzle attachment
	tanks, _, err := svc.ListTanks(ctx, assets.TankListQuery{Page: 1, PageSize: 1})
	if err != nil || len(tanks) == 0 {
		t.Skipf("skipping pump test: no tanks available")
	}
	tankID := tanks[0].ID

	// 2. Create Pump
	pumpCode := fmt.Sprintf("P-%d", time.Now().UnixNano()%100000)
	// Cổng COM phải duy nhất trong cửa hàng: dùng số ngẫu nhiên theo từng lần chạy, kẻo đụng dữ liệu thật trong DB dùng chung.
	comSuffix := time.Now().UnixNano() % 800000
	comPort := fmt.Sprintf("COM%d", 100+comSuffix)
	var serial uint32 = 4567
	termHost := "192.168.1.150"
	termPass := "HikSecure@999"

	pump, err := svc.CreatePump(ctx, assets.CreatePumpRequest{
		BranchID:         branch1ID,
		Code:             pumpCode,
		Name:             "Trụ bơm số 1 - M4 Test",
		TankID:           tankID,
		SensorComPort:    &comPort,
		SensorSerial:     &serial,
		TerminalHost:     &termHost,
		TerminalPassword: &termPass,
	})
	if err != nil {
		t.Fatalf("CreatePump failed: %v", err)
	}
	// Mã trụ do hệ thống sinh (TR-năm-số thứ tự), không lấy từ client.
	if !strings.HasPrefix(pump.Code, "TR-") || pump.Code == pumpCode {
		t.Fatalf("expected a generated pump code TR-..., got %s", pump.Code)
	}
	if len(pump.Nozzles) == 0 {
		t.Fatalf("expected at least 1 nozzle attached to pump")
	}
	if pump.Sensor == nil || pump.Sensor.Serial != 4567 {
		t.Fatalf("sensor serial mismatch: %v", pump.Sensor)
	}
	if pump.Terminal == nil || pump.Terminal.Host != termHost {
		t.Fatalf("terminal host mismatch: %v", pump.Terminal)
	}

	// 3. Update Sensor and Terminal
	_, err = svc.UpdateSensor(ctx, pump.ID, assets.UpdateSensorRequest{
		Serial:  9999,
		ComPort: fmt.Sprintf("COM%d", 1000+comSuffix),
		Baud:    19200, // bị bỏ qua: baud luôn cố định 9600
	})
	if err != nil {
		t.Fatalf("UpdateSensor failed: %v", err)
	}

	newHost := "192.168.1.155"
	newPass := "NewPass@123"
	newTerminalCode := fmt.Sprintf("TN%d", time.Now().UnixNano()%100000)
	_, err = svc.UpdateTerminal(ctx, pump.ID, assets.UpdateTerminalRequest{
		TerminalCode: newTerminalCode,
		Host:         newHost,
		Port:         8000, // bị bỏ qua: cổng luôn cố định 80
		HTTPS:        false,
		Username:     "admin",
		Password:     &newPass,
	})
	if err != nil {
		t.Fatalf("UpdateTerminal failed: %v", err)
	}

	// 4. List Devices View
	devices, err := svc.ListDevices(ctx, branch1ID)
	if err != nil {
		t.Fatalf("ListDevices failed: %v", err)
	}
	if len(devices) == 0 {
		t.Fatalf("expected devices in list")
	}

	// 5. Delete pump
	if err := svc.DeletePump(ctx, pump.ID); err != nil {
		t.Fatalf("DeletePump failed: %v", err)
	}
}
