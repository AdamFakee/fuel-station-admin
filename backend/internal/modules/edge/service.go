package edge

import (
	"context"
	"fmt"
	"log/slog"
	"strings"
	"time"

	"fuel-station-backend/internal/shared/apperr"
)

type Service interface {
	GetCatalogChanges(ctx context.Context, cursor int64, limit int) (*CatalogChangesResponse, error)
	ReceiveDispenseSession(ctx context.Context, req CreateDispenseSessionRequest) (*DispenseSessionResponse, error)
	ReceiveAccessEvents(ctx context.Context, events []AccessEventInput) (*BatchAccessEventsResponse, error)
	Heartbeat(ctx context.Context, req HeartbeatRequest) (*HeartbeatResponse, error)
	WhoAmI(ctx context.Context, cursor int64) (*WhoAmIResponse, error)
}

type service struct {
	repo Repository
	log  *slog.Logger
}

func NewService(repo Repository, log *slog.Logger) Service {
	return &service{
		repo: repo,
		log:  log,
	}
}

func (s *service) GetCatalogChanges(ctx context.Context, cursor int64, limit int) (*CatalogChangesResponse, error) {
	station, ok := StationFromContext(ctx)
	if !ok || station.StationID == "" {
		return nil, apperr.ErrUnauthorized
	}

	changes, nextCursor, hasMore, err := s.repo.GetCatalogChanges(ctx, station.TenantID, station.BranchID, cursor, limit)
	if err != nil {
		return nil, fmt.Errorf("fetch catalog changes: %w", err)
	}

	_ = s.repo.UpdateLastSyncAt(ctx, station.StationID)

	if changes == nil {
		changes = []CatalogChangeItem{}
	}

	return &CatalogChangesResponse{
		Changes:    changes,
		NextCursor: nextCursor,
		HasMore:    hasMore,
	}, nil
}

// pendingCap giới hạn số dòng đếm khi trả số thay đổi chưa kéo, để câu hỏi luôn rẻ dù trạm tụt xa.
const pendingCap = 10000

// WhoAmI xác nhận khóa API (middleware đã kiểm) và cho biết trạm còn bao nhiêu thay đổi chưa kéo. Không ghi gì.
func (s *service) WhoAmI(ctx context.Context, cursor int64) (*WhoAmIResponse, error) {
	station, ok := StationFromContext(ctx)
	if !ok || station.StationID == "" {
		return nil, apperr.ErrUnauthorized
	}
	if cursor < 0 {
		cursor = 0
	}
	pending, maxSeq, err := s.repo.CatalogStats(ctx, station.TenantID, cursor, pendingCap+1)
	if err != nil {
		return nil, fmt.Errorf("catalog stats: %w", err)
	}
	capped := pending > pendingCap
	if capped {
		pending = pendingCap
	}
	return &WhoAmIResponse{
		StationCode:    station.StationCode,
		StationName:    station.StationName,
		ServerCursor:   maxSeq,
		PendingChanges: pending,
		PendingCapped:  capped,
	}, nil
}

func (s *service) ReceiveDispenseSession(ctx context.Context, req CreateDispenseSessionRequest) (*DispenseSessionResponse, error) {
	station, ok := StationFromContext(ctx)
	if !ok || station.StationID == "" {
		return nil, apperr.ErrUnauthorized
	}

	req.EdgeRef = strings.TrimSpace(req.EdgeRef)
	if req.EdgeRef == "" {
		return nil, fmt.Errorf("%w: edge_ref is required", apperr.ErrInvalidInput)
	}

	if req.DispensedML < 0 {
		return nil, fmt.Errorf("%w: dispensed_ml must be >= 0", apperr.ErrInvalidInput)
	}

	// Validate status against DB constraint ('completed', 'cancelled', 'failed')
	req.Status = strings.ToLower(strings.TrimSpace(req.Status))
	if req.Status != "completed" && req.Status != "cancelled" && req.Status != "failed" {
		return nil, fmt.Errorf("%w: invalid status, must be 'completed', 'cancelled' or 'failed'", apperr.ErrInvalidInput)
	}

	// Constraint: CHECK (status <> 'cancelled' OR dispensed_ml = 0)
	if req.Status == "cancelled" && req.DispensedML != 0 {
		return nil, fmt.Errorf("%w: cancelled session must have dispensed_ml = 0", apperr.ErrInvalidInput)
	}

	// Validate edge_state against DB constraint ('completed', 'enable_failed', 'timed_out', 'aborted', 'cancelled')
	req.EdgeState = strings.ToLower(strings.TrimSpace(req.EdgeState))
	if req.EdgeState == "" {
		if req.Status == "completed" {
			req.EdgeState = "completed"
		} else if req.Status == "cancelled" {
			req.EdgeState = "cancelled"
		} else {
			req.EdgeState = "aborted"
		}
	}

	// Idempotency check: if already processed, return existing record
	existing, err := s.repo.FindDispenseSessionByRef(ctx, station.StationID, req.EdgeRef)
	if err != nil {
		s.log.ErrorContext(ctx, "failed checking existing dispense session", "err", err)
	}
	if existing != nil {
		s.log.InfoContext(ctx, "idempotent dispense session hit", "edge_ref", req.EdgeRef, "session_id", existing.ID)
		return existing, nil
	}

	resp, err := s.repo.CreateDispenseSession(ctx, station, req)
	if err != nil {
		s.log.ErrorContext(ctx, "create dispense session error", "err", err, "edge_ref", req.EdgeRef)
		return nil, fmt.Errorf("create dispense session: %w", err)
	}

	s.log.InfoContext(ctx, "dispense session recorded successfully",
		"code", resp.Code,
		"status", resp.Status,
		"dispensed_ml", resp.DispensedML,
	)

	return resp, nil
}

func (s *service) ReceiveAccessEvents(ctx context.Context, events []AccessEventInput) (*BatchAccessEventsResponse, error) {
	station, ok := StationFromContext(ctx)
	if !ok || station.StationID == "" {
		return nil, apperr.ErrUnauthorized
	}

	inserted, err := s.repo.BatchInsertAccessEvents(ctx, station, events)
	if err != nil {
		return nil, fmt.Errorf("insert access events: %w", err)
	}

	return &BatchAccessEventsResponse{
		ReceivedCount: len(events),
		InsertedCount: inserted,
	}, nil
}

func (s *service) Heartbeat(ctx context.Context, req HeartbeatRequest) (*HeartbeatResponse, error) {
	station, ok := StationFromContext(ctx)
	if !ok || station.StationID == "" {
		return nil, apperr.ErrUnauthorized
	}

	if req.PendingQueue < 0 {
		req.PendingQueue = 0
	}

	agentVersion := strings.TrimSpace(req.AgentVersion)
	if agentVersion == "" {
		agentVersion = "unknown"
	}

	if err := s.repo.UpdateHeartbeat(ctx, station.StationID, req.PendingQueue, agentVersion, req.LastError); err != nil {
		return nil, fmt.Errorf("update heartbeat: %w", err)
	}

	return &HeartbeatResponse{
		Status:     "online",
		ServerTime: time.Now().UTC(),
	}, nil
}
