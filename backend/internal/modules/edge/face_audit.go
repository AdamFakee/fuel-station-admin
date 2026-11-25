package edge

import (
	"context"
	"log/slog"

	"fuel-station-backend/internal/shared/storage"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

// AuditFaceFiles rà một lượt khi khởi động: thẻ mặt còn hiệu lực nào có dòng ảnh trong DB mà tệp không đọc được từ kho. Chỉ ghi nhật ký
// để người vận hành biết sớm (trạm sẽ không nhận các thẻ này, xem faceImageReadable); trả về số thẻ lỗi.
func AuditFaceFiles(ctx context.Context, pool *pgxpool.Pool, files storage.Storage, log *slog.Logger) int {
	if pool == nil || files == nil {
		return 0
	}
	rows, err := pool.Query(ctx, `
		SELECT c.tenant_id, c.id, c.external_id, f.storage_key
		FROM station.credential c
		JOIN station.stored_file f ON f.tenant_id = c.tenant_id AND f.id = c.face_file_id
		WHERE c.method = 'face' AND c.status = 'active' AND c.face_file_id IS NOT NULL`)
	if err != nil {
		log.WarnContext(ctx, "không rà được ảnh thẻ mặt", "err", err)
		return 0
	}
	defer rows.Close()

	missing := 0
	for rows.Next() {
		var tenantID, credentialID uuid.UUID
		var externalID, storageKey string
		if err := rows.Scan(&tenantID, &credentialID, &externalID, &storageKey); err != nil {
			continue
		}
		body, err := files.Open(ctx, tenantID, storageKey)
		if err != nil {
			missing++
			log.WarnContext(ctx, "thẻ mặt có dòng ảnh trong DB nhưng tệp ảnh không đọc được: trạm sẽ không nhận thẻ này",
				"credential_id", credentialID, "external_id", externalID, "storage_key", storageKey, "err", err)
			continue
		}
		_ = body.Close()
	}
	if missing > 0 {
		log.WarnContext(ctx, "có thẻ mặt thiếu tệp ảnh trong kho", "count", missing)
	}
	return missing
}
