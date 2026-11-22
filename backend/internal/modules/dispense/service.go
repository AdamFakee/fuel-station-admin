package dispense

import (
	"context"
	"errors"
	"fmt"
	"strings"

	"fuel-station-backend/internal/shared/apperr"
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

func getTenantAndPrincipal(ctx context.Context) (uuid.UUID, authz.Principal, error) {
	tenantIDStr, ok := middleware.TenantIDFromContext(ctx)
	if !ok || tenantIDStr == "" {
		return uuid.Nil, authz.Principal{}, fmt.Errorf("%w: missing tenant_id", apperr.ErrUnauthorized)
	}
	tID, err := uuid.Parse(tenantIDStr)
	if err != nil {
		return uuid.Nil, authz.Principal{}, fmt.Errorf("%w: invalid tenant_id", apperr.ErrUnauthorized)
	}

	p, ok := authz.FromContext(ctx)
	if !ok {
		return tID, authz.Principal{}, nil
	}
	return tID, p, nil
}

func (s *Service) ListSessions(ctx context.Context, q SessionListQuery) (*PagedResponse[DispenseSessionListItem], error) {
	tenantID, _, err := getTenantAndPrincipal(ctx)
	if err != nil {
		return nil, err
	}

	if q.Page < 1 {
		q.Page = 1
	}
	if q.PageSize < 1 || q.PageSize > 100 {
		q.PageSize = 20
	}
	offset := (q.Page - 1) * q.PageSize

	whereClauses := []string{"s.tenant_id = $1"}
	args := []any{tenantID}
	argIdx := 2

	if q.BranchID != "" {
		if bUUID, err := uuid.Parse(q.BranchID); err == nil {
			whereClauses = append(whereClauses, fmt.Sprintf("s.branch_id = $%d", argIdx))
			args = append(args, bUUID)
			argIdx++
		}
	}

	if q.PumpID != "" {
		if pUUID, err := uuid.Parse(q.PumpID); err == nil {
			whereClauses = append(whereClauses, fmt.Sprintf("s.pump_id = $%d", argIdx))
			args = append(args, pUUID)
			argIdx++
		}
	}

	if q.VehicleID != "" {
		if vUUID, err := uuid.Parse(q.VehicleID); err == nil {
			whereClauses = append(whereClauses, fmt.Sprintf("s.vehicle_id = $%d", argIdx))
			args = append(args, vUUID)
			argIdx++
		}
	}

	if q.DriverID != "" {
		if dUUID, err := uuid.Parse(q.DriverID); err == nil {
			whereClauses = append(whereClauses, fmt.Sprintf("s.driver_id = $%d", argIdx))
			args = append(args, dUUID)
			argIdx++
		}
	}

	if q.Status != "" && q.Status != "all" {
		whereClauses = append(whereClauses, fmt.Sprintf("s.status = $%d", argIdx))
		args = append(args, q.Status)
		argIdx++
	}

	if q.FromDate != nil {
		whereClauses = append(whereClauses, fmt.Sprintf("COALESCE(s.finished_at, s.started_at, s.received_at) >= $%d", argIdx))
		args = append(args, *q.FromDate)
		argIdx++
	}

	if q.ToDate != nil {
		whereClauses = append(whereClauses, fmt.Sprintf("COALESCE(s.finished_at, s.started_at, s.received_at) <= $%d", argIdx))
		args = append(args, *q.ToDate)
		argIdx++
	}

	if q.Search != "" {
		pattern := "%" + strings.TrimSpace(q.Search) + "%"
		whereClauses = append(whereClauses, fmt.Sprintf(
			"(s.code ILIKE $%d OR s.vehicle_plate ILIKE $%d OR s.vehicle_code ILIKE $%d OR s.driver_name ILIKE $%d OR s.driver_code ILIKE $%d OR s.pump_name ILIKE $%d)",
			argIdx, argIdx, argIdx, argIdx, argIdx, argIdx,
		))
		args = append(args, pattern)
		argIdx++
	}

	whereSQL := strings.Join(whereClauses, " AND ")

	// Count total
	countQuery := fmt.Sprintf("SELECT COUNT(*) FROM station.dispense_session s WHERE %s", whereSQL)
	var total int
	if err := s.pool.QueryRow(ctx, countQuery, args...).Scan(&total); err != nil {
		return nil, fmt.Errorf("count sessions: %w", err)
	}

	// Fetch page
	listQuery := fmt.Sprintf(`
		SELECT 
			s.id, s.code, s.edge_ref, s.branch_id, b.name AS branch_name,
			s.pump_id, s.pump_name, s.tank_id, t.name AS tank_name,
			ft.name AS fuel_type_name,
			s.vehicle_id, s.vehicle_plate, s.vehicle_code,
			s.driver_id, s.driver_name, s.driver_code,
			s.limit_ml, s.dispensed_ml, s.pump_total_ml,
			s.sensor_serial, s.sale_seq, s.status, s.edge_state,
			s.started_at, s.finished_at, s.received_at, s.created_at
		FROM station.dispense_session s
		JOIN station.branch b ON b.id = s.branch_id AND b.tenant_id = s.tenant_id
		LEFT JOIN station.tank t ON t.id = s.tank_id AND t.tenant_id = s.tenant_id
		LEFT JOIN station.fuel_type ft ON ft.id = s.fuel_type_id AND ft.tenant_id = s.tenant_id
		WHERE %s
		ORDER BY COALESCE(s.finished_at, s.started_at, s.received_at) DESC
		LIMIT $%d OFFSET $%d
	`, whereSQL, argIdx, argIdx+1)

	args = append(args, q.PageSize, offset)

	rows, err := s.pool.Query(ctx, listQuery, args...)
	if err != nil {
		return nil, fmt.Errorf("list sessions: %w", err)
	}
	defer rows.Close()

	var items []DispenseSessionListItem
	for rows.Next() {
		var (
			item        DispenseSessionListItem
			sUUID       uuid.UUID
			branchUUID  uuid.UUID
			pumpUUID    uuid.UUID
			tankUUID    *uuid.UUID
			vehicleUUID *uuid.UUID
			driverUUID  *uuid.UUID
		)

		err := rows.Scan(
			&sUUID, &item.Code, &item.EdgeRef, &branchUUID, &item.BranchName,
			&pumpUUID, &item.PumpName, &tankUUID, &item.TankName,
			&item.FuelTypeName,
			&vehicleUUID, &item.VehiclePlate, &item.VehicleCode,
			&driverUUID, &item.DriverName, &item.DriverCode,
			&item.LimitMl, &item.DispensedMl, &item.PumpTotalMl,
			&item.SensorSerial, &item.SaleSeq, &item.Status, &item.EdgeState,
			&item.StartedAt, &item.FinishedAt, &item.ReceivedAt, &item.CreatedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("scan session: %w", err)
		}

		item.ID = sUUID.String()
		item.BranchID = branchUUID.String()
		item.PumpID = pumpUUID.String()
		if tankUUID != nil {
			tStr := tankUUID.String()
			item.TankID = &tStr
		}
		if vehicleUUID != nil {
			vStr := vehicleUUID.String()
			item.VehicleID = &vStr
		}
		if driverUUID != nil {
			dStr := driverUUID.String()
			item.DriverID = &dStr
		}

		// Convert milliliters to liters
		item.DispensedLiters = float64(item.DispensedMl) / 1000.0
		if item.LimitMl != nil {
			l := float64(*item.LimitMl) / 1000.0
			item.LimitLiters = &l
		}
		if item.PumpTotalMl != nil {
			pt := float64(*item.PumpTotalMl) / 1000.0
			item.PumpTotalLiters = &pt
		}

		items = append(items, item)
	}

	totalPages := (total + q.PageSize - 1) / q.PageSize
	return &PagedResponse[DispenseSessionListItem]{
		Items:      items,
		Total:      total,
		Page:       q.Page,
		PageSize:   q.PageSize,
		TotalPages: totalPages,
	}, nil
}

func (s *Service) GetSession(ctx context.Context, idStr string) (*DispenseSessionDetail, error) {
	tenantID, _, err := getTenantAndPrincipal(ctx)
	if err != nil {
		return nil, err
	}

	sUUID, err := uuid.Parse(idStr)
	if err != nil {
		return nil, fmt.Errorf("%w: invalid session ID", apperr.ErrInvalidInput)
	}

	var (
		item        DispenseSessionListItem
		branchUUID  uuid.UUID
		pumpUUID    uuid.UUID
		tankUUID    *uuid.UUID
		vehicleUUID *uuid.UUID
		driverUUID  *uuid.UUID
		rawHex      *string
	)

	query := `
		SELECT 
			s.id, s.code, s.edge_ref, s.branch_id, b.name AS branch_name,
			s.pump_id, s.pump_name, s.tank_id, t.name AS tank_name,
			ft.name AS fuel_type_name,
			s.vehicle_id, s.vehicle_plate, s.vehicle_code,
			s.driver_id, s.driver_name, s.driver_code,
			s.limit_ml, s.dispensed_ml, s.pump_total_ml,
			s.sensor_serial, s.sale_seq, s.raw_hex, s.status, s.edge_state,
			s.started_at, s.finished_at, s.received_at, s.created_at
		FROM station.dispense_session s
		JOIN station.branch b ON b.id = s.branch_id AND b.tenant_id = s.tenant_id
		LEFT JOIN station.tank t ON t.id = s.tank_id AND t.tenant_id = s.tenant_id
		LEFT JOIN station.fuel_type ft ON ft.id = s.fuel_type_id AND ft.tenant_id = s.tenant_id
		WHERE s.tenant_id = $1 AND s.id = $2
	`

	err = s.pool.QueryRow(ctx, query, tenantID, sUUID).Scan(
		&sUUID, &item.Code, &item.EdgeRef, &branchUUID, &item.BranchName,
		&pumpUUID, &item.PumpName, &tankUUID, &item.TankName,
		&item.FuelTypeName,
		&vehicleUUID, &item.VehiclePlate, &item.VehicleCode,
		&driverUUID, &item.DriverName, &item.DriverCode,
		&item.LimitMl, &item.DispensedMl, &item.PumpTotalMl,
		&item.SensorSerial, &item.SaleSeq, &rawHex, &item.Status, &item.EdgeState,
		&item.StartedAt, &item.FinishedAt, &item.ReceivedAt, &item.CreatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, apperr.ErrNotFound
		}
		return nil, fmt.Errorf("query session: %w", err)
	}

	item.ID = sUUID.String()
	item.BranchID = branchUUID.String()
	item.PumpID = pumpUUID.String()
	if tankUUID != nil {
		tStr := tankUUID.String()
		item.TankID = &tStr
	}
	if vehicleUUID != nil {
		vStr := vehicleUUID.String()
		item.VehicleID = &vStr
	}
	if driverUUID != nil {
		dStr := driverUUID.String()
		item.DriverID = &dStr
	}

	item.DispensedLiters = float64(item.DispensedMl) / 1000.0
	if item.LimitMl != nil {
		l := float64(*item.LimitMl) / 1000.0
		item.LimitLiters = &l
	}
	if item.PumpTotalMl != nil {
		pt := float64(*item.PumpTotalMl) / 1000.0
		item.PumpTotalLiters = &pt
	}

	// Fetch Timeline Events
	tRows, err := s.pool.Query(ctx, `
		SELECT from_state, to_state, occurred_at
		FROM station.dispense_session_event
		WHERE tenant_id = $1 AND session_id = $2
		ORDER BY occurred_at ASC
	`, tenantID, sUUID)
	if err != nil {
		return nil, fmt.Errorf("query timeline: %w", err)
	}
	defer tRows.Close()

	timeline := []SessionTimelineEvent{}
	for tRows.Next() {
		var te SessionTimelineEvent
		if err := tRows.Scan(&te.FromState, &te.ToState, &te.OccurredAt); err != nil {
			return nil, err
		}
		timeline = append(timeline, te)
	}

	// Fetch Access Events for this session
	aRows, err := s.pool.Query(ctx, `
		SELECT id, kind, method, external_id, party_name, decision, reason, occurred_at
		FROM station.access_event
		WHERE tenant_id = $1 AND session_id = $2
		ORDER BY occurred_at ASC
	`, tenantID, sUUID)
	if err != nil {
		return nil, fmt.Errorf("query access events: %w", err)
	}
	defer aRows.Close()

	accessEvents := []SessionAccessEvent{}
	for aRows.Next() {
		var ae SessionAccessEvent
		if err := aRows.Scan(&ae.ID, &ae.Kind, &ae.Method, &ae.ExternalID, &ae.PartyName, &ae.Decision, &ae.Reason, &ae.OccurredAt); err != nil {
			return nil, err
		}
		accessEvents = append(accessEvents, ae)
	}

	return &DispenseSessionDetail{
		DispenseSessionListItem: item,
		RawHex:                  rawHex,
		Timeline:                timeline,
		AccessEvents:            accessEvents,
	}, nil
}

func (s *Service) ListAccessEvents(ctx context.Context, q AccessEventListQuery) (*PagedResponse[AccessEventListItem], error) {
	tenantID, _, err := getTenantAndPrincipal(ctx)
	if err != nil {
		return nil, err
	}

	if q.Page < 1 {
		q.Page = 1
	}
	if q.PageSize < 1 || q.PageSize > 100 {
		q.PageSize = 20
	}
	offset := (q.Page - 1) * q.PageSize

	whereClauses := []string{"ae.tenant_id = $1"}
	args := []any{tenantID}
	argIdx := 2

	if q.BranchID != "" {
		if bUUID, err := uuid.Parse(q.BranchID); err == nil {
			whereClauses = append(whereClauses, fmt.Sprintf("ae.branch_id = $%d", argIdx))
			args = append(args, bUUID)
			argIdx++
		}
	}

	if q.Decision != "" && q.Decision != "all" {
		whereClauses = append(whereClauses, fmt.Sprintf("ae.decision = $%d", argIdx))
		args = append(args, q.Decision)
		argIdx++
	}

	if q.Method != "" && q.Method != "all" {
		whereClauses = append(whereClauses, fmt.Sprintf("ae.method = $%d", argIdx))
		args = append(args, q.Method)
		argIdx++
	}

	if q.FromDate != nil {
		whereClauses = append(whereClauses, fmt.Sprintf("ae.occurred_at >= $%d", argIdx))
		args = append(args, *q.FromDate)
		argIdx++
	}

	if q.ToDate != nil {
		whereClauses = append(whereClauses, fmt.Sprintf("ae.occurred_at <= $%d", argIdx))
		args = append(args, *q.ToDate)
		argIdx++
	}

	if q.Search != "" {
		pattern := "%" + strings.TrimSpace(q.Search) + "%"
		whereClauses = append(whereClauses, fmt.Sprintf(
			"(ae.external_id ILIKE $%d OR ae.party_name ILIKE $%d OR ae.reason ILIKE $%d)",
			argIdx, argIdx, argIdx,
		))
		args = append(args, pattern)
		argIdx++
	}

	whereSQL := strings.Join(whereClauses, " AND ")

	// Count
	countQuery := fmt.Sprintf("SELECT COUNT(*) FROM station.access_event ae WHERE %s", whereSQL)
	var total int
	if err := s.pool.QueryRow(ctx, countQuery, args...).Scan(&total); err != nil {
		return nil, fmt.Errorf("count access events: %w", err)
	}

	// Fetch
	listQuery := fmt.Sprintf(`
		SELECT 
			ae.id, ae.edge_ref, ae.branch_id, b.name AS branch_name,
			ae.occurred_at, ae.kind, ae.method, ae.external_id,
			v.plate AS vehicle_plate, d.full_name AS driver_name,
			ae.party_name, ae.decision, ae.reason,
			ae.session_id, ae.detail, ae.received_at
		FROM station.access_event ae
		JOIN station.branch b ON b.id = ae.branch_id AND b.tenant_id = ae.tenant_id
		LEFT JOIN station.vehicle v ON v.id = ae.vehicle_id AND v.tenant_id = ae.tenant_id
		LEFT JOIN station.driver d ON d.id = ae.driver_id AND d.tenant_id = ae.tenant_id
		WHERE %s
		ORDER BY ae.occurred_at DESC
		LIMIT $%d OFFSET $%d
	`, whereSQL, argIdx, argIdx+1)

	args = append(args, q.PageSize, offset)

	rows, err := s.pool.Query(ctx, listQuery, args...)
	if err != nil {
		return nil, fmt.Errorf("list access events: %w", err)
	}
	defer rows.Close()

	var items []AccessEventListItem
	for rows.Next() {
		var (
			item       AccessEventListItem
			branchUUID uuid.UUID
			sUUID      *uuid.UUID
		)

		err := rows.Scan(
			&item.ID, &item.EdgeRef, &branchUUID, &item.BranchName,
			&item.OccurredAt, &item.Kind, &item.Method, &item.ExternalID,
			&item.VehiclePlate, &item.DriverName,
			&item.PartyName, &item.Decision, &item.Reason,
			&sUUID, &item.Detail, &item.ReceivedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("scan access event: %w", err)
		}

		item.BranchID = branchUUID.String()
		if sUUID != nil {
			sStr := sUUID.String()
			item.SessionID = &sStr
		}

		items = append(items, item)
	}

	totalPages := (total + q.PageSize - 1) / q.PageSize
	return &PagedResponse[AccessEventListItem]{
		Items:      items,
		Total:      total,
		Page:       q.Page,
		PageSize:   q.PageSize,
		TotalPages: totalPages,
	}, nil
}

func (s *Service) GetSummary(ctx context.Context, branchIDStr string) (*DispenseSummary, error) {
	tenantID, _, err := getTenantAndPrincipal(ctx)
	if err != nil {
		return nil, err
	}

	whereClauses := []string{"tenant_id = $1"}
	args := []any{tenantID}
	argIdx := 2

	if branchIDStr != "" {
		if bUUID, err := uuid.Parse(branchIDStr); err == nil {
			whereClauses = append(whereClauses, fmt.Sprintf("branch_id = $%d", argIdx))
			args = append(args, bUUID)
		}
	}

	whereSQL := strings.Join(whereClauses, " AND ")

	query := fmt.Sprintf(`
		SELECT 
			COUNT(*),
			COUNT(*) FILTER (WHERE status = 'completed'),
			COUNT(*) FILTER (WHERE status = 'cancelled'),
			COUNT(*) FILTER (WHERE status = 'failed'),
			COALESCE(SUM(dispensed_ml), 0)
		FROM station.dispense_session
		WHERE %s
	`, whereSQL)

	var (
		summary DispenseSummary
		sumMl   int64
	)

	err = s.pool.QueryRow(ctx, query, args...).Scan(
		&summary.TotalSessions,
		&summary.CompletedSessions,
		&summary.CancelledSessions,
		&summary.FailedSessions,
		&sumMl,
	)
	if err != nil {
		return nil, fmt.Errorf("query session summary: %w", err)
	}

	summary.TotalDispensedLiters = float64(sumMl) / 1000.0

	// Count rejected auth attempts
	rejectQuery := fmt.Sprintf(`
		SELECT COUNT(*)
		FROM station.access_event
		WHERE %s AND decision = 'reject'
	`, whereSQL)

	_ = s.pool.QueryRow(ctx, rejectQuery, args...).Scan(&summary.RejectedAuthCount)

	return &summary, nil
}
