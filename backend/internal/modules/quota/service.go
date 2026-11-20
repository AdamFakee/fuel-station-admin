package quota

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

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

// ListRules retrieves a paginated list of quota rules with target information.
func (s *Service) ListRules(ctx context.Context, status, q, targetType string, page, pageSize int) ([]QuotaRuleListItem, int, error) {
	tenantID, ok := middleware.TenantIDFromContext(ctx)
	if !ok || tenantID == "" {
		return nil, 0, apperr.ErrUnauthorized
	}

	if s.pool == nil {
		return []QuotaRuleListItem{}, 0, nil
	}

	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 100 {
		pageSize = 20
	}
	offset := (page - 1) * pageSize

	baseQuery := `
		FROM station.quota_rule qr
		JOIN station.vehicle v ON v.id = qr.vehicle_id AND v.tenant_id = qr.tenant_id
		WHERE qr.tenant_id = $1
	`
	args := []any{tenantID}
	argIdx := 2

	if status != "" {
		baseQuery += fmt.Sprintf(" AND qr.status = $%d", argIdx)
		args = append(args, status)
		argIdx++
	}

	if q = strings.TrimSpace(q); q != "" {
		baseQuery += fmt.Sprintf(" AND (qr.code ILIKE $%d OR v.plate ILIKE $%d OR v.code ILIKE $%d)", argIdx, argIdx, argIdx)
		args = append(args, "%"+q+"%")
		argIdx++
	}

	// Count total
	countQuery := "SELECT count(*) " + baseQuery
	var total int
	if err := s.pool.QueryRow(ctx, countQuery, args...).Scan(&total); err != nil {
		return nil, 0, fmt.Errorf("count quota rules: %w", err)
	}

	// Query page items
	selectQuery := `
		SELECT qr.id, qr.tenant_id, qr.code,
		       qr.vehicle_id, v.code, v.plate,
		       qr.period, qr.max_volume_ml, qr.min_interval_minutes,
		       qr.effective_from::text, qr.effective_to::text, qr.status,
		       qr.created_by, qr.created_at, qr.updated_at
	` + baseQuery + fmt.Sprintf(" ORDER BY qr.created_at DESC LIMIT $%d OFFSET $%d", argIdx, argIdx+1)
	args = append(args, pageSize, offset)

	rows, err := s.pool.Query(ctx, selectQuery, args...)
	if err != nil {
		return nil, 0, fmt.Errorf("query quota rules: %w", err)
	}
	defer rows.Close()

	items := make([]QuotaRuleListItem, 0)
	for rows.Next() {
		var (
			item          QuotaRuleListItem
			vehicleID     uuid.UUID
			vCode, vPlate string
			effToStr      *string
			createdByUUID *uuid.UUID
		)

		err := rows.Scan(
			&item.ID, &item.TenantID, &item.Code,
			&vehicleID, &vCode, &vPlate,
			&item.Period, &item.MaxVolumeML, &item.MinIntervalMinutes,
			&item.EffectiveFrom, &effToStr, &item.Status,
			&createdByUUID, &item.CreatedAt, &item.UpdatedAt,
		)
		if err != nil {
			return nil, 0, fmt.Errorf("scan quota rule: %w", err)
		}

		item.EffectiveTo = effToStr
		item.MaxVolumeLiters = float64(item.MaxVolumeML) / 1000.0
		if createdByUUID != nil {
			s := createdByUUID.String()
			item.CreatedBy = &s
		}

		item.TargetType = "vehicle"
		item.TargetID = vehicleID.String()
		item.TargetName = vPlate
		item.TargetCode = vCode

		items = append(items, item)
	}

	return items, total, nil
}

// GetRule returns detail of a specific quota rule.
func (s *Service) GetRule(ctx context.Context, id string) (*QuotaRuleListItem, error) {
	tenantID, ok := middleware.TenantIDFromContext(ctx)
	if !ok || tenantID == "" {
		return nil, apperr.ErrUnauthorized
	}

	ruleID, err := uuid.Parse(id)
	if err != nil {
		return nil, apperr.ErrInvalidInput
	}

	query := `
		SELECT qr.id, qr.tenant_id, qr.code,
		       qr.vehicle_id, v.code, v.plate,
		       qr.period, qr.max_volume_ml, qr.min_interval_minutes,
		       qr.effective_from::text, qr.effective_to::text, qr.status,
		       qr.created_by, qr.created_at, qr.updated_at
		FROM station.quota_rule qr
		JOIN station.vehicle v ON v.id = qr.vehicle_id AND v.tenant_id = qr.tenant_id
		WHERE qr.id = $1 AND qr.tenant_id = $2
	`

	var (
		item          QuotaRuleListItem
		vehicleID     uuid.UUID
		vCode, vPlate string
		effToStr      *string
		createdByUUID *uuid.UUID
	)

	err = s.pool.QueryRow(ctx, query, ruleID, tenantID).Scan(
		&item.ID, &item.TenantID, &item.Code,
		&vehicleID, &vCode, &vPlate,
		&item.Period, &item.MaxVolumeML, &item.MinIntervalMinutes,
		&item.EffectiveFrom, &effToStr, &item.Status,
		&createdByUUID, &item.CreatedAt, &item.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, apperr.ErrNotFound
		}
		return nil, fmt.Errorf("get quota rule: %w", err)
	}

	item.EffectiveTo = effToStr
	item.MaxVolumeLiters = float64(item.MaxVolumeML) / 1000.0
	if createdByUUID != nil {
		s := createdByUUID.String()
		item.CreatedBy = &s
	}

	item.TargetType = "vehicle"
	item.TargetID = vehicleID.String()
	item.TargetName = vPlate
	item.TargetCode = vCode

	return &item, nil
}

// CreateRule inserts a new quota rule.
func (s *Service) CreateRule(ctx context.Context, req CreateQuotaRuleRequest) (*QuotaRuleListItem, error) {
	tenantIDStr, ok := middleware.TenantIDFromContext(ctx)
	if !ok || tenantIDStr == "" {
		return nil, apperr.ErrUnauthorized
	}
	tenantID, err := uuid.Parse(tenantIDStr)
	if err != nil {
		return nil, apperr.ErrInvalidInput
	}

	targetID, err := uuid.Parse(req.TargetID)
	if err != nil {
		return nil, fmt.Errorf("%w: target_id không hợp lệ", apperr.ErrInvalidInput)
	}

	if req.MaxVolumeLiters <= 0 {
		return nil, fmt.Errorf("%w: định mức lít phải lớn hơn 0", apperr.ErrInvalidInput)
	}
	maxVolumeML := int64(req.MaxVolumeLiters * 1000.0)

	switch req.Period {
	case "per_dispense", "day", "week", "month":
	default:
		return nil, fmt.Errorf("%w: chu kỳ không hợp lệ (per_dispense, day, week, month)", apperr.ErrInvalidInput)
	}

	if req.EffectiveFrom == "" {
		req.EffectiveFrom = time.Now().Format("2006-01-02")
	}

	// Generate code if empty
	code := strings.TrimSpace(req.Code)
	if code == "" {
		var generatedCode string
		err := s.pool.QueryRow(ctx, "SELECT station.next_code($1, 'DM')", tenantID).Scan(&generatedCode)
		if err != nil {
			code = fmt.Sprintf("DM-%d-%04d", time.Now().Year(), time.Now().Unix()%10000)
		} else {
			code = generatedCode
		}
	}

	// Định mức chỉ áp theo xe (không còn nhóm xe hay tuyến đường).
	if req.TargetType != "" && req.TargetType != "vehicle" {
		return nil, fmt.Errorf("%w: định mức chỉ áp theo xe", apperr.ErrInvalidInput)
	}
	vehicleID := targetID

	var createdBy *uuid.UUID
	if p, ok := authz.FromContext(ctx); ok && p.UserID != "" {
		if uID, err := uuid.Parse(p.UserID); err == nil {
			createdBy = &uID
		}
	}

	ruleID := uuid.New()
	insertQuery := `
		INSERT INTO station.quota_rule (
			id, tenant_id, code, vehicle_id,
			period, max_volume_ml, min_interval_minutes, effective_from, effective_to,
			status, created_by
		) VALUES (
			$1, $2, $3, $4,
			$5, $6, $7, $8::date, $9::date,
			'active', $10
		)
	`

	_, err = s.pool.Exec(ctx, insertQuery,
		ruleID, tenantID, code, vehicleID,
		req.Period, maxVolumeML, req.MinIntervalMinutes, req.EffectiveFrom, req.EffectiveTo,
		createdBy,
	)
	if err != nil {
		return nil, fmt.Errorf("insert quota rule: %w", err)
	}

	// Record Audit Log
	_ = audit.Record(ctx, s.pool, audit.Entry{
		Action:     audit.ActionCreate,
		EntityType: "quota_rule",
		EntityID:   &ruleID,
		EntityCode: code,
		NewData: map[string]any{
			"code":              code,
			"target_type":       "vehicle",
			"target_id":         targetID.String(),
			"period":            req.Period,
			"max_volume_liters": req.MaxVolumeLiters,
			"min_interval":      req.MinIntervalMinutes,
			"effective_from":    req.EffectiveFrom,
			"effective_to":      req.EffectiveTo,
		},
	})

	return s.GetRule(ctx, ruleID.String())
}

// UpdateRule updates volume, interval, or expiration of an active rule.
func (s *Service) UpdateRule(ctx context.Context, id string, req UpdateQuotaRuleRequest) (*QuotaRuleListItem, error) {
	tenantID, ok := middleware.TenantIDFromContext(ctx)
	if !ok || tenantID == "" {
		return nil, apperr.ErrUnauthorized
	}

	ruleID, err := uuid.Parse(id)
	if err != nil {
		return nil, apperr.ErrInvalidInput
	}

	if req.MaxVolumeLiters <= 0 {
		return nil, fmt.Errorf("%w: định mức lít phải lớn hơn 0", apperr.ErrInvalidInput)
	}
	maxVolumeML := int64(req.MaxVolumeLiters * 1000.0)

	existing, err := s.GetRule(ctx, id)
	if err != nil {
		return nil, err
	}
	if existing.Status == "cancelled" {
		return nil, fmt.Errorf("%w: không thể sửa quy tắc đã bị hủy", apperr.ErrConflict)
	}

	updateQuery := `
		UPDATE station.quota_rule
		SET max_volume_ml = $1, min_interval_minutes = $2, effective_to = $3::date
		WHERE id = $4 AND tenant_id = $5
	`

	_, err = s.pool.Exec(ctx, updateQuery, maxVolumeML, req.MinIntervalMinutes, req.EffectiveTo, ruleID, tenantID)
	if err != nil {
		return nil, fmt.Errorf("update quota rule: %w", err)
	}

	// Record Audit Log
	_ = audit.Record(ctx, s.pool, audit.Entry{
		Action:     audit.ActionUpdate,
		EntityType: "quota_rule",
		EntityID:   &ruleID,
		EntityCode: existing.Code,
		OldData: map[string]any{
			"max_volume_liters": existing.MaxVolumeLiters,
			"min_interval":      existing.MinIntervalMinutes,
			"effective_to":      existing.EffectiveTo,
		},
		NewData: map[string]any{
			"max_volume_liters": req.MaxVolumeLiters,
			"min_interval":      req.MinIntervalMinutes,
			"effective_to":      req.EffectiveTo,
		},
	})

	return s.GetRule(ctx, id)
}

// CancelRule sets rule status to cancelled.
func (s *Service) CancelRule(ctx context.Context, id string) error {
	tenantID, ok := middleware.TenantIDFromContext(ctx)
	if !ok || tenantID == "" {
		return apperr.ErrUnauthorized
	}

	ruleID, err := uuid.Parse(id)
	if err != nil {
		return apperr.ErrInvalidInput
	}

	existing, err := s.GetRule(ctx, id)
	if err != nil {
		return err
	}

	updateQuery := `UPDATE station.quota_rule SET status = 'cancelled' WHERE id = $1 AND tenant_id = $2`
	_, err = s.pool.Exec(ctx, updateQuery, ruleID, tenantID)
	if err != nil {
		return fmt.Errorf("cancel quota rule: %w", err)
	}

	_ = audit.Record(ctx, s.pool, audit.Entry{
		Action:     audit.ActionDelete,
		EntityType: "quota_rule",
		EntityID:   &ruleID,
		EntityCode: existing.Code,
		OldData:    map[string]any{"status": existing.Status},
		NewData:    map[string]any{"status": "cancelled"},
	})

	return nil
}

// ListExtras retrieves emergency quota grants.
func (s *Service) ListExtras(ctx context.Context, vehicleID string, page, pageSize int) ([]QuotaExtraListItem, int, error) {
	tenantID, ok := middleware.TenantIDFromContext(ctx)
	if !ok || tenantID == "" {
		return nil, 0, apperr.ErrUnauthorized
	}

	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 100 {
		pageSize = 20
	}
	offset := (page - 1) * pageSize

	baseQuery := `
		FROM station.quota_extra qe
		JOIN station.vehicle v ON v.id = qe.vehicle_id AND v.tenant_id = qe.tenant_id
		JOIN station.app_user u ON u.id = qe.granted_by AND u.tenant_id = qe.tenant_id
		WHERE qe.tenant_id = $1
	`
	args := []any{tenantID}
	argIdx := 2

	if vehicleID != "" {
		if vUUID, err := uuid.Parse(vehicleID); err == nil {
			baseQuery += fmt.Sprintf(" AND qe.vehicle_id = $%d", argIdx)
			args = append(args, vUUID)
			argIdx++
		}
	}

	countQuery := "SELECT count(*) " + baseQuery
	var total int
	if err := s.pool.QueryRow(ctx, countQuery, args...).Scan(&total); err != nil {
		return nil, 0, fmt.Errorf("count quota extras: %w", err)
	}

	selectQuery := `
		SELECT qe.id, qe.tenant_id, qe.vehicle_id, v.plate, v.code,
		       qe.extra_volume_ml, qe.valid_from, qe.valid_to,
		       qe.reason, qe.granted_by, u.full_name, qe.created_at
	` + baseQuery + fmt.Sprintf(" ORDER BY qe.created_at DESC LIMIT $%d OFFSET $%d", argIdx, argIdx+1)
	args = append(args, pageSize, offset)

	rows, err := s.pool.Query(ctx, selectQuery, args...)
	if err != nil {
		return nil, 0, fmt.Errorf("query quota extras: %w", err)
	}
	defer rows.Close()

	items := make([]QuotaExtraListItem, 0)
	for rows.Next() {
		var item QuotaExtraListItem
		err := rows.Scan(
			&item.ID, &item.TenantID, &item.VehicleID, &item.VehiclePlate, &item.VehicleCode,
			&item.ExtraVolumeML, &item.ValidFrom, &item.ValidTo,
			&item.Reason, &item.GrantedBy, &item.GrantedByName, &item.CreatedAt,
		)
		if err != nil {
			return nil, 0, fmt.Errorf("scan quota extra: %w", err)
		}
		item.ExtraVolumeLiters = float64(item.ExtraVolumeML) / 1000.0
		items = append(items, item)
	}

	return items, total, nil
}

// CreateExtra grants emergency extra quota to a vehicle.
func (s *Service) CreateExtra(ctx context.Context, req CreateQuotaExtraRequest) (*QuotaExtraListItem, error) {
	tenantIDStr, ok := middleware.TenantIDFromContext(ctx)
	if !ok || tenantIDStr == "" {
		return nil, apperr.ErrUnauthorized
	}
	tenantID, err := uuid.Parse(tenantIDStr)
	if err != nil {
		return nil, apperr.ErrInvalidInput
	}

	vehicleID, err := uuid.Parse(req.VehicleID)
	if err != nil {
		return nil, fmt.Errorf("%w: vehicle_id không hợp lệ", apperr.ErrInvalidInput)
	}

	if req.ExtraVolumeLiters <= 0 {
		return nil, fmt.Errorf("%w: số lít bổ sung phải lớn hơn 0", apperr.ErrInvalidInput)
	}
	extraVolumeML := int64(req.ExtraVolumeLiters * 1000.0)

	if req.ValidFrom.After(req.ValidTo) || req.ValidFrom.Equal(req.ValidTo) {
		return nil, fmt.Errorf("%w: thời gian hiệu lực không hợp lệ (valid_from phải nhỏ hơn valid_to)", apperr.ErrInvalidInput)
	}

	reason := strings.TrimSpace(req.Reason)
	if reason == "" {
		return nil, fmt.Errorf("%w: vui lòng nhập lý do cấp bổ sung", apperr.ErrInvalidInput)
	}

	var grantedBy uuid.UUID
	if p, ok := authz.FromContext(ctx); ok && p.UserID != "" {
		if uID, err := uuid.Parse(p.UserID); err == nil {
			grantedBy = uID
		}
	}
	if grantedBy == uuid.Nil {
		return nil, fmt.Errorf("%w: không xác định được người cấp bổ sung", apperr.ErrUnauthorized)
	}

	extraID := uuid.New()
	query := `
		INSERT INTO station.quota_extra (
			id, tenant_id, vehicle_id, extra_volume_ml, valid_from, valid_to, reason, granted_by
		) VALUES (
			$1, $2, $3, $4, $5, $6, $7, $8
		)
	`

	_, err = s.pool.Exec(ctx, query,
		extraID, tenantID, vehicleID, extraVolumeML, req.ValidFrom, req.ValidTo, reason, grantedBy,
	)
	if err != nil {
		return nil, fmt.Errorf("insert quota extra: %w", err)
	}

	_ = audit.Record(ctx, s.pool, audit.Entry{
		Action:     audit.ActionCreate,
		EntityType: "quota_extra",
		EntityID:   &extraID,
		NewData: map[string]any{
			"vehicle_id":          vehicleID.String(),
			"extra_volume_liters": req.ExtraVolumeLiters,
			"valid_from":          req.ValidFrom,
			"valid_to":            req.ValidTo,
			"reason":              reason,
		},
	})

	// Fetch created extra
	extras, _, err := s.ListExtras(ctx, vehicleID.String(), 1, 1)
	if err != nil || len(extras) == 0 {
		return nil, fmt.Errorf("retrieve created extra: %w", err)
	}

	return &extras[0], nil
}

// GetTargets lists selectable targets (vehicles).
func (s *Service) GetTargets(ctx context.Context) (*QuotaTargets, error) {
	tenantID, ok := middleware.TenantIDFromContext(ctx)
	if !ok || tenantID == "" {
		return nil, apperr.ErrUnauthorized
	}

	targets := &QuotaTargets{
		Vehicles: make([]TargetOption, 0),
	}

	if s.pool == nil {
		return targets, nil
	}

	// Vehicles
	vRows, err := s.pool.Query(ctx, `
		SELECT id, code, plate FROM station.vehicle
		WHERE tenant_id = $1 AND deleted_at IS NULL AND status = 'active'
		ORDER BY plate ASC
	`, tenantID)
	if err == nil {
		defer vRows.Close()
		for vRows.Next() {
			var opt TargetOption
			opt.Type = "vehicle"
			if err := vRows.Scan(&opt.ID, &opt.Code, &opt.Name); err == nil {
				targets.Vehicles = append(targets.Vehicles, opt)
			}
		}
	}

	return targets, nil
}
