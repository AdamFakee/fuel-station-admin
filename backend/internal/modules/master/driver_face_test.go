package master_test

import (
	"bytes"
	"os"
	"path/filepath"
	"testing"

	"github.com/google/uuid"

	"fuel-station-backend/internal/modules/master"
	"fuel-station-backend/internal/shared/storage"
)

// Đổi ảnh khuôn mặt: ảnh cũ bị xóa hẳn (dòng trong DB và tệp trên đĩa), chỉ còn ảnh mới và đúng một thẻ mặt đang hiệu lực.
func TestReplacingFaceDeletesTheOldImage(t *testing.T) {
	_, pool, ctx, _ := scopeSetup(t)
	defer pool.Close()

	dir := t.TempDir()
	store, err := storage.NewLocalDiskStorage(dir, pool)
	if err != nil {
		t.Fatalf("storage: %v", err)
	}
	svc := master.NewService(pool, store)

	driver, err := svc.CreateDriver(ctx, master.CreateDriverRequest{FullName: "Tài xế thử đổi ảnh"})
	if err != nil {
		t.Fatalf("CreateDriver: %v", err)
	}
	// defer (không dùng t.Cleanup): phải chạy trước khi pool đóng
	defer func() { _ = svc.DeleteDriver(ctx, driver.ID) }()

	image := []byte("\xff\xd8\xff\xe0 anh thu")
	first, err := svc.UploadDriverFace(ctx, driver.ID, "a.jpg", "image/jpeg", int64(len(image)), bytes.NewReader(image))
	if err != nil {
		t.Fatalf("first upload: %v", err)
	}
	second, err := svc.UploadDriverFace(ctx, driver.ID, "b.jpg", "image/jpeg", int64(len(image)), bytes.NewReader(image))
	if err != nil {
		t.Fatalf("second upload: %v", err)
	}
	defer func() { _ = store.Delete(ctx, uuid.MustParse(scopeTenantID), *second.FaceFileID) }()

	var oldRows, newRows int
	_ = pool.QueryRow(ctx, `SELECT COUNT(*) FROM station.stored_file WHERE id = $1`, first.FaceFileID).Scan(&oldRows)
	_ = pool.QueryRow(ctx, `SELECT COUNT(*) FROM station.stored_file WHERE id = $1`, second.FaceFileID).Scan(&newRows)
	if oldRows != 0 || newRows != 1 {
		t.Fatalf("expected old image row deleted and new kept, got old=%d new=%d", oldRows, newRows)
	}

	// Tệp trên đĩa: chỉ còn tệp của ảnh mới.
	var files []string
	_ = filepath.Walk(dir, func(path string, info os.FileInfo, err error) error {
		if err == nil && !info.IsDir() {
			files = append(files, filepath.Base(path))
		}
		return nil
	})
	if len(files) != 1 || files[0] != second.FaceFileID.String()+".jpg" {
		t.Fatalf("expected only the new image on disk, got %v", files)
	}

	// Chỉ một thẻ mặt còn hiệu lực, thẻ cũ không còn liên kết tới ảnh.
	var active, dangling int
	_ = pool.QueryRow(ctx, `SELECT COUNT(*) FROM station.credential WHERE driver_id = $1 AND method = 'face' AND status = 'active'`, driver.ID).Scan(&active)
	_ = pool.QueryRow(ctx, `SELECT COUNT(*) FROM station.credential WHERE driver_id = $1 AND method = 'face' AND status <> 'active' AND face_file_id IS NOT NULL`, driver.ID).Scan(&dangling)
	if active != 1 || dangling != 0 {
		t.Fatalf("expected 1 active face credential and no revoked one keeping an image, got active=%d dangling=%d", active, dangling)
	}
}
