package middleware_test

import (
	"bytes"
	"context"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"fuel-station-backend/internal/shared/middleware"
)

func TestRequestID_Middleware(t *testing.T) {
	handler := middleware.RequestID(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		reqID, ok := r.Context().Value(middleware.RequestIDKey).(string)
		if !ok || reqID == "" {
			t.Errorf("expected request_id in context")
		}
		w.WriteHeader(http.StatusOK)
	}))

	req := httptest.NewRequest(http.MethodGet, "/healthz", nil)
	rr := httptest.NewRecorder()
	handler.ServeHTTP(rr, req)

	respReqID := rr.Header().Get("X-Request-ID")
	if respReqID == "" {
		t.Errorf("expected X-Request-ID header in response")
	}
}

func TestCORS_StrictOriginsAndNoTenantHeader(t *testing.T) {
	corsMiddleware := middleware.CORS([]string{"http://localhost:3000", "https://admin.fuelstation.vn"})

	testHandler := corsMiddleware(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))

	// Case 1: Allowed Origin
	req1 := httptest.NewRequest(http.MethodGet, "/v1/ping", nil)
	req1.Header.Set("Origin", "http://localhost:3000")
	rr1 := httptest.NewRecorder()
	testHandler.ServeHTTP(rr1, req1)

	if rr1.Header().Get("Access-Control-Allow-Origin") != "http://localhost:3000" {
		t.Errorf("expected Access-Control-Allow-Origin to match, got: %s", rr1.Header().Get("Access-Control-Allow-Origin"))
	}
	if rr1.Header().Get("Access-Control-Allow-Credentials") != "true" {
		t.Errorf("expected credentials to be allowed")
	}

	// Verify X-Tenant-ID is strictly NOT present in Access-Control-Allow-Headers (Security P0)
	allowHeaders := rr1.Header().Get("Access-Control-Allow-Headers")
	if strings.Contains(allowHeaders, "X-Tenant-ID") {
		t.Errorf("Access-Control-Allow-Headers MUST NOT contain X-Tenant-ID (violation of Security P0)")
	}

	// Case 2: Untrusted Origin -> No Allow-Origin header echoed
	req2 := httptest.NewRequest(http.MethodGet, "/v1/ping", nil)
	req2.Header.Set("Origin", "https://evil-site.com")
	rr2 := httptest.NewRecorder()
	testHandler.ServeHTTP(rr2, req2)

	if rr2.Header().Get("Access-Control-Allow-Origin") != "" {
		t.Errorf("untrusted origin must not receive Access-Control-Allow-Origin header")
	}

	// Case 3: OPTIONS Preflight
	req3 := httptest.NewRequest(http.MethodOptions, "/v1/ping", nil)
	req3.Header.Set("Origin", "http://localhost:3000")
	rr3 := httptest.NewRecorder()
	testHandler.ServeHTTP(rr3, req3)

	if rr3.Code != http.StatusNoContent {
		t.Errorf("expected 204 No Content for OPTIONS preflight, got %d", rr3.Code)
	}
}

func TestLogger_Middleware(t *testing.T) {
	var buf bytes.Buffer
	logger := slog.New(slog.NewJSONHandler(&buf, nil))

	handler := middleware.Logger(logger)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusTeapot)
		_, _ = w.Write([]byte("short response"))
	}))

	req := httptest.NewRequest(http.MethodGet, "/status", nil)
	rr := httptest.NewRecorder()
	handler.ServeHTTP(rr, req)

	logOutput := buf.String()
	if !strings.Contains(logOutput, "http request completed") {
		t.Errorf("expected log output to record request completion, got: %s", logOutput)
	}
	if !strings.Contains(logOutput, "418") { // Teapot status
		t.Errorf("expected log output to include status 418, got: %s", logOutput)
	}
}

func TestTenantID_ContextHelpers(t *testing.T) {
	ctx := context.Background()
	ctx = middleware.WithTenantID(ctx, "tenant-1234")

	tenantID, ok := middleware.TenantIDFromContext(ctx)
	if !ok || tenantID != "tenant-1234" {
		t.Fatalf("expected tenant-1234, got %s (ok=%v)", tenantID, ok)
	}
}
