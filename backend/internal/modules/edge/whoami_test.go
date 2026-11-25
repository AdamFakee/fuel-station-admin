package edge_test

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"fuel-station-backend/internal/modules/edge"
	"fuel-station-backend/internal/shared/apperr"
	"github.com/go-chi/chi/v5"
)

func whoamiRouter(repo *mockRepo) http.Handler {
	r := chi.NewRouter()
	h := edge.NewHandler(edge.NewService(repo, testLogger()), testLogger())
	r.Route("/edge/v1", func(er chi.Router) { h.RegisterRoutes(er, edge.RequireEdgeApiKey(repo, testLogger())) })
	return r
}

func repoWithKey() *mockRepo {
	return &mockRepo{
		findStationByApiKeyHashFunc: func(ctx context.Context, keyHash string) (*edge.StationContext, error) {
			if keyHash == edge.HashApiKey("valid_key") {
				return sampleStation(), nil
			}
			return nil, apperr.ErrUnauthorized
		},
	}
}

// Khóa đúng: trả mã trạm, con trỏ lớn nhất trên server và số thay đổi chưa kéo; con trỏ của trạm được chuyển xuống truy vấn.
func TestWhoAmI_ReturnsStationAndPendingCounts(t *testing.T) {
	repo := repoWithKey()
	var gotCursor int64
	repo.catalogStatsFunc = func(ctx context.Context, tenantID string, cursor int64, limit int) (int64, int64, error) {
		gotCursor = cursor
		return 7, 532, nil
	}
	repo.updateLastSyncAtFunc = func(ctx context.Context, stationID string) error {
		t.Error("whoami là chỉ đọc, không được ghi last_sync_at")
		return nil
	}

	req := httptest.NewRequest(http.MethodGet, "/edge/v1/whoami?cursor=525", nil)
	req.Header.Set("X-Api-Key", "valid_key")
	rr := httptest.NewRecorder()
	whoamiRouter(repo).ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("mong 200, được %d: %s", rr.Code, rr.Body.String())
	}
	var resp edge.WhoAmIResponse
	if err := json.Unmarshal(rr.Body.Bytes(), &resp); err != nil {
		t.Fatal(err)
	}
	if resp.StationCode != "EDGE-01" || resp.ServerCursor != 532 || resp.PendingChanges != 7 || resp.PendingCapped {
		t.Fatalf("kết quả sai: %+v", resp)
	}
	if gotCursor != 525 {
		t.Fatalf("con trỏ phải được chuyển xuống truy vấn, được %d", gotCursor)
	}
	if rr.Header().Get("Cache-Control") != "no-store" {
		t.Fatal("whoami không được lưu đệm")
	}
}

// Khóa sai hoặc thiếu: 401, và không chạm vào dữ liệu.
func TestWhoAmI_RejectsBadKeys(t *testing.T) {
	repo := repoWithKey()
	repo.catalogStatsFunc = func(ctx context.Context, tenantID string, cursor int64, limit int) (int64, int64, error) {
		t.Error("khóa sai không được chạm vào dữ liệu")
		return 0, 0, nil
	}
	for _, key := range []string{"", "wrong_key"} {
		req := httptest.NewRequest(http.MethodGet, "/edge/v1/whoami", nil)
		if key != "" {
			req.Header.Set("X-Api-Key", key)
		}
		rr := httptest.NewRecorder()
		whoamiRouter(repo).ServeHTTP(rr, req)
		if rr.Code != http.StatusUnauthorized {
			t.Fatalf("khóa %q: mong 401, được %d", key, rr.Code)
		}
	}
}

// Trạm tụt xa: số đếm dừng ở mốc chặn và báo capped, để câu hỏi luôn rẻ.
func TestWhoAmI_CapsThePendingCount(t *testing.T) {
	repo := repoWithKey()
	var gotLimit int
	repo.catalogStatsFunc = func(ctx context.Context, tenantID string, cursor int64, limit int) (int64, int64, error) {
		gotLimit = limit
		return int64(limit), 700016, nil // đếm chạm mốc chặn (giới hạn + 1)
	}

	req := httptest.NewRequest(http.MethodGet, "/edge/v1/whoami", nil)
	req.Header.Set("X-Api-Key", "valid_key")
	rr := httptest.NewRecorder()
	whoamiRouter(repo).ServeHTTP(rr, req)

	var resp edge.WhoAmIResponse
	if err := json.Unmarshal(rr.Body.Bytes(), &resp); err != nil {
		t.Fatal(err)
	}
	if !resp.PendingCapped || resp.PendingChanges != 10000 || gotLimit != 10001 {
		t.Fatalf("mong capped ở 10000 (hỏi 10001), được %+v, limit %d", resp, gotLimit)
	}
}
