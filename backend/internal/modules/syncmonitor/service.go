package syncmonitor

import (
	"context"
	"fmt"
	"log/slog"

	"fuel-station-backend/internal/shared/apperr"
	"fuel-station-backend/internal/shared/authz"
)

type Service interface {
	GetStations(ctx context.Context) (*SyncMonitorResponse, error)
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

func (s *service) GetStations(ctx context.Context) (*SyncMonitorResponse, error) {
	principal, ok := authz.FromContext(ctx)
	if !ok || principal.TenantID == "" {
		return nil, apperr.ErrUnauthorized
	}

	stations, err := s.repo.GetStationsStatus(ctx, principal.TenantID, principal.BranchIDs)
	if err != nil {
		return nil, fmt.Errorf("get stations status: %w", err)
	}

	summary := SyncMonitorSummary{
		TotalStations: len(stations),
	}

	for _, st := range stations {
		if st.IsOnline {
			summary.OnlineStations++
		} else {
			summary.OfflineStations++
		}
		summary.TotalPendingQueue += st.PendingQueue
		if st.LastError != nil && *st.LastError != "" {
			summary.ErrorStations++
		}
	}

	return &SyncMonitorResponse{
		Summary:  summary,
		Stations: stations,
	}, nil
}
