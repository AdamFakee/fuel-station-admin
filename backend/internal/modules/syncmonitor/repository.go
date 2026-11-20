package syncmonitor

import (
	"context"
	"errors"
	"fmt"

	"github.com/jackc/pgx/v5/pgxpool"
)

type Repository interface {
	GetStationsStatus(ctx context.Context, tenantID string, branchIDs []string) ([]EdgeStationStatus, error)
}

type postgresRepository struct {
	pool *pgxpool.Pool
}

func NewRepository(pool *pgxpool.Pool) Repository {
	return &postgresRepository{pool: pool}
}

func (r *postgresRepository) GetStationsStatus(ctx context.Context, tenantID string, branchIDs []string) ([]EdgeStationStatus, error) {
	if r.pool == nil {
		return nil, errors.New("db pool not initialized")
	}

	query := `
		SELECT s.id, s.branch_id, b.code AS branch_code, b.name AS branch_name,
		       s.code, s.name, s.status, s.last_seen_at, s.last_sync_at,
		       s.pending_queue, s.agent_version, s.last_error, s.created_at, s.updated_at,
		       (s.last_seen_at IS NOT NULL AND s.last_seen_at >= now() - interval '5 minutes') AS is_online
		FROM station.edge_station s
		JOIN station.branch b ON b.id = s.branch_id AND b.tenant_id = s.tenant_id
		WHERE s.tenant_id = $1
		  AND (cardinality($2::uuid[]) = 0 OR s.branch_id = ANY($2::uuid[]))
		ORDER BY s.code ASC
	`

	rows, err := r.pool.Query(ctx, query, tenantID, branchIDs)
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
			&st.IsOnline,
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
