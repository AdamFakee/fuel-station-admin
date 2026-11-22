package audit_test

import (
	"context"
	"strings"
	"testing"

	"fuel-station-backend/internal/shared/audit"
	"fuel-station-backend/internal/shared/authz"
	"fuel-station-backend/internal/shared/middleware"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgconn"
)

type mockQueryer struct {
	lastSQL  string
	lastArgs []any
}

func (m *mockQueryer) Exec(ctx context.Context, sql string, arguments ...any) (pgconn.CommandTag, error) {
	m.lastSQL = sql
	m.lastArgs = arguments
	return pgconn.NewCommandTag("INSERT 0 1"), nil
}

func TestRecord_RequiresTenantID(t *testing.T) {
	ctx := context.Background()
	mockDB := &mockQueryer{}

	err := audit.Record(ctx, mockDB, audit.Entry{
		Action:     audit.ActionCreate,
		EntityType: "vehicle",
	})
	if err == nil || !strings.Contains(err.Error(), "missing tenant_id") {
		t.Fatalf("expected missing tenant_id error, got: %v", err)
	}
}

func TestRecord_InsertsAuditLog(t *testing.T) {
	tenantID := uuid.New()
	userID := uuid.New()
	entityID := uuid.New()

	ctx := context.Background()
	ctx = middleware.WithTenantID(ctx, tenantID.String())
	ctx = context.WithValue(ctx, middleware.RequestIDKey, "req-xyz-123")

	principal := authz.NewPrincipal(userID.String(), tenantID.String(), "MANAGER", nil)
	ctx = authz.WithPrincipal(ctx, principal)

	mockDB := &mockQueryer{}
	entry := audit.Entry{
		Action:     audit.ActionCreate,
		EntityType: "vehicle",
		EntityID:   &entityID,
		EntityCode: "51B-12345",
		ActorName:  "Nguyen Van A",
		IP:         "192.168.1.100",
		OldData:    nil,
		NewData:    map[string]any{"plate_number": "51B-12345"},
	}

	err := audit.Record(ctx, mockDB, entry)
	if err != nil {
		t.Fatalf("expected audit.Record to succeed, got: %v", err)
	}

	if !strings.Contains(mockDB.lastSQL, "INSERT INTO station.audit_log") {
		t.Errorf("expected SQL to insert into station.audit_log, got: %s", mockDB.lastSQL)
	}
	if len(mockDB.lastArgs) != 12 {
		t.Fatalf("expected 12 arguments in SQL, got %d", len(mockDB.lastArgs))
	}
	if mockDB.lastArgs[0] != tenantID {
		t.Errorf("expected tenant_id %v, got %v", tenantID, mockDB.lastArgs[0])
	}
	if mockDB.lastArgs[4] != audit.ActionCreate {
		t.Errorf("expected action 'create', got %v", mockDB.lastArgs[4])
	}
}
