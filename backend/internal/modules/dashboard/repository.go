package dashboard

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

type Repository interface {
	GetDashboardData(ctx context.Context, tenantID string) (*DashboardResponse, error)
}

type postgresRepository struct {
	pool *pgxpool.Pool
}

func NewRepository(pool *pgxpool.Pool) Repository {
	return &postgresRepository{pool: pool}
}

func (r *postgresRepository) GetDashboardData(ctx context.Context, tenantID string) (*DashboardResponse, error) {
	if r.pool == nil {
		return nil, errors.New("db pool not initialized")
	}

	// 1. Fetch tank stocks from station.tank_stock view
	tankSQL := `
		SELECT ts.tank_id, ts.code, ts.name, ts.branch_id, b.name AS branch_name,
		       COALESCE(ft.code, '') AS fuel_type_code, COALESCE(ft.name, '') AS fuel_type_name,
		       ts.stock_ml, ts.max_usable_capacity_ml, ts.stock_pct, ts.is_low, ts.has_opening
		FROM station.tank_stock ts
		JOIN station.branch b ON b.id = ts.branch_id AND b.tenant_id = ts.tenant_id
		LEFT JOIN station.fuel_type ft ON ft.id = ts.fuel_type_id
		WHERE ts.tenant_id = $1
		ORDER BY b.name, ts.code
	`
	tRows, err := r.pool.Query(ctx, tankSQL, tenantID)
	if err != nil {
		return nil, fmt.Errorf("query tank stock: %w", err)
	}
	defer tRows.Close()

	var tanks []TankStockItem
	lowStockCount := 0
	for tRows.Next() {
		var item TankStockItem
		var stockML, maxCapML int64
		if err := tRows.Scan(
			&item.TankID, &item.TankCode, &item.TankName, &item.BranchID, &item.BranchName,
			&item.FuelTypeCode, &item.FuelTypeName,
			&stockML, &maxCapML, &item.StockPct, &item.IsLow, &item.HasOpening,
		); err != nil {
			return nil, fmt.Errorf("scan tank stock: %w", err)
		}
		item.StockLiters = float64(stockML) / 1000.0
		item.MaxCapacityLiters = float64(maxCapML) / 1000.0
		if item.IsLow {
			lowStockCount++
		}
		tanks = append(tanks, item)
	}
	if tanks == nil {
		tanks = []TankStockItem{}
	}

	// 2. Fetch pump statuses
	pumpSQL := `
		SELECT p.id, p.code, p.name, p.edge_pump_id, b.name AS branch_name,
		       COALESCE(es.last_seen_at IS NOT NULL AND es.last_seen_at >= now() - interval '5 minutes', false) AS is_online,
		       COALESCE(SUM(ds.dispensed_ml) FILTER (WHERE ds.status = 'completed' AND ds.finished_at >= (now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date), 0) AS today_dispensed_ml,
		       COUNT(ds.id) FILTER (WHERE ds.status = 'completed' AND ds.finished_at >= (now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date) AS today_dispense_count
		FROM station.pump p
		JOIN station.branch b ON b.id = p.branch_id AND b.tenant_id = p.tenant_id
		LEFT JOIN station.edge_station es ON es.branch_id = p.branch_id AND es.tenant_id = p.tenant_id
		LEFT JOIN station.dispense_session ds ON ds.pump_id = p.id AND ds.tenant_id = p.tenant_id
		WHERE p.tenant_id = $1
		GROUP BY p.id, p.code, p.name, p.edge_pump_id, b.name, es.last_seen_at
		ORDER BY p.code
	`
	pRows, err := r.pool.Query(ctx, pumpSQL, tenantID)
	if err != nil {
		return nil, fmt.Errorf("query pump statuses: %w", err)
	}
	defer pRows.Close()

	var pumps []PumpStatusItem
	for pRows.Next() {
		var item PumpStatusItem
		var dispML int64
		if err := pRows.Scan(
			&item.PumpID, &item.PumpCode, &item.PumpName, &item.EdgePumpID, &item.BranchName,
			&item.IsStationOnline, &dispML, &item.TodayDispenseCount,
		); err != nil {
			return nil, fmt.Errorf("scan pump status: %w", err)
		}
		item.TodayDispensedLiters = float64(dispML) / 1000.0
		pumps = append(pumps, item)
	}
	if pumps == nil {
		pumps = []PumpStatusItem{}
	}

	// 3. Fetch recent dispense sessions (top 10)
	sessionSQL := `
		SELECT id, code, pump_name, COALESCE(vehicle_plate, '—'), COALESCE(driver_name, '—'),
		       dispensed_ml, status, finished_at, received_at
		FROM station.dispense_session
		WHERE tenant_id = $1
		ORDER BY COALESCE(finished_at, received_at) DESC
		LIMIT 10
	`
	sRows, err := r.pool.Query(ctx, sessionSQL, tenantID)
	if err != nil {
		return nil, fmt.Errorf("query recent sessions: %w", err)
	}
	defer sRows.Close()

	var sessions []RecentSessionItem
	for sRows.Next() {
		var item RecentSessionItem
		var ml int64
		if err := sRows.Scan(
			&item.ID, &item.Code, &item.PumpName, &item.VehiclePlate, &item.DriverName,
			&ml, &item.Status, &item.FinishedAt, &item.ReceivedAt,
		); err != nil {
			return nil, fmt.Errorf("scan recent session: %w", err)
		}
		item.DispensedLiters = float64(ml) / 1000.0
		sessions = append(sessions, item)
	}
	if sessions == nil {
		sessions = []RecentSessionItem{}
	}

	// 4. Compute Today KPI metrics
	kpiSQL := `
		SELECT
			COALESCE(SUM(dispensed_ml) FILTER (WHERE status = 'completed'), 0) AS today_liters,
			COUNT(id) AS today_total,
			COUNT(id) FILTER (WHERE status = 'completed') AS today_completed,
			COUNT(id) FILTER (WHERE status IN ('failed', 'cancelled')) AS today_failed
		FROM station.dispense_session
		WHERE tenant_id = $1
		  AND (finished_at >= (now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date OR (finished_at IS NULL AND received_at >= (now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date))
	`
	var todayLitersML int64
	var kpi DashboardKpi
	_ = r.pool.QueryRow(ctx, kpiSQL, tenantID).Scan(
		&todayLitersML, &kpi.TodayTotalSessions, &kpi.TodayCompletedSessions, &kpi.TodayFailedSessions,
	)
	kpi.TodayTotalLiters = float64(todayLitersML) / 1000.0
	kpi.LowStockTanks = lowStockCount
	kpi.ActivePumps = len(pumps)

	// Count online stations
	onlineStationSQL := `
		SELECT COUNT(id)
		FROM station.edge_station
		WHERE tenant_id = $1
		  AND last_seen_at IS NOT NULL AND last_seen_at >= now() - interval '5 minutes'
	`
	_ = r.pool.QueryRow(ctx, onlineStationSQL, tenantID).Scan(&kpi.OnlineStations)

	// Lượng cấp phát 7 ngày gần nhất (kể cả hôm nay); ngày không có phiên vẫn có dòng với số 0.
	dailySQL := `
		SELECT to_char(d.day, 'YYYY-MM-DD'),
		       COALESCE(SUM(ds.dispensed_ml) FILTER (WHERE ds.status = 'completed'), 0),
		       COUNT(ds.id) FILTER (WHERE ds.status = 'completed')
		FROM generate_series(
		       (now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date - 6,
		       (now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date,
		       interval '1 day') AS d(day)
		LEFT JOIN station.dispense_session ds
		       ON ds.tenant_id = $1
		      AND (COALESCE(ds.finished_at, ds.received_at) AT TIME ZONE 'Asia/Ho_Chi_Minh')::date = d.day::date
		GROUP BY d.day
		ORDER BY d.day
	`
	daily := make([]DailyDispenseItem, 0, 7)
	if dRows, dErr := r.pool.Query(ctx, dailySQL, tenantID); dErr == nil {
		defer dRows.Close()
		for dRows.Next() {
			var item DailyDispenseItem
			var ml int64
			if err := dRows.Scan(&item.Date, &ml, &item.Sessions); err != nil {
				return nil, fmt.Errorf("scan daily dispense: %w", err)
			}
			item.Liters = float64(ml) / 1000.0
			daily = append(daily, item)
		}
	}

	return &DashboardResponse{
		Kpi:            kpi,
		Tanks:          tanks,
		Pumps:          pumps,
		RecentSessions: sessions,
		DailyDispense:  daily,
		GeneratedAt:    time.Now().UTC(),
	}, nil
}
