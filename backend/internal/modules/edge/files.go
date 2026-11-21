package edge

import (
	"io"
	"net/http"

	"fuel-station-backend/internal/shared/apperr"
	"fuel-station-backend/internal/shared/httpx"
	"fuel-station-backend/internal/shared/storage"
	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

// FileServer cho Edge Agent tải ảnh khuôn mặt của credential về để đẩy xuống máy chấm công.
type FileServer struct {
	pool    *pgxpool.Pool
	storage storage.Storage
}

func NewFileServer(pool *pgxpool.Pool, store storage.Storage) *FileServer {
	return &FileServer{pool: pool, storage: store}
}

// Get trả nội dung một tệp thuộc công ty của trạm đã xác thực (GET /edge/v1/files/{id}).
func (f *FileServer) Get(h *Handler) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		station, ok := StationFromContext(r.Context())
		if !ok || f == nil || f.storage == nil {
			httpx.Error(w, r, h.log, apperr.ErrUnauthorized)
			return
		}
		fileID := chi.URLParam(r, "id")
		tenantID, err := uuid.Parse(station.TenantID)
		if err != nil {
			httpx.Error(w, r, h.log, apperr.ErrUnauthorized)
			return
		}

		var storageKey, contentType string
		err = f.pool.QueryRow(r.Context(),
			`SELECT storage_key, content_type FROM station.stored_file WHERE tenant_id = $1 AND id = $2`,
			station.TenantID, fileID).Scan(&storageKey, &contentType)
		if err != nil {
			httpx.Error(w, r, h.log, apperr.ErrNotFound)
			return
		}
		body, err := f.storage.Open(r.Context(), tenantID, storageKey)
		if err != nil {
			httpx.Error(w, r, h.log, apperr.ErrNotFound)
			return
		}
		defer body.Close()
		w.Header().Set("Content-Type", contentType)
		_, _ = io.Copy(w, body)
	}
}
