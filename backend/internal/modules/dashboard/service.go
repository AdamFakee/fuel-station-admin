package dashboard

import (
	"context"
	"fmt"
	"log/slog"

	"fuel-station-backend/internal/shared/apperr"
	"fuel-station-backend/internal/shared/authz"
)

type Service interface {
	GetDashboard(ctx context.Context) (*DashboardResponse, error)
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

func (s *service) GetDashboard(ctx context.Context) (*DashboardResponse, error) {
	principal, ok := authz.FromContext(ctx)
	if !ok || principal.TenantID == "" {
		return nil, apperr.ErrUnauthorized
	}

	data, err := s.repo.GetDashboardData(ctx, principal.TenantID, principal.BranchIDs)
	if err != nil {
		return nil, fmt.Errorf("load dashboard data: %w", err)
	}

	return data, nil
}
