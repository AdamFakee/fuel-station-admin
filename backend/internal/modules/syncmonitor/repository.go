package syncmonitor

import (
	"context"
	"errors"
	"fmt"
	"time"

	"fuel-station-backend/internal/shared/apperr"
	"fuel-station-backend/internal/shared/audit"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type Repository interface {
	GetStationsStatus(ctx context.Context, tenantID string) ([]EdgeStationStatus, error)
	// IssueAPIKey đặt (hoặc thay) bản băm khóa API của trạm Edge thuộc chi nhánh; chưa có trạm thì tạo. Ghi nhật ký kiểm toán.
	IssueAPIKey(ctx context.Context, p KeyChange, keyHash, keyHint string) (stationCode string, reissued bool, err error)
	// RevokeAPIKey xóa khóa và đặt trạm ngừng hoạt động: trạm dùng khóa cũ bị từ chối ngay.
	RevokeAPIKey(ctx context.Context, p KeyChange) error
}

// KeyChange là ngữ cảnh một thay đổi khóa: chi nhánh nào, ai làm.
type KeyChange struct {
	TenantID  string
	BranchID  string
	ActorID   string
	ActorName string
	IP        string
}

type postgresRepository struct {
	pool *pgxpool.Pool
}

func NewRepository(pool *pgxpool.Pool) Repository {
	return &postgresRepository{pool: pool}
}

func (r *postgresRepository) GetStationsStatus(ctx context.Context, tenantID string) ([]EdgeStationStatus, error) {
	if r.pool == nil {
		return nil, errors.New("db pool not initialized")
	}

	// Xuất phát từ chi nhánh để thấy cả chi nhánh chưa có trạm Edge (chưa cấp khóa).
	query := `
		SELECT COALESCE(s.id::text, ''), b.id, b.code AS branch_code, b.name AS branch_name,
		       COALESCE(s.code, ''), COALESCE(s.name, ''), COALESCE(s.status, 'inactive'), s.last_seen_at, s.last_sync_at,
		       COALESCE(s.pending_queue, 0), s.agent_version, s.last_error,
		       COALESCE(s.created_at, b.created_at), COALESCE(s.updated_at, b.updated_at),
		       (s.last_seen_at IS NOT NULL AND s.last_seen_at >= now() - interval '5 minutes') AS is_online,
		       (s.id IS NOT NULL) AS has_station,
		       (s.api_key_hash IS NOT NULL AND s.status = 'active') AS has_api_key,
		       CASE WHEN s.api_key_hash IS NOT NULL AND s.status = 'active' THEN s.api_key_hint END AS api_key_hint
		FROM station.branch b
		LEFT JOIN station.edge_station s ON s.branch_id = b.id AND s.tenant_id = b.tenant_id
		WHERE b.tenant_id = $1 AND (s.id IS NOT NULL OR b.status = 'active')
		ORDER BY COALESCE(s.code, b.code) ASC
	`

	rows, err := r.pool.Query(ctx, query, tenantID)
	if err != nil {
		return nil, fmt.Errorf("query edge stations status: %w", err)
	}
	defer rows.Close()

	var stations []EdgeStationStatus
	for rows.Next() {
		var st EdgeStationStatus
		if err := rows.Scan(
			&st.ID, &st.BranchID, &st.BranchCode, &st.BranchName,
			&st.Code, &st.Name, &st.Status, &st.LastSeenAt, &st.LastSyncAt,
			&st.PendingQueue, &st.AgentVersion, &st.LastError, &st.CreatedAt, &st.UpdatedAt,
			&st.IsOnline, &st.HasStation, &st.HasAPIKey, &st.APIKeyHint,
		); err != nil {
			return nil, fmt.Errorf("scan edge station status: %w", err)
		}
		stations = append(stations, st)
	}

	if stations == nil {
		stations = []EdgeStationStatus{}
	}

	return stations, nil
}

func parseIDs(p KeyChange) (tenantID, branchID uuid.UUID, actorID *uuid.UUID, err error) {
	tenantID, err = uuid.Parse(p.TenantID)
	if err != nil {
		return uuid.Nil, uuid.Nil, nil, fmt.Errorf("%w: tenant_id không hợp lệ", apperr.ErrUnauthorized)
	}
	branchID, err = uuid.Parse(p.BranchID)
	if err != nil {
		return uuid.Nil, uuid.Nil, nil, fmt.Errorf("%w: mã chi nhánh không hợp lệ", apperr.ErrInvalidInput)
	}
	if id, perr := uuid.Parse(p.ActorID); perr == nil {
		actorID = &id
	}
	return tenantID, branchID, actorID, nil
}

func (r *postgresRepository) IssueAPIKey(ctx context.Context, p KeyChange, keyHash, keyHint string) (string, bool, error) {
	if r.pool == nil {
		return "", false, errors.New("db pool not initialized")
	}
	tenantID, branchID, actorID, err := parseIDs(p)
	if err != nil {
		return "", false, err
	}

	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return "", false, fmt.Errorf("begin tx: %w", err)
	}
	defer func() { _ = tx.Rollback(ctx) }()

	var branchCode, branchName string
	err = tx.QueryRow(ctx, `SELECT code, name FROM station.branch WHERE id = $1 AND tenant_id = $2`, branchID, tenantID).Scan(&branchCode, &branchName)
	if errors.Is(err, pgx.ErrNoRows) {
		return "", false, fmt.Errorf("%w: không tìm thấy chi nhánh", apperr.ErrNotFound)
	}
	if err != nil {
		return "", false, fmt.Errorf("find branch: %w", err)
	}

	var stationID uuid.UUID
	var stationCode string
	var hadKey bool
	err = tx.QueryRow(ctx, `
		SELECT id, code, (api_key_hash IS NOT NULL AND status = 'active')
		FROM station.edge_station WHERE branch_id = $1 AND tenant_id = $2 FOR UPDATE`, branchID, tenantID).Scan(&stationID, &stationCode, &hadKey)
	action := audit.ActionUpdate
	switch {
	case errors.Is(err, pgx.ErrNoRows):
		// Chưa có trạm: tạo, mã trạm theo mã chi nhánh (hợp lệ làm station_id trong edge.conf)
		stationID = uuid.New()
		stationCode = "EDGE-" + branchCode
		if len(stationCode) > 32 {
			stationCode = stationCode[:32]
		}
		action = audit.ActionCreate
		_, err = tx.Exec(ctx, `
			INSERT INTO station.edge_station (id, tenant_id, branch_id, code, name, api_key_hash, api_key_hint, status)
			VALUES ($1, $2, $3, $4, $5, $6, $7, 'active')`, stationID, tenantID, branchID, stationCode, "Edge Agent "+branchName, keyHash, keyHint)
		if err != nil {
			return "", false, fmt.Errorf("insert edge station: %w", err)
		}
	case err != nil:
		return "", false, fmt.Errorf("find edge station: %w", err)
	default:
		_, err = tx.Exec(ctx, `UPDATE station.edge_station SET api_key_hash = $1, api_key_hint = $2, status = 'active' WHERE id = $3 AND tenant_id = $4`, keyHash, keyHint, stationID, tenantID)
		if err != nil {
			return "", false, fmt.Errorf("update edge station key: %w", err)
		}
	}

	// Nhật ký chỉ ghi sự kiện, không bao giờ ghi khóa hay bản băm
	if err := audit.Record(ctx, tx, audit.Entry{
		Action:      action,
		EntityType:  "edge_station_key",
		EntityID:    &stationID,
		EntityCode:  stationCode,
		ActorUserID: actorID,
		ActorName:   p.ActorName,
		IP:          p.IP,
		NewData:     map[string]any{"branch_code": branchCode, "reissued": hadKey, "issued_at": time.Now().UTC()},
	}); err != nil {
		return "", false, fmt.Errorf("audit api key issue: %w", err) // thao tác nhạy cảm: không ghi được nhật ký thì hủy
	}

	if err := tx.Commit(ctx); err != nil {
		return "", false, fmt.Errorf("commit tx: %w", err)
	}
	return stationCode, hadKey, nil
}

func (r *postgresRepository) RevokeAPIKey(ctx context.Context, p KeyChange) error {
	if r.pool == nil {
		return errors.New("db pool not initialized")
	}
	tenantID, branchID, actorID, err := parseIDs(p)
	if err != nil {
		return err
	}
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return fmt.Errorf("begin tx: %w", err)
	}
	defer func() { _ = tx.Rollback(ctx) }()

	var stationID uuid.UUID
	var stationCode string
	err = tx.QueryRow(ctx, `
		UPDATE station.edge_station SET api_key_hash = NULL, api_key_hint = NULL, status = 'inactive'
		WHERE branch_id = $1 AND tenant_id = $2
		RETURNING id, code`, branchID, tenantID).Scan(&stationID, &stationCode)
	if errors.Is(err, pgx.ErrNoRows) {
		return fmt.Errorf("%w: chi nhánh này chưa có trạm Edge", apperr.ErrNotFound)
	}
	if err != nil {
		return fmt.Errorf("revoke edge station key: %w", err)
	}
	if err := audit.Record(ctx, tx, audit.Entry{
		Action:      audit.ActionLock,
		EntityType:  "edge_station_key",
		EntityID:    &stationID,
		EntityCode:  stationCode,
		ActorUserID: actorID,
		ActorName:   p.ActorName,
		IP:          p.IP,
		NewData:     map[string]any{"revoked": true},
	}); err != nil {
		return fmt.Errorf("audit api key revoke: %w", err)
	}
	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("commit tx: %w", err)
	}
	return nil
}
