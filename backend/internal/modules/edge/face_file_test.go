package edge_test

import (
	"context"
	"errors"
	"fmt"
	"io"
	"strings"
	"testing"
	"time"

	"fuel-station-backend/internal/modules/edge"
	"fuel-station-backend/internal/shared/storage"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

// fakeFiles giả kho ảnh: chỉ các khóa trong present là đọc được.
type fakeFiles struct{ present map[string]bool }

func (f fakeFiles) Save(context.Context, uuid.UUID, string, string, *uuid.UUID, io.Reader) (*storage.StoredFile, error) {
	return nil, errors.New("không dùng")
}
func (f fakeFiles) Delete(context.Context, uuid.UUID, uuid.UUID) error {
	return errors.New("không dùng")
}
func (f fakeFiles) Open(_ context.Context, _ uuid.UUID, key string) (io.ReadCloser, error) {
	if f.present[key] {
		return io.NopCloser(strings.NewReader("jpg")), nil
	}
	return nil, errors.New("không có tệp")
}

// Thẻ mặt có dòng ảnh trong DB nhưng tệp ảnh mất thì danh mục xuống trạm KHÔNG mang dữ liệu của thẻ đó (trạm bỏ qua mục không có
// dữ liệu), để trạm không bị 404 khi tải ảnh và không bị kẹt cả đợt kéo. Thẻ có đủ tệp vẫn xuống bình thường.
func TestCatalogSkipsFaceCredentialsWhoseImageFileIsMissing(t *testing.T) {
	const (
		dbURL    = "postgres://postgres:postgres@localhost:5432/fuel_station_db?sslmode=disable"
		tenantID = "11111111-1111-1111-1111-111111111111"
		branchID = "22222222-2222-2222-2222-222222222221"
	)
	ctx := context.Background()
	pool, err := pgxpool.New(ctx, dbURL)
	if err != nil {
		t.Skipf("skipping test: database not reachable: %v", err)
	}
	defer pool.Close()
	if err := pool.Ping(ctx); err != nil {
		t.Skipf("skipping test: database ping failed: %v", err)
	}

	var cursor int64
	if err := pool.QueryRow(ctx, `SELECT COALESCE(MAX(seq), 0) FROM station.sync_change_log`).Scan(&cursor); err != nil {
		t.Fatalf("read cursor: %v", err)
	}

	suffix := time.Now().UnixNano() % 1000000
	var driverIDs []string
	newDriver := func(tag string) string {
		var id string
		if err := pool.QueryRow(ctx, `INSERT INTO station.driver (tenant_id, code, full_name) VALUES ($1, $2, 'Tai xe thu') RETURNING id`,
			tenantID, fmt.Sprintf("FT%s%d", tag, suffix)).Scan(&id); err != nil {
			t.Fatalf("insert driver: %v", err)
		}
		driverIDs = append(driverIDs, id)
		return id
	}
	// Mỗi tài xế chỉ có một thẻ mặt đang hiệu lực, nên hai thẻ thử thuộc hai tài xế khác nhau
	newFace := func(driverID, key string) (credentialID string) {
		var fileID string
		if err := pool.QueryRow(ctx, `INSERT INTO station.stored_file (tenant_id, storage_key, file_name, content_type, size_bytes) VALUES ($1, $2, 'a.jpg', 'image/jpeg', 3) RETURNING id`,
			tenantID, key).Scan(&fileID); err != nil {
			t.Fatalf("insert stored_file: %v", err)
		}
		if err := pool.QueryRow(ctx, `INSERT INTO station.credential (tenant_id, driver_id, method, external_id, status, face_file_id) VALUES ($1, $2, 'face', $3, 'active', $4) RETURNING id`,
			tenantID, driverID, fmt.Sprintf("FACE%d%s", suffix, key[5:7]), fileID).Scan(&credentialID); err != nil {
			t.Fatalf("insert face credential: %v", err)
		}
		return credentialID
	}
	okKey := fmt.Sprintf("test/ok-%d.jpg", suffix)
	goneKey := fmt.Sprintf("test/gone-%d.jpg", suffix)
	okCred, goneCred := newFace(newDriver("A"), okKey), newFace(newDriver("B"), goneKey)
	defer func() {
		for _, id := range driverIDs {
			_, _ = pool.Exec(ctx, `DELETE FROM station.credential WHERE driver_id = $1`, id)
		}
		_, _ = pool.Exec(ctx, `DELETE FROM station.stored_file WHERE storage_key IN ($1, $2)`, okKey, goneKey)
		for _, id := range driverIDs {
			_, _ = pool.Exec(ctx, `DELETE FROM station.driver WHERE id = $1`, id)
		}
	}()

	repo := edge.WithFileStore(edge.NewRepository(pool), fakeFiles{present: map[string]bool{okKey: true}})
	changes, _, _, err := repo.GetCatalogChanges(ctx, tenantID, branchID, cursor, 1000)
	if err != nil {
		t.Fatalf("GetCatalogChanges: %v", err)
	}
	var okHasData, goneHasData, sawOk, sawGone bool
	for _, c := range changes {
		if c.EntityType != "credential" {
			continue
		}
		switch c.EntityID {
		case okCred:
			sawOk, okHasData = true, c.Data != nil
		case goneCred:
			sawGone, goneHasData = true, c.Data != nil
		}
	}
	if !sawOk || !okHasData {
		t.Fatalf("the face credential with its image file must reach the station with data (seen=%v data=%v)", sawOk, okHasData)
	}
	if !sawGone || goneHasData {
		t.Fatalf("the face credential whose image file is gone must reach the station WITHOUT data (seen=%v data=%v)", sawGone, goneHasData)
	}
}
