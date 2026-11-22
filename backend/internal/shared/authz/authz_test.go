package authz_test

import (
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"testing"

	"fuel-station-backend/internal/shared/authz"
)

func TestPrincipal_Can(t *testing.T) {
	p := authz.NewPrincipal(
		"user-1",
		"tenant-1",
		"MANAGER",
		[]authz.Permission{"master.vehicle:view", "master.vehicle:create"},
	)

	if !p.Can("master.vehicle:view") {
		t.Errorf("expected principal to have 'master.vehicle:view'")
	}
	if !p.Can("master.vehicle:create") {
		t.Errorf("expected principal to have 'master.vehicle:create'")
	}
	if p.Can("inventory.issue:approve") {
		t.Errorf("did not expect principal to have 'inventory.issue:approve'")
	}
}

func TestRequirePermission_Middleware(t *testing.T) {
	logger := slog.New(slog.NewTextHandler(io.Discard, nil))
	protectedHandler := authz.RequirePermission("master.vehicle:view", logger)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte("ok"))
	}))

	// Case 1: Unauthenticated -> 401
	req1 := httptest.NewRequest(http.MethodGet, "/test", nil)
	rr1 := httptest.NewRecorder()
	protectedHandler.ServeHTTP(rr1, req1)
	if rr1.Code != http.StatusUnauthorized {
		t.Errorf("expected 401 Unauthorized, got: %d", rr1.Code)
	}

	// Case 2: Authenticated but missing permission -> 403
	pWithoutPerm := authz.NewPrincipal("u1", "t1", "IT", []authz.Permission{"dashboard:view"})
	req2 := httptest.NewRequest(http.MethodGet, "/test", nil)
	req2 = req2.WithContext(authz.WithPrincipal(req2.Context(), pWithoutPerm))
	rr2 := httptest.NewRecorder()
	protectedHandler.ServeHTTP(rr2, req2)
	if rr2.Code != http.StatusForbidden {
		t.Errorf("expected 403 Forbidden, got: %d", rr2.Code)
	}

	// Case 3: Authenticated with permission -> 200
	pWithPerm := authz.NewPrincipal("u1", "t1", "MANAGER", []authz.Permission{"master.vehicle:view"})
	req3 := httptest.NewRequest(http.MethodGet, "/test", nil)
	req3 = req3.WithContext(authz.WithPrincipal(req3.Context(), pWithPerm))
	rr3 := httptest.NewRecorder()
	protectedHandler.ServeHTTP(rr3, req3)
	if rr3.Code != http.StatusOK {
		t.Errorf("expected 200 OK, got: %d", rr3.Code)
	}
}
