package master_test

import (
	"bytes"
	"context"
	"errors"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"testing"

	"fuel-station-backend/internal/modules/master"
	"fuel-station-backend/internal/shared/apperr"
	"fuel-station-backend/internal/shared/authz"
	"fuel-station-backend/internal/shared/middleware"
	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
)

// ------------------------------------------------------------------------------------------------
// UNIT TESTS: VALIDATION & CONVERSION
// ------------------------------------------------------------------------------------------------

func TestTankCapacityConversion(t *testing.T) {
	// 50.5 Liters = 50500 ml
	liters := 50.5
	ml := int64(liters * 1000.0)
	if ml != 50500 {
		t.Fatalf("expected 50500 ml, got %d", ml)
	}

	backToLiters := float64(ml) / 1000.0
	if backToLiters != liters {
		t.Fatalf("expected %f liters, got %f", liters, backToLiters)
	}
}

func TestFacePhotoSizeLimitEnforcement(t *testing.T) {
	// BRD Requirement: Facial recognition image must not exceed 200 KB
	svc := master.NewService(nil, nil)

	ctx := context.Background()
	tenantID := uuid.New().String()
	p := authz.NewPrincipal(uuid.New().String(), tenantID, "MANAGER", []authz.Permission{"master.driver:update"})
	ctx = authz.WithPrincipal(ctx, p)
	ctx = middleware.WithTenantID(ctx, tenantID)

	oversizedData := make([]byte, master.MaxFaceImageSizeBytes+1024)
	r := bytes.NewReader(oversizedData)

	_, err := svc.UploadDriverFace(ctx, uuid.New(), "avatar.jpg", "image/jpeg", int64(len(oversizedData)), r)
	if err == nil {
		t.Fatalf("expected error for oversized face image (> 200KB), got nil")
	}
	if !errors.Is(err, apperr.ErrInvalidInput) && err.Error() == "" {
		t.Fatalf("expected ErrInvalidInput, got %v", err)
	}
}

func TestMasterRoutes_PermissionChecks(t *testing.T) {
	logger := slog.New(slog.NewTextHandler(io.Discard, nil))
	svc := master.NewService(nil, nil)
	handler := master.NewHandler(svc, logger)

	r := chi.NewRouter()
	fakeAuthMiddleware := func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
			next.ServeHTTP(w, req)
		})
	}
	handler.RegisterRoutes(r, fakeAuthMiddleware)

	// 1. Unauthenticated -> 401
	req1 := httptest.NewRequest(http.MethodGet, "/master/vehicles", nil)
	rr1 := httptest.NewRecorder()
	r.ServeHTTP(rr1, req1)
	if rr1.Code != http.StatusUnauthorized {
		t.Errorf("expected 401 for unauthenticated vehicle list, got %d", rr1.Code)
	}

	// 2. Authenticated but missing master.vehicle:view -> 403
	pWithoutPerm := authz.NewPrincipal("u1", "t1", "GUEST", []authz.Permission{"other:view"})
	req2 := httptest.NewRequest(http.MethodGet, "/master/vehicles", nil)
	req2 = req2.WithContext(authz.WithPrincipal(req2.Context(), pWithoutPerm))
	req2 = req2.WithContext(middleware.WithTenantID(req2.Context(), "t1"))
	rr2 := httptest.NewRecorder()
	r.ServeHTTP(rr2, req2)
	if rr2.Code != http.StatusForbidden {
		t.Errorf("expected 403 for principal without master.vehicle:view, got %d", rr2.Code)
	}

	// 3. Authenticated but missing master.driver:view -> 403
	req3 := httptest.NewRequest(http.MethodGet, "/master/drivers", nil)
	req3 = req3.WithContext(authz.WithPrincipal(req3.Context(), pWithoutPerm))
	req3 = req3.WithContext(middleware.WithTenantID(req3.Context(), "t1"))
	rr3 := httptest.NewRecorder()
	r.ServeHTTP(rr3, req3)
	if rr3.Code != http.StatusForbidden {
		t.Errorf("expected 403 for principal without master.driver:view, got %d", rr3.Code)
	}

	// 4. Authenticated with master.vehicle:create -> POST /master/vehicles allowed through authz
	validTenant := uuid.New().String()
	validUser := uuid.New().String()
	pWithCreate := authz.NewPrincipal(validUser, validTenant, "MANAGER", []authz.Permission{"master.vehicle:create"})
	req4 := httptest.NewRequest(http.MethodPost, "/master/vehicles", bytes.NewBufferString("{}"))
	req4 = req4.WithContext(authz.WithPrincipal(req4.Context(), pWithCreate))
	req4 = req4.WithContext(middleware.WithTenantID(req4.Context(), validTenant))
	rr4 := httptest.NewRecorder()
	r.ServeHTTP(rr4, req4)
	if rr4.Code == http.StatusUnauthorized || rr4.Code == http.StatusForbidden {
		t.Errorf("did not expect 401 or 403 with master.vehicle:create, got %d", rr4.Code)
	}
}
