package feedback_test

import (
	"context"
	"errors"
	"testing"
	"time"

	"fuel-station-backend/internal/modules/feedback"
	"fuel-station-backend/internal/shared/apperr"
	"fuel-station-backend/internal/shared/authz"
	"fuel-station-backend/internal/shared/middleware"
	"github.com/jackc/pgx/v5/pgxpool"
)

const (
	testDBURL       = "postgres://postgres:postgres@localhost:5432/fuel_station_db?sslmode=disable"
	defaultTenantID = "11111111-1111-1111-1111-111111111111"
	adminUserID     = "33333333-3333-3333-3333-333333333331"
)

func setup(t *testing.T) (*feedback.Service, *pgxpool.Pool, context.Context) {
	t.Helper()
	ctx, cancel := context.WithTimeout(context.Background(), 20*time.Second)
	t.Cleanup(cancel)

	pool, err := pgxpool.New(ctx, testDBURL)
	if err != nil || pool.Ping(ctx) != nil {
		t.Skipf("bỏ qua: không kết nối được database (%v)", err)
	}
	var exists bool
	if err := pool.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM station.app_user WHERE id = $1)`, adminUserID).Scan(&exists); err != nil || !exists {
		pool.Close()
		t.Skip("bỏ qua: chưa nạp dữ liệu nền (go run ./cmd/seed)")
	}

	ctx = middleware.WithTenantID(ctx, defaultTenantID)
	ctx = authz.WithPrincipal(ctx, authz.NewPrincipal(adminUserID, defaultTenantID, "MANAGER", nil, []authz.Permission{
		"feedback.item:create", "feedback.item:view", "feedback.item:update", "feedback.item:delete",
	}))
	return feedback.NewService(pool), pool, ctx
}

func TestFeedbackLifecycle(t *testing.T) {
	svc, pool, ctx := setup(t)
	defer pool.Close()

	created, err := svc.Create(ctx, feedback.CreateRequest{
		Kind: feedback.KindBug, Title: "Bảng phiếu nhập không cuộn", Description: "Cuộn chuột không chạy ở màn hình nhỏ",
		PageURL: "http://localhost:3000/inventory/receipts",
		Element: map[string]any{"selector": "main > div > table", "tag": "table", "text": "Mã phiếu"},
	})
	if err != nil {
		t.Fatalf("Create failed: %v", err)
	}
	defer func() { _ = svc.Delete(ctx, created.ID) }()

	if created.Status != feedback.StatusNew || created.Code == "" || created.CreatedByName == "" {
		t.Fatalf("góp ý mới phải có trạng thái new, mã và tên người gửi: %+v", created)
	}
	if created.Element["tag"] != "table" {
		t.Fatalf("phần tử đã chọn phải được lưu lại, got %v", created.Element)
	}

	list, err := svc.List(ctx, feedback.ListQuery{Kind: feedback.KindBug, Search: "cuộn"})
	if err != nil {
		t.Fatalf("List failed: %v", err)
	}
	found := false
	for _, f := range list.Items {
		found = found || f.ID == created.ID
	}
	if !found || list.StatusCounts[feedback.StatusNew] < 1 {
		t.Fatalf("danh sách phải có góp ý vừa tạo và đếm theo trạng thái, got %+v", list.StatusCounts)
	}

	// Từ chối phải có lý do
	if _, err := svc.UpdateStatus(ctx, created.ID, feedback.UpdateStatusRequest{Status: feedback.StatusRejected}); !errors.Is(err, apperr.ErrInvalidInput) {
		t.Fatalf("từ chối không lý do phải bị chặn, got %v", err)
	}
	note := "Đã có sẵn thanh cuộn ở bảng"
	updated, err := svc.UpdateStatus(ctx, created.ID, feedback.UpdateStatusRequest{Status: feedback.StatusRejected, ResolutionNote: &note})
	if err != nil || updated.Status != feedback.StatusRejected || updated.ResolutionNote != note {
		t.Fatalf("UpdateStatus failed: %v %+v", err, updated)
	}

	if err := svc.Delete(ctx, created.ID); err != nil {
		t.Fatalf("Delete failed: %v", err)
	}
	if _, err := svc.Get(ctx, created.ID); !errors.Is(err, apperr.ErrNotFound) {
		t.Fatalf("góp ý đã xóa phải không còn, got %v", err)
	}
}

func TestFeedbackValidation(t *testing.T) {
	svc, pool, ctx := setup(t)
	defer pool.Close()

	cases := map[string]feedback.CreateRequest{
		"loại sai":       {Kind: "khac", Title: "x", Description: "y"},
		"thiếu tiêu đề":  {Kind: feedback.KindBug, Title: "  ", Description: "y"},
		"thiếu nội dung": {Kind: feedback.KindBug, Title: "x", Description: ""},
	}
	for name, req := range cases {
		if _, err := svc.Create(ctx, req); !errors.Is(err, apperr.ErrInvalidInput) {
			t.Errorf("%s: phải trả lỗi dữ liệu không hợp lệ, got %v", name, err)
		}
	}
}
