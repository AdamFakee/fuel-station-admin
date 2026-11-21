package feedback

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"unicode/utf8"

	"fuel-station-backend/internal/shared/apperr"
	"fuel-station-backend/internal/shared/audit"
	"fuel-station-backend/internal/shared/authz"
	"fuel-station-backend/internal/shared/middleware"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type Service struct {
	pool *pgxpool.Pool
}

func NewService(pool *pgxpool.Pool) *Service {
	return &Service{pool: pool}
}

func tenantAndActor(ctx context.Context) (tenantID, userID uuid.UUID, role string, err error) {
	tenantStr, ok := middleware.TenantIDFromContext(ctx)
	if !ok || tenantStr == "" {
		return uuid.Nil, uuid.Nil, "", apperr.ErrUnauthorized
	}
	tenantID, err = uuid.Parse(tenantStr)
	if err != nil {
		return uuid.Nil, uuid.Nil, "", apperr.ErrUnauthorized
	}
	principal, ok := authz.FromContext(ctx)
	if !ok || principal.UserID == "" {
		return uuid.Nil, uuid.Nil, "", apperr.ErrUnauthorized
	}
	userID, err = uuid.Parse(principal.UserID)
	if err != nil {
		return uuid.Nil, uuid.Nil, "", apperr.ErrUnauthorized
	}
	return tenantID, userID, principal.RoleCode, nil
}

const selectColumns = `
	f.id, f.code, f.kind, f.title, f.description, f.status, COALESCE(f.resolution_note, ''),
	COALESCE(f.page_url, ''), COALESCE(f.page_title, ''), f.element, f.viewport, COALESCE(f.user_agent, ''),
	f.created_by, f.created_by_name, f.created_by_role, f.created_at, f.updated_at`

func scanFeedback(row pgx.Row) (*Feedback, error) {
	var f Feedback
	var element, viewport []byte
	if err := row.Scan(&f.ID, &f.Code, &f.Kind, &f.Title, &f.Description, &f.Status, &f.ResolutionNote,
		&f.PageURL, &f.PageTitle, &element, &viewport, &f.UserAgent,
		&f.CreatedBy, &f.CreatedByName, &f.CreatedByRole, &f.CreatedAt, &f.UpdatedAt); err != nil {
		return nil, err
	}
	if len(element) > 0 {
		_ = json.Unmarshal(element, &f.Element)
	}
	if len(viewport) > 0 {
		_ = json.Unmarshal(viewport, &f.Viewport)
	}
	return &f, nil
}

// Create lưu một góp ý mới do chính người đang đăng nhập gửi.
func (s *Service) Create(ctx context.Context, req CreateRequest) (*Feedback, error) {
	tenantID, userID, role, err := tenantAndActor(ctx)
	if err != nil {
		return nil, err
	}

	req.Title = strings.TrimSpace(req.Title)
	req.Description = strings.TrimSpace(req.Description)
	if !validKinds[req.Kind] {
		return nil, fmt.Errorf("%w: loại góp ý không hợp lệ", apperr.ErrInvalidInput)
	}
	if req.Title == "" || utf8.RuneCountInString(req.Title) > maxTitleLen {
		return nil, fmt.Errorf("%w: tiêu đề bắt buộc và tối đa %d ký tự", apperr.ErrInvalidInput, maxTitleLen)
	}
	if req.Description == "" || utf8.RuneCountInString(req.Description) > maxDescriptionLen {
		return nil, fmt.Errorf("%w: nội dung bắt buộc và tối đa %d ký tự", apperr.ErrInvalidInput, maxDescriptionLen)
	}

	elementJSON, err := marshalLimited(req.Element)
	if err != nil {
		return nil, err
	}
	viewportJSON, err := marshalLimited(req.Viewport)
	if err != nil {
		return nil, err
	}

	var authorName string
	if err := s.pool.QueryRow(ctx, `SELECT full_name FROM station.app_user WHERE tenant_id = $1 AND id = $2`, tenantID, userID).Scan(&authorName); err != nil {
		return nil, fmt.Errorf("find author: %w", err)
	}

	row := s.pool.QueryRow(ctx, `
		INSERT INTO station.feedback AS f (tenant_id, code, kind, title, description, page_url, page_title, element, viewport, user_agent,
		                                   created_by, created_by_name, created_by_role)
		VALUES ($1, station.next_code($1, 'GY'), $2, $3, $4, NULLIF($5, ''), NULLIF($6, ''), $7, $8, NULLIF($9, ''), $10, $11, $12)
		RETURNING `+selectColumns,
		tenantID, req.Kind, req.Title, req.Description, truncate(req.PageURL, 500), truncate(req.PageTitle, 200),
		elementJSON, viewportJSON, truncate(req.UserAgent, 300), userID, authorName, role)
	f, err := scanFeedback(row)
	if err != nil {
		return nil, fmt.Errorf("insert feedback: %w", err)
	}

	id, _ := uuid.Parse(f.ID)
	_ = audit.Record(ctx, s.pool, audit.Entry{
		Action: audit.ActionCreate, EntityType: "feedback", EntityID: &id, EntityCode: f.Code,
		NewData: map[string]any{"kind": f.Kind, "title": f.Title},
	})
	return f, nil
}

// List trả danh sách góp ý (mới nhất trước) kèm số lượng theo từng trạng thái.
func (s *Service) List(ctx context.Context, q ListQuery) (*ListResult, error) {
	tenantID, _, _, err := tenantAndActor(ctx)
	if err != nil {
		return nil, err
	}
	if q.Page < 1 {
		q.Page = 1
	}
	if q.PageSize < 1 || q.PageSize > 100 {
		q.PageSize = 20
	}

	where := []string{"f.tenant_id = $1"}
	args := []any{tenantID}
	if q.Kind != "" {
		args = append(args, q.Kind)
		where = append(where, fmt.Sprintf("f.kind = $%d", len(args)))
	}
	if q.Search != "" {
		args = append(args, "%"+q.Search+"%")
		n := len(args)
		where = append(where, fmt.Sprintf("(f.code ILIKE $%[1]d OR f.title ILIKE $%[1]d OR f.description ILIKE $%[1]d OR f.created_by_name ILIKE $%[1]d)", n))
	}
	// Số lượng theo trạng thái không bị lọc theo trạng thái để các thẻ tổng quan luôn đủ.
	countsWhere := strings.Join(where, " AND ")
	countsArgs := append([]any(nil), args...)
	if q.Status != "" {
		args = append(args, q.Status)
		where = append(where, fmt.Sprintf("f.status = $%d", len(args)))
	}
	whereClause := strings.Join(where, " AND ")

	res := &ListResult{Page: q.Page, PageSize: q.PageSize, Items: make([]Feedback, 0), StatusCounts: map[string]int{}}
	if err := s.pool.QueryRow(ctx, "SELECT COUNT(*) FROM station.feedback f WHERE "+whereClause, args...).Scan(&res.Total); err != nil {
		return nil, fmt.Errorf("count feedback: %w", err)
	}

	rows, err := s.pool.Query(ctx, "SELECT "+selectColumns+" FROM station.feedback f WHERE "+whereClause+
		fmt.Sprintf(" ORDER BY f.created_at DESC LIMIT $%d OFFSET $%d", len(args)+1, len(args)+2),
		append(args, q.PageSize, (q.Page-1)*q.PageSize)...)
	if err != nil {
		return nil, fmt.Errorf("list feedback: %w", err)
	}
	defer rows.Close()
	for rows.Next() {
		f, err := scanFeedback(rows)
		if err != nil {
			return nil, fmt.Errorf("scan feedback: %w", err)
		}
		res.Items = append(res.Items, *f)
	}

	countRows, err := s.pool.Query(ctx, "SELECT f.status, COUNT(*) FROM station.feedback f WHERE "+countsWhere+" GROUP BY f.status", countsArgs...)
	if err != nil {
		return nil, fmt.Errorf("count by status: %w", err)
	}
	defer countRows.Close()
	for countRows.Next() {
		var status string
		var n int
		if err := countRows.Scan(&status, &n); err != nil {
			return nil, err
		}
		res.StatusCounts[status] = n
	}
	return res, nil
}

// Get trả một góp ý đầy đủ.
func (s *Service) Get(ctx context.Context, id string) (*Feedback, error) {
	tenantID, _, _, err := tenantAndActor(ctx)
	if err != nil {
		return nil, err
	}
	f, err := scanFeedback(s.pool.QueryRow(ctx, "SELECT "+selectColumns+" FROM station.feedback f WHERE f.tenant_id = $1 AND f.id = $2", tenantID, id))
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, apperr.ErrNotFound
	}
	if err != nil {
		return nil, fmt.Errorf("get feedback: %w", err)
	}
	return f, nil
}

// UpdateStatus đổi trạng thái; từ chối thì bắt buộc có lý do.
func (s *Service) UpdateStatus(ctx context.Context, id string, req UpdateStatusRequest) (*Feedback, error) {
	tenantID, userID, _, err := tenantAndActor(ctx)
	if err != nil {
		return nil, err
	}
	if !validStatuses[req.Status] {
		return nil, fmt.Errorf("%w: trạng thái không hợp lệ", apperr.ErrInvalidInput)
	}
	note := ""
	if req.ResolutionNote != nil {
		note = strings.TrimSpace(*req.ResolutionNote)
	}
	if req.Status == StatusRejected && note == "" {
		return nil, fmt.Errorf("%w: cần nêu lý do khi từ chối góp ý", apperr.ErrInvalidInput)
	}

	var oldStatus string
	err = s.pool.QueryRow(ctx, `SELECT status FROM station.feedback WHERE tenant_id = $1 AND id = $2`, tenantID, id).Scan(&oldStatus)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, apperr.ErrNotFound
	}
	if err != nil {
		return nil, fmt.Errorf("find feedback: %w", err)
	}

	_, err = s.pool.Exec(ctx, `
		UPDATE station.feedback
		   SET status = $3, resolution_note = CASE WHEN $4 = '' THEN resolution_note ELSE $4 END, updated_by = $5, updated_at = now()
		 WHERE tenant_id = $1 AND id = $2`, tenantID, id, req.Status, note, userID)
	if err != nil {
		return nil, fmt.Errorf("update feedback: %w", err)
	}

	f, err := s.Get(ctx, id)
	if err != nil {
		return nil, err
	}
	fid, _ := uuid.Parse(f.ID)
	_ = audit.Record(ctx, s.pool, audit.Entry{
		Action: audit.ActionUpdate, EntityType: "feedback", EntityID: &fid, EntityCode: f.Code,
		OldData: map[string]any{"status": oldStatus}, NewData: map[string]any{"status": f.Status, "note": note},
	})
	return f, nil
}

// Delete xóa hẳn một góp ý.
func (s *Service) Delete(ctx context.Context, id string) error {
	f, err := s.Get(ctx, id)
	if err != nil {
		return err
	}
	tenantID, _, _, err := tenantAndActor(ctx)
	if err != nil {
		return err
	}
	if _, err := s.pool.Exec(ctx, `DELETE FROM station.feedback WHERE tenant_id = $1 AND id = $2`, tenantID, id); err != nil {
		return fmt.Errorf("delete feedback: %w", err)
	}
	fid, _ := uuid.Parse(f.ID)
	_ = audit.Record(ctx, s.pool, audit.Entry{Action: audit.ActionDelete, EntityType: "feedback", EntityID: &fid, EntityCode: f.Code})
	return nil
}

func marshalLimited(v map[string]any) ([]byte, error) {
	if v == nil {
		return nil, nil
	}
	data, err := json.Marshal(v)
	if err != nil {
		return nil, fmt.Errorf("%w: dữ liệu đính kèm không hợp lệ", apperr.ErrInvalidInput)
	}
	if len(data) > maxElementBytes {
		return nil, fmt.Errorf("%w: dữ liệu phần tử được chọn quá lớn", apperr.ErrInvalidInput)
	}
	return data, nil
}

func truncate(s string, max int) string {
	if utf8.RuneCountInString(s) <= max {
		return s
	}
	return string([]rune(s)[:max])
}
