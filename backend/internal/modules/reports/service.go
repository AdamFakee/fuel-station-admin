package reports

import (
	"context"
	"fmt"
	"math"

	"fuel-station-backend/internal/shared/apperr"
	"fuel-station-backend/internal/shared/authz"
	"fuel-station-backend/internal/shared/middleware"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

type Service struct {
	pool *pgxpool.Pool
}

func NewService(pool *pgxpool.Pool) *Service {
	return &Service{pool: pool}
}

func getTenantUUID(ctx context.Context) (uuid.UUID, error) {
	if p, ok := authz.FromContext(ctx); ok && p.TenantID != "" {
		return uuid.Parse(p.TenantID)
	}
	if tenantIDStr, ok := middleware.TenantIDFromContext(ctx); ok && tenantIDStr != "" {
		return uuid.Parse(tenantIDStr)
	}
	return uuid.Nil, apperr.ErrUnauthorized
}

func mlToLiters(ml int64) float64 {
	return math.Round((float64(ml)/1000.0)*100) / 100
}

func kindToLabel(kind string) string {
	switch kind {
	case "opening":
		return "Tồn đầu kỳ"
	case "receipt":
		return "Nhập bể"
	case "dispense":
		return "Cấp phát"
	case "issue":
		return "Xuất khác"
	case "transfer_out":
		return "Điều chuyển xuất"
	case "transfer_in":
		return "Điều chuyển nhập"
	case "adjust":
		return "Điều chỉnh"
	default:
		return kind
	}
}

// ---------------------------------------------------------------------------------------------------
// 1. Nhập – Xuất – Tồn và Thẻ kho
// ---------------------------------------------------------------------------------------------------

func (s *Service) GetStockLedgerReport(ctx context.Context, q StockLedgerQuery) (*StockLedgerReportResponse, error) {
	tenantID, err := getTenantUUID(ctx)
	if err != nil {
		return nil, err
	}

	// 1. Fetch tank summaries
	summaryQuery := `
		SELECT t.id, t.code, t.name, f.name AS fuel_name, b.name AS branch_name, t.max_usable_capacity_ml,
		       -- Opening balance (last balance before from_date)
		       COALESCE((
		           SELECT l_prev.balance_after_ml
		             FROM station.stock_ledger l_prev
		            WHERE l_prev.tenant_id = $1
		              AND l_prev.tank_id = t.id
		              AND ($4::TIMESTAMPTZ IS NOT NULL AND l_prev.occurred_at < $4)
		            ORDER BY l_prev.seq DESC LIMIT 1
		       ), (
		           -- if no prior rows or from_date is null, check if opening row exists
		           SELECT l_open.balance_after_ml
		             FROM station.stock_ledger l_open
		            WHERE l_open.tenant_id = $1
		              AND l_open.tank_id = t.id
		              AND l_open.kind = 'opening'
		            LIMIT 1
		       ), 0) AS opening_ml,
		       -- Movements during period
		       COALESCE(SUM(CASE WHEN l.kind IN ('receipt', 'transfer_in') AND l.occurred_at >= COALESCE($4, '1970-01-01'::TIMESTAMPTZ) AND l.occurred_at <= COALESCE($5, '2099-12-31'::TIMESTAMPTZ) THEN l.delta_ml ELSE 0 END), 0) AS receipt_ml,
		       COALESCE(SUM(CASE WHEN l.kind = 'dispense' AND l.occurred_at >= COALESCE($4, '1970-01-01'::TIMESTAMPTZ) AND l.occurred_at <= COALESCE($5, '2099-12-31'::TIMESTAMPTZ) THEN -l.delta_ml ELSE 0 END), 0) AS dispense_ml,
		       COALESCE(SUM(CASE WHEN l.kind IN ('issue', 'transfer_out') AND l.occurred_at >= COALESCE($4, '1970-01-01'::TIMESTAMPTZ) AND l.occurred_at <= COALESCE($5, '2099-12-31'::TIMESTAMPTZ) THEN -l.delta_ml ELSE 0 END), 0) AS issue_ml,
		       COALESCE(SUM(CASE WHEN l.kind = 'adjust' AND l.occurred_at >= COALESCE($4, '1970-01-01'::TIMESTAMPTZ) AND l.occurred_at <= COALESCE($5, '2099-12-31'::TIMESTAMPTZ) THEN l.delta_ml ELSE 0 END), 0) AS adjust_ml,
		       -- Closing balance (latest balance up to to_date)
		       COALESCE((
		           SELECT l_close.balance_after_ml
		             FROM station.stock_ledger l_close
		            WHERE l_close.tenant_id = $1
		              AND l_close.tank_id = t.id
		              AND ($5::TIMESTAMPTZ IS NULL OR l_close.occurred_at <= $5)
		            ORDER BY l_close.seq DESC LIMIT 1
		       ), 0) AS closing_ml
		  FROM station.tank t
		  JOIN station.fuel_type f ON f.id = t.fuel_type_id AND f.tenant_id = t.tenant_id
		  JOIN station.branch b ON b.id = t.branch_id AND b.tenant_id = t.tenant_id
		  LEFT JOIN station.stock_ledger l ON l.tank_id = t.id AND l.tenant_id = t.tenant_id
		 WHERE t.tenant_id = $1
		   AND ($2::UUID IS NULL OR t.branch_id = $2)
		   AND ($6::UUID[] IS NULL OR t.branch_id = ANY($6))
		   AND ($3::UUID IS NULL OR t.id = $3)
		 GROUP BY t.id, t.code, t.name, f.name, b.name, t.max_usable_capacity_ml
		 ORDER BY b.name ASC, t.code ASC
	`

	rows, err := s.pool.Query(ctx, summaryQuery, tenantID, q.BranchID, q.TankID, q.FromDate, q.ToDate, authz.BranchScope(ctx))
	if err != nil {
		return nil, fmt.Errorf("failed to query stock ledger summary: %w", err)
	}
	defer rows.Close()

	var summaries []TankSummaryItem
	for rows.Next() {
		var item TankSummaryItem
		var capML, openML, recML, dispML, issML, adjML, closeML int64
		if err := rows.Scan(
			&item.TankID, &item.TankCode, &item.TankName, &item.FuelTypeName, &item.BranchName, &capML,
			&openML, &recML, &dispML, &issML, &adjML, &closeML,
		); err != nil {
			return nil, fmt.Errorf("failed to scan tank summary: %w", err)
		}
		item.CapacityLiters = mlToLiters(capML)
		item.OpeningLiters = mlToLiters(openML)
		item.ReceiptLiters = mlToLiters(recML)
		item.DispenseLiters = mlToLiters(dispML)
		item.IssueLiters = mlToLiters(issML)
		item.AdjustLiters = mlToLiters(adjML)
		item.ClosingLiters = mlToLiters(closeML)
		summaries = append(summaries, item)
	}

	// 2. Fetch detailed ledger transactions (phân trang, kèm tổng số dòng)
	page := q.Page
	if page < 1 {
		page = 1
	}
	pageSize := q.PageSize
	if pageSize < 1 || pageSize > 500 {
		pageSize = 50
	}

	var ledgerTotal int
	if err := s.pool.QueryRow(ctx, `
		SELECT COUNT(*)
		  FROM station.stock_ledger l
		  JOIN station.tank t ON t.id = l.tank_id AND t.tenant_id = l.tenant_id
		 WHERE l.tenant_id = $1
		   AND ($2::UUID IS NULL OR t.branch_id = $2)
		   AND ($6::UUID[] IS NULL OR t.branch_id = ANY($6))
		   AND ($3::UUID IS NULL OR l.tank_id = $3)
		   AND ($4::TIMESTAMPTZ IS NULL OR l.occurred_at >= $4)
		   AND ($5::TIMESTAMPTZ IS NULL OR l.occurred_at <= $5)
	`, tenantID, q.BranchID, q.TankID, q.FromDate, q.ToDate, authz.BranchScope(ctx)).Scan(&ledgerTotal); err != nil {
		return nil, fmt.Errorf("failed to count stock ledger lines: %w", err)
	}

	ledgerQuery := `
		SELECT l.id, l.tank_id, t.code, t.name, l.seq, l.occurred_at, l.kind,
		       l.delta_ml, l.balance_after_ml, l.ref_type,
		       COALESCE(sr.code, si.code, ds.code, l.ref_id::TEXT) AS ref_code,
		       l.note
		  FROM station.stock_ledger l
		  JOIN station.tank t ON t.id = l.tank_id AND t.tenant_id = l.tenant_id
		  LEFT JOIN station.stock_receipt sr ON sr.id = l.ref_id AND l.ref_type = 'stock_receipt'
		  LEFT JOIN station.stock_issue si ON si.id = l.ref_id AND l.ref_type = 'stock_issue'
		  LEFT JOIN station.dispense_session ds ON ds.id = l.ref_id AND l.ref_type = 'dispense_session'
		 WHERE l.tenant_id = $1
		   AND ($2::UUID IS NULL OR t.branch_id = $2)
		   AND ($6::UUID[] IS NULL OR t.branch_id = ANY($6))
		   AND ($3::UUID IS NULL OR l.tank_id = $3)
		   AND ($4::TIMESTAMPTZ IS NULL OR l.occurred_at >= $4)
		   AND ($5::TIMESTAMPTZ IS NULL OR l.occurred_at <= $5)
		 ORDER BY l.occurred_at ASC, l.seq ASC
		 LIMIT $7 OFFSET $8
	`

	lRows, err := s.pool.Query(ctx, ledgerQuery, tenantID, q.BranchID, q.TankID, q.FromDate, q.ToDate, authz.BranchScope(ctx), pageSize, (page-1)*pageSize)
	if err != nil {
		return nil, fmt.Errorf("failed to query stock ledger lines: %w", err)
	}
	defer lRows.Close()

	var ledgerLines []LedgerLineItem
	for lRows.Next() {
		var line LedgerLineItem
		var deltaML, balanceML int64
		if err := lRows.Scan(
			&line.ID, &line.TankID, &line.TankCode, &line.TankName, &line.Seq, &line.OccurredAt, &line.Kind,
			&deltaML, &balanceML, &line.RefType, &line.RefCode, &line.Note,
		); err != nil {
			return nil, fmt.Errorf("failed to scan ledger line: %w", err)
		}
		line.KindLabel = kindToLabel(line.Kind)
		if deltaML > 0 {
			line.InLiters = mlToLiters(deltaML)
			line.OutLiters = 0
		} else {
			line.InLiters = 0
			line.OutLiters = mlToLiters(-deltaML)
		}
		line.BalanceLiters = mlToLiters(balanceML)
		ledgerLines = append(ledgerLines, line)
	}

	return &StockLedgerReportResponse{
		Summary:        summaries,
		Ledger:         ledgerLines,
		LedgerTotal:    ledgerTotal,
		LedgerPage:     page,
		LedgerPageSize: pageSize,
	}, nil
}

// ---------------------------------------------------------------------------------------------------
// 2. Bảng kê phiếu nhập (Receipts Summary Report)
// ---------------------------------------------------------------------------------------------------

func (s *Service) GetReceiptReport(ctx context.Context, q ReceiptReportQuery) (*ReceiptReportResponse, error) {
	tenantID, err := getTenantUUID(ctx)
	if err != nil {
		return nil, err
	}

	query := `
		SELECT r.id, r.code, r.received_at, r.tanker_plate, r.document_no, r.status, r.note,
		       s.name AS supplier_name,
		       b.name AS branch_name,
		       t.name AS tank_name,
		       f.name AS fuel_type_name,
		       rl.document_volume_ml,
		       rl.actual_volume_ml,
		       rl.variance_ml,
		       COALESCE(u1.full_name, '—') AS created_by_name,
		       u2.full_name AS decided_by_name,
		       r.decided_at
		  FROM station.stock_receipt r
		  JOIN station.stock_receipt_line rl ON rl.receipt_id = r.id AND rl.tenant_id = r.tenant_id
		  JOIN station.tank t ON t.id = rl.tank_id AND t.tenant_id = r.tenant_id
		  JOIN station.fuel_type f ON f.id = rl.fuel_type_id AND f.tenant_id = r.tenant_id
		  JOIN station.branch b ON b.id = r.branch_id AND b.tenant_id = r.tenant_id
		  LEFT JOIN station.supplier s ON s.id = r.supplier_id AND s.tenant_id = r.tenant_id
		  LEFT JOIN station.app_user u1 ON u1.id = r.created_by AND u1.tenant_id = r.tenant_id
		  LEFT JOIN station.app_user u2 ON u2.id = r.decided_by AND u2.tenant_id = r.tenant_id
		 WHERE r.tenant_id = $1
		   AND ($2::UUID IS NULL OR r.branch_id = $2)
		   AND ($8::UUID[] IS NULL OR r.branch_id = ANY($8))
		   AND ($3::UUID IS NULL OR r.supplier_id = $3)
		   AND ($4::UUID IS NULL OR rl.tank_id = $4)
		   AND ($5::TEXT IS NULL OR r.status = $5)
		   AND ($6::TIMESTAMPTZ IS NULL OR r.received_at >= $6)
		   AND ($7::TIMESTAMPTZ IS NULL OR r.received_at <= $7)
		 ORDER BY r.received_at DESC, r.code DESC
	`

	rows, err := s.pool.Query(ctx, query, tenantID, q.BranchID, q.SupplierID, q.TankID, q.Status, q.FromDate, q.ToDate, authz.BranchScope(ctx))
	if err != nil {
		return nil, fmt.Errorf("failed to query receipt report: %w", err)
	}
	defer rows.Close()

	var items []ReceiptReportItem
	var totalDocML, totalActML, totalVarML int64

	for rows.Next() {
		var item ReceiptReportItem
		var docML, actML, varML int64
		if err := rows.Scan(
			&item.ID, &item.ReceiptCode, &item.ReceivedAt, &item.TankerPlate, &item.DocumentNo, &item.Status, &item.Note,
			&item.SupplierName, &item.BranchName, &item.TankName, &item.FuelTypeName,
			&docML, &actML, &varML,
			&item.CreatedByName, &item.DecidedByName, &item.DecidedAt,
		); err != nil {
			return nil, fmt.Errorf("failed to scan receipt report item: %w", err)
		}
		item.DocumentLiters = mlToLiters(docML)
		item.ActualLiters = mlToLiters(actML)
		item.VarianceLiters = mlToLiters(varML)

		totalDocML += docML
		totalActML += actML
		totalVarML += varML

		items = append(items, item)
	}

	return &ReceiptReportResponse{
		Items:               items,
		TotalDocumentLiters: mlToLiters(totalDocML),
		TotalActualLiters:   mlToLiters(totalActML),
		TotalVarianceLiters: mlToLiters(totalVarML),
		TotalCount:          len(items),
	}, nil
}

// ---------------------------------------------------------------------------------------------------
// 3. Lịch sử cấp phát (Dispenses Report)
// ---------------------------------------------------------------------------------------------------

func (s *Service) GetDispenseReport(ctx context.Context, q DispenseReportQuery) (*DispenseReportResponse, error) {
	tenantID, err := getTenantUUID(ctx)
	if err != nil {
		return nil, err
	}

	page := q.Page
	if page < 1 {
		page = 1
	}
	pageSize := q.PageSize
	if pageSize < 1 || pageSize > 500 {
		pageSize = 50
	}
	offset := (page - 1) * pageSize

	// Count & summary query
	countQuery := `
		SELECT COUNT(*), COALESCE(SUM(ds.dispensed_ml), 0)
		  FROM station.dispense_session ds
		 WHERE ds.tenant_id = $1
		   AND ($2::UUID IS NULL OR ds.branch_id = $2)
		   AND ($10::UUID[] IS NULL OR ds.branch_id = ANY($10))
		   AND ($3::UUID IS NULL OR ds.pump_id = $3)
		   AND ($4::UUID IS NULL OR ds.tank_id = $4)
		   AND ($5::UUID IS NULL OR ds.vehicle_id = $5)
		   AND ($6::UUID IS NULL OR ds.driver_id = $6)
		   AND ($7::TEXT IS NULL OR ds.status = $7)
		   AND ($8::TIMESTAMPTZ IS NULL OR COALESCE(ds.finished_at, ds.started_at, ds.received_at) >= $8)
		   AND ($9::TIMESTAMPTZ IS NULL OR COALESCE(ds.finished_at, ds.started_at, ds.received_at) <= $9)
	`

	var totalSessions int
	var totalDispensedML int64
	err = s.pool.QueryRow(ctx, countQuery,
		tenantID, q.BranchID, q.PumpID, q.TankID, q.VehicleID, q.DriverID, q.Status, q.FromDate, q.ToDate, authz.BranchScope(ctx),
	).Scan(&totalSessions, &totalDispensedML)
	if err != nil {
		return nil, fmt.Errorf("failed to count dispenses: %w", err)
	}

	// Items query
	itemsQuery := `
		SELECT ds.id, ds.code, ds.finished_at, ds.started_at, ds.pump_name,
		       t.name AS tank_name,
		       f.name AS fuel_type_name,
		       b.name AS branch_name,
		       ds.vehicle_plate, ds.vehicle_code,
		       ds.driver_name, ds.driver_code,
		       ds.dispensed_ml, ds.pump_total_ml, ds.sale_seq, ds.status
		  FROM station.dispense_session ds
		  JOIN station.branch b ON b.id = ds.branch_id AND b.tenant_id = ds.tenant_id
		  LEFT JOIN station.tank t ON t.id = ds.tank_id AND t.tenant_id = ds.tenant_id
		  LEFT JOIN station.fuel_type f ON f.id = ds.fuel_type_id AND f.tenant_id = ds.tenant_id
		 WHERE ds.tenant_id = $1
		   AND ($2::UUID IS NULL OR ds.branch_id = $2)
		   AND ($12::UUID[] IS NULL OR ds.branch_id = ANY($12))
		   AND ($3::UUID IS NULL OR ds.pump_id = $3)
		   AND ($4::UUID IS NULL OR ds.tank_id = $4)
		   AND ($5::UUID IS NULL OR ds.vehicle_id = $5)
		   AND ($6::UUID IS NULL OR ds.driver_id = $6)
		   AND ($7::TEXT IS NULL OR ds.status = $7)
		   AND ($8::TIMESTAMPTZ IS NULL OR COALESCE(ds.finished_at, ds.started_at, ds.received_at) >= $8)
		   AND ($9::TIMESTAMPTZ IS NULL OR COALESCE(ds.finished_at, ds.started_at, ds.received_at) <= $9)
		 ORDER BY COALESCE(ds.finished_at, ds.started_at, ds.received_at) DESC
		 LIMIT $10 OFFSET $11
	`

	rows, err := s.pool.Query(ctx, itemsQuery,
		tenantID, q.BranchID, q.PumpID, q.TankID, q.VehicleID, q.DriverID, q.Status, q.FromDate, q.ToDate,
		pageSize, offset, authz.BranchScope(ctx),
	)
	if err != nil {
		return nil, fmt.Errorf("failed to query dispense report: %w", err)
	}
	defer rows.Close()

	var items []DispenseReportItem
	for rows.Next() {
		var item DispenseReportItem
		var dispML int64
		var pumpTotML *int64
		if err := rows.Scan(
			&item.ID, &item.Code, &item.FinishedAt, &item.StartedAt, &item.PumpName,
			&item.TankName, &item.FuelTypeName, &item.BranchName,
			&item.VehiclePlate, &item.VehicleCode,
			&item.DriverName, &item.DriverCode,
			&dispML, &pumpTotML, &item.SaleSeq, &item.Status,
		); err != nil {
			return nil, fmt.Errorf("failed to scan dispense report item: %w", err)
		}
		item.DispensedLiters = mlToLiters(dispML)
		if pumpTotML != nil {
			val := mlToLiters(*pumpTotML)
			item.PumpTotalLiters = &val
		}
		items = append(items, item)
	}

	totalPages := 0
	if totalSessions > 0 {
		totalPages = int(math.Ceil(float64(totalSessions) / float64(pageSize)))
	}

	return &DispenseReportResponse{
		Items:                items,
		TotalSessions:        totalSessions,
		TotalDispensedLiters: mlToLiters(totalDispensedML),
		Page:                 page,
		PageSize:             pageSize,
		TotalPages:           totalPages,
	}, nil
}

// ---------------------------------------------------------------------------------------------------
// 4. Tiêu hao theo xe (Vehicle Consumption Report)
// ---------------------------------------------------------------------------------------------------

func (s *Service) GetVehicleConsumptionReport(ctx context.Context, q VehicleConsumptionQuery) (*VehicleConsumptionResponse, error) {
	tenantID, err := getTenantUUID(ctx)
	if err != nil {
		return nil, err
	}

	query := `
		SELECT v.id AS vehicle_id, v.code AS vehicle_code, v.plate AS vehicle_plate,
		       vt.name AS type_name,
		       COUNT(ds.id) AS session_count,
		       COALESCE(SUM(ds.dispensed_ml), 0) AS total_dispensed_ml
		  FROM station.vehicle v
		  LEFT JOIN station.vehicle_type vt ON vt.id = v.vehicle_type_id AND vt.tenant_id = v.tenant_id
		  LEFT JOIN station.dispense_session ds ON ds.vehicle_id = v.id AND ds.tenant_id = v.tenant_id
		       AND ds.status = 'completed'
		       AND ($6::UUID[] IS NULL OR ds.branch_id = ANY($6))
		       AND ($3::TIMESTAMPTZ IS NULL OR COALESCE(ds.finished_at, ds.started_at, ds.received_at) >= $3)
		       AND ($4::TIMESTAMPTZ IS NULL OR COALESCE(ds.finished_at, ds.started_at, ds.received_at) <= $4)
		 WHERE v.tenant_id = $1
		   AND ($2::UUID IS NULL OR EXISTS (SELECT 1 FROM station.vehicle_branch vb WHERE vb.tenant_id = v.tenant_id AND vb.vehicle_id = v.id AND vb.branch_id = $2))
		   AND ($6::UUID[] IS NULL OR EXISTS (SELECT 1 FROM station.vehicle_branch vs WHERE vs.tenant_id = v.tenant_id AND vs.vehicle_id = v.id AND vs.branch_id = ANY($6)))
		   AND ($5::UUID IS NULL OR v.id = $5)
		 GROUP BY v.id, v.code, v.plate, vt.name
		 ORDER BY total_dispensed_ml DESC, v.plate ASC
	`

	rows, err := s.pool.Query(ctx, query, tenantID, q.BranchID, q.FromDate, q.ToDate, q.VehicleID, authz.BranchScope(ctx))
	if err != nil {
		return nil, fmt.Errorf("failed to query vehicle consumption report: %w", err)
	}
	defer rows.Close()

	items := make([]VehicleConsumptionItem, 0)
	var totalDispensedML int64
	var totalSessions int

	for rows.Next() {
		var item VehicleConsumptionItem
		var dispML int64
		if err := rows.Scan(
			&item.VehicleID, &item.VehicleCode, &item.VehiclePlate,
			&item.TypeName,
			&item.SessionCount, &dispML,
		); err != nil {
			return nil, fmt.Errorf("failed to scan vehicle report item: %w", err)
		}

		item.TotalDispensedLiters = mlToLiters(dispML)
		totalDispensedML += dispML
		totalSessions += item.SessionCount

		items = append(items, item)
	}

	return &VehicleConsumptionResponse{
		Items:                items,
		TotalVehicles:        len(items),
		TotalSessions:        totalSessions,
		TotalDispensedLiters: mlToLiters(totalDispensedML),
	}, nil
}

// ---------------------------------------------------------------------------------------------------
// 5. Cấp phát theo tài xế (Driver Dispense Report)
// ---------------------------------------------------------------------------------------------------

func (s *Service) GetDriverDispenseReport(ctx context.Context, q DriverDispenseQuery) (*DriverDispenseResponse, error) {
	tenantID, err := getTenantUUID(ctx)
	if err != nil {
		return nil, err
	}

	query := `
		SELECT d.id AS driver_id, d.code AS driver_code, d.full_name AS driver_name, d.phone,
		       COUNT(ds.id) AS session_count,
		       COALESCE(SUM(ds.dispensed_ml), 0) AS total_dispensed_ml,
		       COALESCE(string_agg(DISTINCT ds.vehicle_plate, ', ') FILTER (WHERE ds.vehicle_plate IS NOT NULL), '') AS vehicles_used
		  FROM station.driver d
		  LEFT JOIN station.dispense_session ds ON ds.driver_id = d.id AND ds.tenant_id = d.tenant_id
		       AND ds.status = 'completed'
		       AND ($2::UUID IS NULL OR ds.branch_id = $2)
		       AND ($6::UUID[] IS NULL OR ds.branch_id = ANY($6))
		       AND ($3::TIMESTAMPTZ IS NULL OR COALESCE(ds.finished_at, ds.started_at, ds.received_at) >= $3)
		       AND ($4::TIMESTAMPTZ IS NULL OR COALESCE(ds.finished_at, ds.started_at, ds.received_at) <= $4)
		 WHERE d.tenant_id = $1
		   AND ($5::UUID IS NULL OR d.id = $5)
		 GROUP BY d.id, d.code, d.full_name, d.phone
		 ORDER BY total_dispensed_ml DESC, d.full_name ASC
	`

	rows, err := s.pool.Query(ctx, query, tenantID, q.BranchID, q.FromDate, q.ToDate, q.DriverID, authz.BranchScope(ctx))
	if err != nil {
		return nil, fmt.Errorf("failed to query driver dispense report: %w", err)
	}
	defer rows.Close()

	items := make([]DriverDispenseItem, 0)
	var totalDispensedML int64
	var totalSessions int

	for rows.Next() {
		var item DriverDispenseItem
		var dispML int64
		if err := rows.Scan(
			&item.DriverID, &item.DriverCode, &item.DriverName, &item.Phone,
			&item.SessionCount, &dispML, &item.VehiclesUsed,
		); err != nil {
			return nil, fmt.Errorf("failed to scan driver report item: %w", err)
		}

		item.TotalDispensedLiters = mlToLiters(dispML)
		totalDispensedML += dispML
		totalSessions += item.SessionCount

		if item.SessionCount > 0 {
			item.AvgLitersPerSession = math.Round((item.TotalDispensedLiters/float64(item.SessionCount))*100) / 100
		}

		items = append(items, item)
	}

	return &DriverDispenseResponse{
		Items:                items,
		TotalDrivers:         len(items),
		TotalSessions:        totalSessions,
		TotalDispensedLiters: mlToLiters(totalDispensedML),
	}, nil
}
