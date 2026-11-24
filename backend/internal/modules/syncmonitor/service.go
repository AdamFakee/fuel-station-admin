package syncmonitor

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"log/slog"
	"time"

	"fuel-station-backend/internal/modules/edge"
	"fuel-station-backend/internal/shared/apperr"
	"fuel-station-backend/internal/shared/authz"
)

type Service interface {
	GetStations(ctx context.Context) (*SyncMonitorResponse, error)
	// IssueAPIKey cấp khóa mới cho trạm của chi nhánh (cấp lại thì khóa cũ mất hiệu lực ngay). Khóa chỉ trả đúng một lần.
	IssueAPIKey(ctx context.Context, branchID, ip string) (*IssuedAPIKey, error)
	// RevokeAPIKey thu hồi khóa, trạm ngừng hoạt động.
	RevokeAPIKey(ctx context.Context, branchID, ip string) error
}

// apiKeyPrefix giúp nhận ra khóa khi bị lộ (quét mã nguồn, nhật ký). Phần ngẫu nhiên dài 192 bit.
const apiKeyPrefix = "edge_"

func newAPIKey() (string, error) {
	buf := make([]byte, 24)
	if _, err := rand.Read(buf); err != nil {
		return "", fmt.Errorf("generate api key: %w", err)
	}
	return apiKeyPrefix + hex.EncodeToString(buf), nil
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

	stations, err := s.repo.GetStationsStatus(ctx, principal.TenantID)
	if err != nil {
		return nil, fmt.Errorf("get stations status: %w", err)
	}

	summary := SyncMonitorSummary{}

	for _, st := range stations {
		if st.ID == "" {
			continue // chi nhánh chưa có trạm Edge: chưa tính vào số liệu giám sát
		}
		summary.TotalStations++
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

func keyChange(ctx context.Context, branchID, ip string) (KeyChange, error) {
	principal, ok := authz.FromContext(ctx)
	if !ok || principal.TenantID == "" {
		return KeyChange{}, apperr.ErrUnauthorized
	}
	return KeyChange{TenantID: principal.TenantID, BranchID: branchID, ActorID: principal.UserID, ActorName: principal.UserID, IP: ip}, nil
}

func (s *service) IssueAPIKey(ctx context.Context, branchID, ip string) (*IssuedAPIKey, error) {
	change, err := keyChange(ctx, branchID, ip)
	if err != nil {
		return nil, err
	}
	key, err := newAPIKey()
	if err != nil {
		return nil, err
	}
	// 7 ký tự cuối lưu kèm để nhận ra khóa; khóa đủ dài (48 ký tự ngẫu nhiên) nên phần này không giúp đoán ra khóa
	code, reissued, err := s.repo.IssueAPIKey(ctx, change, edge.HashApiKey(key), key[len(key)-7:])
	if err != nil {
		return nil, fmt.Errorf("issue api key: %w", err)
	}
	return &IssuedAPIKey{BranchID: branchID, StationCode: code, APIKey: key, IssuedAt: time.Now().UTC(), Reissued: reissued}, nil
}

func (s *service) RevokeAPIKey(ctx context.Context, branchID, ip string) error {
	change, err := keyChange(ctx, branchID, ip)
	if err != nil {
		return err
	}
	if err := s.repo.RevokeAPIKey(ctx, change); err != nil {
		return fmt.Errorf("revoke api key: %w", err)
	}
	return nil
}
