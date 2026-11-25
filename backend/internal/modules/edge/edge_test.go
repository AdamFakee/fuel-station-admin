package edge_test

import (
	"context"
	"errors"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"fuel-station-backend/internal/modules/edge"
	"fuel-station-backend/internal/shared/apperr"
)

type mockRepo struct {
	findStationByApiKeyHashFunc func(ctx context.Context, keyHash string) (*edge.StationContext, error)
	getCatalogChangesFunc       func(ctx context.Context, tenantID, branchID string, cursor int64, limit int) ([]edge.CatalogChangeItem, int64, bool, error)
	updateLastSyncAtFunc        func(ctx context.Context, stationID string) error
	findDispenseSessionByRefFunc func(ctx context.Context, stationID, edgeRef string) (*edge.DispenseSessionResponse, error)
	createDispenseSessionFunc   func(ctx context.Context, station *edge.StationContext, req edge.CreateDispenseSessionRequest) (*edge.DispenseSessionResponse, error)
	batchInsertAccessEventsFunc func(ctx context.Context, station *edge.StationContext, events []edge.AccessEventInput) (int, error)
	updateHeartbeatFunc         func(ctx context.Context, stationID string, pendingQueue int, agentVersion string, lastError *string) error
	catalogStatsFunc            func(ctx context.Context, tenantID string, cursor int64, limit int) (int64, int64, error)
}

func (m *mockRepo) CatalogStats(ctx context.Context, tenantID string, cursor int64, limit int) (int64, int64, error) {
	if m.catalogStatsFunc != nil {
		return m.catalogStatsFunc(ctx, tenantID, cursor, limit)
	}
	return 0, 0, nil
}

func (m *mockRepo) FindStationByApiKeyHash(ctx context.Context, keyHash string) (*edge.StationContext, error) {
	if m.findStationByApiKeyHashFunc != nil {
		return m.findStationByApiKeyHashFunc(ctx, keyHash)
	}
	return nil, apperr.ErrUnauthorized
}

func (m *mockRepo) GetCatalogChanges(ctx context.Context, tenantID, branchID string, cursor int64, limit int) ([]edge.CatalogChangeItem, int64, bool, error) {
	if m.getCatalogChangesFunc != nil {
		return m.getCatalogChangesFunc(ctx, tenantID, branchID, cursor, limit)
	}
	return nil, cursor, false, nil
}

func (m *mockRepo) UpdateLastSyncAt(ctx context.Context, stationID string) error {
	if m.updateLastSyncAtFunc != nil {
		return m.updateLastSyncAtFunc(ctx, stationID)
	}
	return nil
}

func (m *mockRepo) FindDispenseSessionByRef(ctx context.Context, stationID, edgeRef string) (*edge.DispenseSessionResponse, error) {
	if m.findDispenseSessionByRefFunc != nil {
		return m.findDispenseSessionByRefFunc(ctx, stationID, edgeRef)
	}
	return nil, nil
}

func (m *mockRepo) CreateDispenseSession(ctx context.Context, station *edge.StationContext, req edge.CreateDispenseSessionRequest) (*edge.DispenseSessionResponse, error) {
	if m.createDispenseSessionFunc != nil {
		return m.createDispenseSessionFunc(ctx, station, req)
	}
	return &edge.DispenseSessionResponse{
		ID:          "sess-1",
		Code:        "GD-2026-0001",
		EdgeRef:     req.EdgeRef,
		Status:      req.Status,
		DispensedML: req.DispensedML,
		ReceivedAt:  time.Now().UTC(),
	}, nil
}

func (m *mockRepo) BatchInsertAccessEvents(ctx context.Context, station *edge.StationContext, events []edge.AccessEventInput) (int, error) {
	if m.batchInsertAccessEventsFunc != nil {
		return m.batchInsertAccessEventsFunc(ctx, station, events)
	}
	return len(events), nil
}

func (m *mockRepo) UpdateHeartbeat(ctx context.Context, stationID string, pendingQueue int, agentVersion string, lastError *string) error {
	if m.updateHeartbeatFunc != nil {
		return m.updateHeartbeatFunc(ctx, stationID, pendingQueue, agentVersion, lastError)
	}
	return nil
}

func testLogger() *slog.Logger {
	return slog.New(slog.NewTextHandler(io.Discard, nil))
}

func sampleStation() *edge.StationContext {
	return &edge.StationContext{
		StationID:   "st-1",
		TenantID:    "t-1",
		BranchID:    "b-1",
		StationCode: "EDGE-01",
		StationName: "Trạm 1",
	}
}

func TestEdgeAuthMiddleware(t *testing.T) {
	repo := &mockRepo{
		findStationByApiKeyHashFunc: func(ctx context.Context, keyHash string) (*edge.StationContext, error) {
			expectedHash := edge.HashApiKey("valid_key")
			if keyHash == expectedHash {
				return sampleStation(), nil
			}
			return nil, apperr.ErrUnauthorized
		},
	}

	mw := edge.RequireEdgeApiKey(repo, testLogger())
	handler := mw(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		st, ok := edge.StationFromContext(r.Context())
		if !ok || st.StationCode != "EDGE-01" {
			t.Errorf("expected station in context")
		}
		w.WriteHeader(http.StatusOK)
	}))

	// 1. Missing header
	req := httptest.NewRequest(http.MethodGet, "/edge/v1/heartbeat", nil)
	rr := httptest.NewRecorder()
	handler.ServeHTTP(rr, req)
	if rr.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401 for missing key, got %d", rr.Code)
	}

	// 2. Invalid key
	req = httptest.NewRequest(http.MethodGet, "/edge/v1/heartbeat", nil)
	req.Header.Set("X-Api-Key", "wrong_key")
	rr = httptest.NewRecorder()
	handler.ServeHTTP(rr, req)
	if rr.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401 for wrong key, got %d", rr.Code)
	}

	// 3. Valid key
	req = httptest.NewRequest(http.MethodGet, "/edge/v1/heartbeat", nil)
	req.Header.Set("X-Api-Key", "valid_key")
	rr = httptest.NewRecorder()
	handler.ServeHTTP(rr, req)
	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200 for valid key, got %d", rr.Code)
	}
}

func TestEdgeService_ReceiveDispenseSessionValidation(t *testing.T) {
	repo := &mockRepo{}
	svc := edge.NewService(repo, testLogger())
	ctx := edge.WithStationContext(context.Background(), sampleStation())

	// Missing edge_ref
	_, err := svc.ReceiveDispenseSession(ctx, edge.CreateDispenseSessionRequest{
		EdgeRef:     "",
		Status:      "completed",
		DispensedML: 1000,
	})
	if !errors.Is(err, apperr.ErrInvalidInput) {
		t.Fatalf("expected ErrInvalidInput for missing edge_ref, got %v", err)
	}

	// Negative dispensed_ml
	_, err = svc.ReceiveDispenseSession(ctx, edge.CreateDispenseSessionRequest{
		EdgeRef:     "ref-1",
		Status:      "completed",
		DispensedML: -50,
	})
	if !errors.Is(err, apperr.ErrInvalidInput) {
		t.Fatalf("expected ErrInvalidInput for negative dispensed_ml, got %v", err)
	}

	// Cancelled with dispensed_ml > 0
	_, err = svc.ReceiveDispenseSession(ctx, edge.CreateDispenseSessionRequest{
		EdgeRef:     "ref-2",
		Status:      "cancelled",
		DispensedML: 500,
	})
	if !errors.Is(err, apperr.ErrInvalidInput) {
		t.Fatalf("expected ErrInvalidInput for cancelled session with dispensed_ml > 0, got %v", err)
	}

	// Idempotency return
	repo.findDispenseSessionByRefFunc = func(ctx context.Context, stationID, edgeRef string) (*edge.DispenseSessionResponse, error) {
		if edgeRef == "ref-existing" {
			return &edge.DispenseSessionResponse{
				ID:          "existing-id",
				Code:        "GD-2026-0001",
				EdgeRef:     "ref-existing",
				Status:      "completed",
				DispensedML: 25000,
			}, nil
		}
		return nil, nil
	}

	resp, err := svc.ReceiveDispenseSession(ctx, edge.CreateDispenseSessionRequest{
		EdgeRef:     "ref-existing",
		Status:      "completed",
		DispensedML: 25000,
	})
	if err != nil {
		t.Fatalf("unexpected error on idempotent session: %v", err)
	}
	if resp.ID != "existing-id" {
		t.Fatalf("expected existing-id, got %s", resp.ID)
	}
}

func TestEdgeService_Heartbeat(t *testing.T) {
	updated := false
	repo := &mockRepo{
		updateHeartbeatFunc: func(ctx context.Context, stationID string, pendingQueue int, agentVersion string, lastError *string) error {
			if stationID == "st-1" && pendingQueue == 5 && agentVersion == "1.0.4" {
				updated = true
			}
			return nil
		},
	}
	svc := edge.NewService(repo, testLogger())
	ctx := edge.WithStationContext(context.Background(), sampleStation())

	resp, err := svc.Heartbeat(ctx, edge.HeartbeatRequest{
		PendingQueue: 5,
		AgentVersion: "1.0.4",
	})
	if err != nil {
		t.Fatalf("heartbeat error: %v", err)
	}
	if resp.Status != "online" {
		t.Fatalf("expected status online, got %s", resp.Status)
	}
	if !updated {
		t.Fatal("expected updateHeartbeat to be called with correct params")
	}
}

func TestEdgeService_GetCatalogChanges(t *testing.T) {
	repo := &mockRepo{
		getCatalogChangesFunc: func(ctx context.Context, tenantID, branchID string, cursor int64, limit int) ([]edge.CatalogChangeItem, int64, bool, error) {
			return []edge.CatalogChangeItem{
				{Seq: 1, EntityType: "pump", EntityID: "p1", Version: 1},
				{Seq: 2, EntityType: "vehicle", EntityID: "v1", Version: 1},
			}, 2, false, nil
		},
	}
	svc := edge.NewService(repo, testLogger())
	ctx := edge.WithStationContext(context.Background(), sampleStation())

	resp, err := svc.GetCatalogChanges(ctx, 0, 100)
	if err != nil {
		t.Fatalf("get catalog changes error: %v", err)
	}
	if len(resp.Changes) != 2 {
		t.Fatalf("expected 2 changes, got %d", len(resp.Changes))
	}
	if resp.NextCursor != 2 {
		t.Fatalf("expected next cursor 2, got %d", resp.NextCursor)
	}
}
