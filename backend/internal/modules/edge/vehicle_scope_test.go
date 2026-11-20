package edge_test

import (
	"context"
	"fmt"
	"testing"
	"time"

	"fuel-station-backend/internal/modules/edge"
	"github.com/jackc/pgx/v5/pgxpool"
)

// Test tích hợp dùng DB dev (bỏ qua nếu không nối được): danh mục xuống trạm gồm MỌI xe kèm cờ `allowed_here`
// theo cửa hàng của từng trạm.
func TestCatalogCarriesAllowedHereFlagPerStore(t *testing.T) {
	const (
		dbURL    = "postgres://postgres:postgres@localhost:5432/fuel_station_db?sslmode=disable"
		tenantID = "11111111-1111-1111-1111-111111111111"
		branchA  = "22222222-2222-2222-2222-222222222221"
		branchB  = "22222222-2222-2222-2222-222222222222"
	)
	ctx := context.Background()
	pool, err := pgxpool.New(ctx, dbURL)
	if err != nil {
		t.Skipf("skipping test: database not reachable: %v", err)
	}
	defer pool.Close()
	if err := pool.Ping(ctx); err != nil {
		t.Skipf("skipping test: database ping failed: %v", err)
	}

	var fuelTypeID string
	if err := pool.QueryRow(ctx, `SELECT id FROM station.fuel_type WHERE tenant_id = $1 ORDER BY created_at LIMIT 1`, tenantID).Scan(&fuelTypeID); err != nil {
		t.Skipf("skipping test: no fuel type: %v", err)
	}

	var cursor int64
	if err := pool.QueryRow(ctx, `SELECT COALESCE(MAX(seq), 0) FROM station.sync_change_log`).Scan(&cursor); err != nil {
		t.Fatalf("read cursor: %v", err)
	}

	// Xe chỉ được phép ở cửa hàng A
	suffix := time.Now().UnixNano() % 1000000
	var vehicleID string
	if err := pool.QueryRow(ctx, `
		INSERT INTO station.vehicle (tenant_id, code, plate, fuel_type_id) VALUES ($1, $2, $3, $4) RETURNING id
	`, tenantID, fmt.Sprintf("ES%d", suffix), fmt.Sprintf("88E-%06d", suffix), fuelTypeID).Scan(&vehicleID); err != nil {
		t.Fatalf("insert vehicle: %v", err)
	}
	defer func() { _, _ = pool.Exec(ctx, `DELETE FROM station.vehicle WHERE id = $1`, vehicleID) }()
	if _, err := pool.Exec(ctx, `INSERT INTO station.vehicle_branch (tenant_id, vehicle_id, branch_id) VALUES ($1, $2, $3)`, tenantID, vehicleID, branchA); err != nil {
		t.Fatalf("allow store A: %v", err)
	}

	repo := edge.NewRepository(pool)
	allowedAt := func(branchID string) (bool, bool) {
		changes, _, _, err := repo.GetCatalogChanges(ctx, tenantID, branchID, cursor, 500)
		if err != nil {
			t.Fatalf("GetCatalogChanges(%s): %v", branchID, err)
		}
		for i := len(changes) - 1; i >= 0; i-- { // bản mới nhất của xe
			c := changes[i]
			if c.EntityType == "vehicle" && c.EntityID == vehicleID && c.Data != nil {
				v, _ := c.Data["allowed_here"].(bool)
				return v, true
			}
		}
		return false, false
	}

	if allowed, found := allowedAt(branchA); !found || !allowed {
		t.Fatalf("store A must receive the vehicle with allowed_here=true (found=%v allowed=%v)", found, allowed)
	}
	// Cửa hàng B vẫn nhận xe (để ghi nhận lượt đổ nhầm) nhưng với cờ false.
	if allowed, found := allowedAt(branchB); !found || allowed {
		t.Fatalf("store B must receive the vehicle with allowed_here=false (found=%v allowed=%v)", found, allowed)
	}
}
