package syncmonitor_test

import (
	"context"
	"io"
	"log/slog"
	"testing"
	"time"

	"fuel-station-backend/internal/modules/syncmonitor"
	"fuel-station-backend/internal/shared/authz"
)

type mockRepo struct {
	getStationsStatusFunc func(ctx context.Context, tenantID string) ([]syncmonitor.EdgeStationStatus, error)
}

func (m *mockRepo) GetStationsStatus(ctx context.Context, tenantID string) ([]syncmonitor.EdgeStationStatus, error) {
	if m.getStationsStatusFunc != nil {
		return m.getStationsStatusFunc(ctx, tenantID)
	}
	return nil, nil
}

func testLogger() *slog.Logger {
	return slog.New(slog.NewTextHandler(io.Discard, nil))
}

func TestSyncMonitor_GetStationsSummary(t *testing.T) {
	now := time.Now().UTC()
	lastSeenRecent := now.Add(-2 * time.Minute)
	lastSeenOld := now.Add(-10 * time.Minute)
	errText := "timeout connecting sensor COM7"

	repo := &mockRepo{
		getStationsStatusFunc: func(ctx context.Context, tenantID string) ([]syncmonitor.EdgeStationStatus, error) {
			return []syncmonitor.EdgeStationStatus{
				{
					ID:           "st-1",
					Code:         "EDGE-01",
					Name:         "Trạm 1",
					IsOnline:     true,
					LastSeenAt:   &lastSeenRecent,
					PendingQueue: 3,
				},
				{
					ID:           "st-2",
					Code:         "EDGE-02",
					Name:         "Trạm 2",
					IsOnline:     false,
					LastSeenAt:   &lastSeenOld,
					PendingQueue: 12,
					LastError:    &errText,
				},
			}, nil
		},
	}

	svc := syncmonitor.NewService(repo, testLogger())
	principal := authz.NewPrincipal("u1", "t1", "MANAGER", []authz.Permission{"sync.monitor:view"})
	ctx := authz.WithPrincipal(context.Background(), principal)

	resp, err := svc.GetStations(ctx)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if resp.Summary.TotalStations != 2 {
		t.Fatalf("expected 2 total stations, got %d", resp.Summary.TotalStations)
	}
	if resp.Summary.OnlineStations != 1 {
		t.Fatalf("expected 1 online station, got %d", resp.Summary.OnlineStations)
	}
	if resp.Summary.OfflineStations != 1 {
		t.Fatalf("expected 1 offline station, got %d", resp.Summary.OfflineStations)
	}
	if resp.Summary.TotalPendingQueue != 15 {
		t.Fatalf("expected 15 total pending queue, got %d", resp.Summary.TotalPendingQueue)
	}
	if resp.Summary.ErrorStations != 1 {
		t.Fatalf("expected 1 error station, got %d", resp.Summary.ErrorStations)
	}
}
