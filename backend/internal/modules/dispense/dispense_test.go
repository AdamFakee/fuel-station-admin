package dispense_test

import (
	"context"
	"testing"
	"time"

	"fuel-station-backend/internal/modules/dispense"
	"fuel-station-backend/internal/shared/authz"
	"fuel-station-backend/internal/shared/middleware"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

const (
	testDBURL       = "postgres://postgres:postgres@localhost:5432/fuel_station_db?sslmode=disable"
	defaultTenantID = "11111111-1111-1111-1111-111111111111"
	adminUserID     = "33333333-3333-3333-3333-333333333331"
	branch1ID       = "22222222-2222-2222-2222-222222222221"
)

func setupTest(t *testing.T) (*dispense.Service, *pgxpool.Pool, context.Context) {
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
		[]authz.Permission{"dispense.session:view"},
	)
	ctx = authz.WithPrincipal(ctx, principal)

	svc := dispense.NewService(pool)
	return svc, pool, ctx
}

func seedTestData(t *testing.T, pool *pgxpool.Pool) (sessionID uuid.UUID, cleanup func()) {
	ctx := context.Background()
	tenantUUID := uuid.MustParse(defaultTenantID)
	branchUUID := uuid.MustParse(branch1ID)

	// 1. Ensure an edge_station exists
	var edgeStationID uuid.UUID
	err := pool.QueryRow(ctx, `
		INSERT INTO station.edge_station (tenant_id, branch_id, code, name, api_key_hash)
		VALUES ($1, $2, 'ES-TEST-01', 'Trạm Edge Test', 'hash_test_m9')
		ON CONFLICT (tenant_id, code) DO UPDATE SET name = EXCLUDED.name
		RETURNING id
	`, tenantUUID, branchUUID).Scan(&edgeStationID)
	if err != nil {
		t.Fatalf("seed edge_station: %v", err)
	}

	// 2. Ensure pump exists
	var pumpID uuid.UUID
	err = pool.QueryRow(ctx, `
		SELECT id FROM station.pump WHERE tenant_id = $1 AND branch_id = $2 LIMIT 1
	`, tenantUUID, branchUUID).Scan(&pumpID)
	if err != nil {
		err = pool.QueryRow(ctx, `
			INSERT INTO station.pump (tenant_id, branch_id, code, name)
			VALUES ($1, $2, 'PUMP-TEST', 'Trụ bơm thử nghiệm M9')
			RETURNING id
		`, tenantUUID, branchUUID).Scan(&pumpID)
		if err != nil {
			t.Fatalf("seed pump: %v", err)
		}
	}

	// 3. Seed Dispense Session
	sUUID := uuid.New()
	edgeRef := "ref-" + sUUID.String()[:8]
	code := "GD-TEST-0001"
	startedAt := time.Now().Add(-10 * time.Minute)
	finishedAt := time.Now().Add(-5 * time.Minute)

	_, err = pool.Exec(ctx, `
		INSERT INTO station.dispense_session (
			id, tenant_id, branch_id, edge_station_id, code, edge_ref,
			pump_id, pump_name, vehicle_plate, vehicle_code,
			driver_name, driver_code, limit_ml, dispensed_ml, pump_total_ml,
			status, edge_state, started_at, finished_at
		) VALUES (
			$1, $2, $3, $4, $5, $6,
			$7, 'Trụ 01', '29C-888.99', 'XE-01',
			'Bác Tài A', 'TX-01', 50000, 42500, 1500000,
			'completed', 'completed', $8, $9
		)
	`, sUUID, tenantUUID, branchUUID, edgeStationID, code, edgeRef, pumpID, startedAt, finishedAt)
	if err != nil {
		t.Fatalf("seed dispense_session: %v", err)
	}

	// 4. Seed Timeline Events
	_, err = pool.Exec(ctx, `
		INSERT INTO station.dispense_session_event (tenant_id, session_id, from_state, to_state, occurred_at)
		VALUES 
			($1, $2, 'idle', 'paired', $3),
			($1, $2, 'paired', 'unlocking', $4),
			($1, $2, 'unlocking', 'completed', $5)
	`, tenantUUID, sUUID, startedAt.Add(-2*time.Minute), startedAt.Add(-1*time.Minute), finishedAt)
	if err != nil {
		t.Fatalf("seed timeline events: %v", err)
	}

	// 5. Seed Access Events (1 accepted, 1 rejected)
	accRef1 := "acc-" + uuid.NewString()[:8]
	accRef2 := "acc-" + uuid.NewString()[:8]

	_, err = pool.Exec(ctx, `
		INSERT INTO station.access_event (
			tenant_id, branch_id, edge_station_id, edge_ref, occurred_at,
			kind, pump_id, method, external_id, party_name, decision, reason, session_id
		) VALUES 
			($1, $2, $3, $4, $5, 'pair_formed', $6, 'card', 'CARD-888', 'Bác Tài A', 'accept', NULL, $7),
			($1, $2, $3, $8, $9, 'credential', $6, 'card', 'CARD-999', 'Người lạ', 'reject', 'Blocked', NULL)
	`, tenantUUID, branchUUID, edgeStationID, accRef1, startedAt.Add(-3*time.Minute), pumpID, sUUID,
		accRef2, startedAt.Add(-1*time.Hour))
	if err != nil {
		t.Fatalf("seed access events: %v", err)
	}

	cleanup = func() {
		_, _ = pool.Exec(context.Background(), `DELETE FROM station.access_event WHERE edge_ref IN ($1, $2)`, accRef1, accRef2)
		_, _ = pool.Exec(context.Background(), `DELETE FROM station.dispense_session_event WHERE session_id = $1`, sUUID)
		_, _ = pool.Exec(context.Background(), `DELETE FROM station.dispense_session WHERE id = $1`, sUUID)
	}

	return sUUID, cleanup
}

func TestListSessions(t *testing.T) {
	svc, pool, ctx := setupTest(t)
	defer pool.Close()

	sessionID, cleanup := seedTestData(t, pool)
	defer cleanup()

	// List all sessions
	res, err := svc.ListSessions(ctx, dispense.SessionListQuery{Page: 1, PageSize: 10})
	if err != nil {
		t.Fatalf("ListSessions failed: %v", err)
	}
	if res.Total == 0 {
		t.Fatal("expected at least 1 session")
	}

	// Find the seeded session
	var found bool
	for _, s := range res.Items {
		if s.ID == sessionID.String() {
			found = true
			if s.VehiclePlate == nil || *s.VehiclePlate != "29C-888.99" {
				t.Errorf("expected vehicle plate 29C-888.99, got %v", s.VehiclePlate)
			}
			if s.DispensedLiters != 42.5 {
				t.Errorf("expected 42.5 liters, got %f", s.DispensedLiters)
			}
			break
		}
	}
	if !found {
		t.Errorf("seeded session %s not found in list", sessionID)
	}

	// Search filter
	searchRes, err := svc.ListSessions(ctx, dispense.SessionListQuery{Search: "29C-888.99"})
	if err != nil {
		t.Fatalf("ListSessions with search failed: %v", err)
	}
	if len(searchRes.Items) == 0 {
		t.Error("expected matching session for 29C-888.99")
	}
}

func TestGetSessionDetail(t *testing.T) {
	svc, pool, ctx := setupTest(t)
	defer pool.Close()

	sessionID, cleanup := seedTestData(t, pool)
	defer cleanup()

	detail, err := svc.GetSession(ctx, sessionID.String())
	if err != nil {
		t.Fatalf("GetSession failed: %v", err)
	}

	if detail.ID != sessionID.String() {
		t.Errorf("expected ID %s, got %s", sessionID, detail.ID)
	}
	if len(detail.Timeline) != 3 {
		t.Errorf("expected 3 timeline events, got %d", len(detail.Timeline))
	}
	if len(detail.AccessEvents) != 1 {
		t.Errorf("expected 1 session-linked access event, got %d", len(detail.AccessEvents))
	}
	if detail.DispensedLiters != 42.5 {
		t.Errorf("expected 42.5 liters, got %f", detail.DispensedLiters)
	}
}

func TestListAccessEventsAndSummary(t *testing.T) {
	svc, pool, ctx := setupTest(t)
	defer pool.Close()

	_, cleanup := seedTestData(t, pool)
	defer cleanup()

	// List reject access events
	res, err := svc.ListAccessEvents(ctx, dispense.AccessEventListQuery{Decision: "reject"})
	if err != nil {
		t.Fatalf("ListAccessEvents reject failed: %v", err)
	}
	if res.Total == 0 {
		t.Fatal("expected at least 1 rejected access event")
	}

	// Check summary
	summary, err := svc.GetSummary(ctx, branch1ID)
	if err != nil {
		t.Fatalf("GetSummary failed: %v", err)
	}
	if summary.TotalSessions == 0 {
		t.Errorf("expected total sessions > 0")
	}
	if summary.RejectedAuthCount == 0 {
		t.Errorf("expected rejected auth count > 0")
	}
}
