package dashboard_test

import (
	"context"
	"io"
	"log/slog"
	"testing"
	"time"

	"fuel-station-backend/internal/modules/dashboard"
	"fuel-station-backend/internal/shared/authz"
)

type mockRepo struct {
	getDashboardDataFunc func(ctx context.Context, tenantID string, branchIDs []string) (*dashboard.DashboardResponse, error)
}

func (m *mockRepo) GetDashboardData(ctx context.Context, tenantID string, branchIDs []string) (*dashboard.DashboardResponse, error) {
	if m.getDashboardDataFunc != nil {
		return m.getDashboardDataFunc(ctx, tenantID, branchIDs)
	}
	return nil, nil
}

func testLogger() *slog.Logger {
	return slog.New(slog.NewTextHandler(io.Discard, nil))
}

func TestDashboard_GetDashboardData(t *testing.T) {
	repo := &mockRepo{
		getDashboardDataFunc: func(ctx context.Context, tenantID string, branchIDs []string) (*dashboard.DashboardResponse, error) {
			return &dashboard.DashboardResponse{
				Kpi: dashboard.DashboardKpi{
					TodayTotalLiters:       1500.5,
					TodayTotalSessions:     25,
					TodayCompletedSessions: 24,
					TodayFailedSessions:    1,
					ActivePumps:            2,
					OnlineStations:         1,
					LowStockTanks:          0,
				},
				Tanks: []dashboard.TankStockItem{
					{
						TankID:            "tk-1",
						TankCode:          "BE-01",
						TankName:          "Bể Dầu DO 01",
						FuelTypeCode:      "DO",
						StockLiters:       18000,
						MaxCapacityLiters: 20000,
						StockPct:          90.0,
						IsLow:             false,
					},
				},
				Pumps: []dashboard.PumpStatusItem{
					{
						PumpID:               "p-1",
						PumpCode:             "PUMP-01",
						PumpName:             "Trụ Bơm Số 1",
						IsStationOnline:      true,
						TodayDispensedLiters: 1500.5,
						TodayDispenseCount:   24,
					},
				},
				RecentSessions: []dashboard.RecentSessionItem{
					{
						ID:              "sess-1",
						Code:            "GD-2026-0001",
						PumpName:        "Trụ Bơm Số 1",
						VehiclePlate:    "29C-123.45",
						DriverName:      "Nguyễn Văn Tài",
						DispensedLiters: 45.0,
						Status:          "completed",
						ReceivedAt:      time.Now().UTC(),
					},
				},
				GeneratedAt: time.Now().UTC(),
			}, nil
		},
	}

	svc := dashboard.NewService(repo, testLogger())
	principal := authz.NewPrincipal("u1", "t1", "MANAGER", []string{"b1"}, []authz.Permission{"dashboard:view"})
	ctx := authz.WithPrincipal(context.Background(), principal)

	resp, err := svc.GetDashboard(ctx)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if resp.Kpi.TodayTotalLiters != 1500.5 {
		t.Fatalf("expected 1500.5 today liters, got %f", resp.Kpi.TodayTotalLiters)
	}
	if len(resp.Tanks) != 1 {
		t.Fatalf("expected 1 tank, got %d", len(resp.Tanks))
	}
	if len(resp.Pumps) != 1 {
		t.Fatalf("expected 1 pump, got %d", len(resp.Pumps))
	}
	if len(resp.RecentSessions) != 1 {
		t.Fatalf("expected 1 recent session, got %d", len(resp.RecentSessions))
	}
}
