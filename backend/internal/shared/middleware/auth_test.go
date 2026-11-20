package middleware_test

import (
	"context"
	"errors"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"testing"

	"fuel-station-backend/internal/shared/authz"
	"fuel-station-backend/internal/shared/middleware"
)

type mockSessionValidator struct {
	validTokenHash string
	userData       *middleware.SessionUserData
}

func (m *mockSessionValidator) ValidateToken(ctx context.Context, tokenHash string) (*middleware.SessionUserData, error) {
	if tokenHash == m.validTokenHash {
		return m.userData, nil
	}
	return nil, errors.New("invalid or expired session")
}

func TestAuth_Middleware(t *testing.T) {
	logger := slog.New(slog.NewTextHandler(io.Discard, nil))
	plainToken := "secret-token-xyz"
	expectedHash := middleware.HashToken(plainToken)

	validator := &mockSessionValidator{
		validTokenHash: expectedHash,
		userData: &middleware.SessionUserData{
			UserID:      "usr-001",
			TenantID:    "tnt-001",
			RoleCode:    "MANAGER",
			BranchIDs:   []string{"br-1"},
			Permissions: []string{"master.vehicle:view"},
		},
	}

	handler := middleware.RequireAuth(validator, logger)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		p, ok := authz.FromContext(r.Context())
		if !ok {
			t.Errorf("expected principal in context")
		}
		if p.TenantID != "tnt-001" {
			t.Errorf("expected tenant tnt-001, got %s", p.TenantID)
		}
		tenantID, ok := middleware.TenantIDFromContext(r.Context())
		if !ok || tenantID != "tnt-001" {
			t.Errorf("expected tenant_id in context, got %s", tenantID)
		}
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte("authenticated"))
	}))

	// Case 1: No token -> 401
	req1 := httptest.NewRequest(http.MethodGet, "/v1/auth/me", nil)
	rr1 := httptest.NewRecorder()
	handler.ServeHTTP(rr1, req1)
	if rr1.Code != http.StatusUnauthorized {
		t.Errorf("expected 401 Unauthorized, got: %d", rr1.Code)
	}

	// Case 2: Invalid Bearer token -> 401
	req2 := httptest.NewRequest(http.MethodGet, "/v1/auth/me", nil)
	req2.Header.Set("Authorization", "Bearer invalid-token")
	rr2 := httptest.NewRecorder()
	handler.ServeHTTP(rr2, req2)
	if rr2.Code != http.StatusUnauthorized {
		t.Errorf("expected 401 Unauthorized for invalid token, got: %d", rr2.Code)
	}

	// Case 3: Valid Bearer token -> 200
	req3 := httptest.NewRequest(http.MethodGet, "/v1/auth/me", nil)
	req3.Header.Set("Authorization", "Bearer "+plainToken)
	rr3 := httptest.NewRecorder()
	handler.ServeHTTP(rr3, req3)
	if rr3.Code != http.StatusOK {
		t.Errorf("expected 200 OK for valid bearer token, got: %d", rr3.Code)
	}

	// Case 4: Valid Cookie token -> 200
	req4 := httptest.NewRequest(http.MethodGet, "/v1/auth/me", nil)
	req4.AddCookie(&http.Cookie{
		Name:  "session_token",
		Value: plainToken,
	})
	rr4 := httptest.NewRecorder()
	handler.ServeHTTP(rr4, req4)
	if rr4.Code != http.StatusOK {
		t.Errorf("expected 200 OK for valid cookie token, got: %d", rr4.Code)
	}
}
