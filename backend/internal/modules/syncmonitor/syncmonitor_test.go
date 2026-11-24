package syncmonitor_test

import (
	"context"
	"errors"
	"io"
	"log/slog"
	"strings"
	"testing"
	"time"

	"fuel-station-backend/internal/modules/edge"
	"fuel-station-backend/internal/modules/syncmonitor"
	"fuel-station-backend/internal/shared/apperr"
	"fuel-station-backend/internal/shared/authz"
)

type mockRepo struct {
	getStationsStatusFunc func(ctx context.Context, tenantID string) ([]syncmonitor.EdgeStationStatus, error)
	issuedHash            string
	issuedHint            string
	issuedChange          syncmonitor.KeyChange
	hadKey                bool
	revokeErr             error
}

func (m *mockRepo) IssueAPIKey(ctx context.Context, p syncmonitor.KeyChange, keyHash, keyHint string) (string, bool, error) {
	m.issuedHash, m.issuedHint, m.issuedChange = keyHash, keyHint, p
	return "EDGE-CN-0001", m.hadKey, nil
}

func (m *mockRepo) RevokeAPIKey(ctx context.Context, p syncmonitor.KeyChange) error {
	m.issuedChange = p
	return m.revokeErr
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

func managerCtx() context.Context {
	principal := authz.NewPrincipal("u1", "t1", "ADMIN", []authz.Permission{"sync.monitor:update"})
	return authz.WithPrincipal(context.Background(), principal)
}

// Khóa trả về có tiền tố edge_, đủ dài, mỗi lần mỗi khác; chỉ bản băm SHA-256 của nó được đưa xuống kho dữ liệu.
func TestIssueAPIKey_ReturnsKeyOnceAndStoresOnlyItsHash(t *testing.T) {
	repo := &mockRepo{}
	svc := syncmonitor.NewService(repo, testLogger())

	first, err := svc.IssueAPIKey(managerCtx(), "branch-1", "10.0.0.1")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !strings.HasPrefix(first.APIKey, "edge_") || len(first.APIKey) != len("edge_")+48 {
		t.Fatalf("unexpected key shape: %q", first.APIKey)
	}
	if repo.issuedHash != edge.HashApiKey(first.APIKey) || repo.issuedHash == first.APIKey {
		t.Fatalf("repository must receive the hash of the key, got %q", repo.issuedHash)
	}
	if repo.issuedHint != first.APIKey[len(first.APIKey)-7:] || len(repo.issuedHint) != 7 {
		t.Fatalf("hint must be the last 7 characters of the key, got %q", repo.issuedHint)
	}
	if first.StationCode != "EDGE-CN-0001" || first.BranchID != "branch-1" {
		t.Fatalf("unexpected response: %+v", first)
	}
	if repo.issuedChange.TenantID != "t1" || repo.issuedChange.BranchID != "branch-1" || repo.issuedChange.IP != "10.0.0.1" {
		t.Fatalf("tenant must come from the principal, got %+v", repo.issuedChange)
	}

	second, _ := svc.IssueAPIKey(managerCtx(), "branch-1", "")
	if second.APIKey == first.APIKey {
		t.Fatal("each issue must produce a different key")
	}
}

// Cấp lại khi đã có khóa thì báo reissued để giao diện cảnh báo khóa cũ đã chết.
func TestIssueAPIKey_ReportsReissue(t *testing.T) {
	repo := &mockRepo{hadKey: true}
	svc := syncmonitor.NewService(repo, testLogger())
	resp, err := svc.IssueAPIKey(managerCtx(), "branch-1", "")
	if err != nil || !resp.Reissued {
		t.Fatalf("expected reissued=true, got %+v err=%v", resp, err)
	}
}

// Không có principal (chưa đăng nhập) thì từ chối, không chạm kho dữ liệu.
func TestKeyActions_RequireAPrincipal(t *testing.T) {
	repo := &mockRepo{}
	svc := syncmonitor.NewService(repo, testLogger())
	if _, err := svc.IssueAPIKey(context.Background(), "b", ""); !errors.Is(err, apperr.ErrUnauthorized) {
		t.Fatalf("expected unauthorized, got %v", err)
	}
	if err := svc.RevokeAPIKey(context.Background(), "b", ""); !errors.Is(err, apperr.ErrUnauthorized) {
		t.Fatalf("expected unauthorized, got %v", err)
	}
	if repo.issuedHash != "" {
		t.Fatal("repository must not be called without a principal")
	}
}

func TestRevokeAPIKey_PassesErrorsThrough(t *testing.T) {
	repo := &mockRepo{revokeErr: apperr.ErrNotFound}
	svc := syncmonitor.NewService(repo, testLogger())
	if err := svc.RevokeAPIKey(managerCtx(), "b", ""); !errors.Is(err, apperr.ErrNotFound) {
		t.Fatalf("expected not found, got %v", err)
	}
}

// Chi nhánh chưa có trạm Edge hiện trong danh sách nhưng không tính vào số liệu giám sát.
func TestGetStations_BranchWithoutStationIsNotCounted(t *testing.T) {
	repo := &mockRepo{getStationsStatusFunc: func(ctx context.Context, tenantID string) ([]syncmonitor.EdgeStationStatus, error) {
		return []syncmonitor.EdgeStationStatus{{ID: "", BranchID: "b1"}, {ID: "s1", HasStation: true, IsOnline: true}}, nil
	}}
	svc := syncmonitor.NewService(repo, testLogger())
	resp, err := svc.GetStations(managerCtx())
	if err != nil {
		t.Fatal(err)
	}
	if resp.Summary.TotalStations != 1 || resp.Summary.OnlineStations != 1 || len(resp.Stations) != 2 {
		t.Fatalf("unexpected summary: %+v (%d rows)", resp.Summary, len(resp.Stations))
	}
}
