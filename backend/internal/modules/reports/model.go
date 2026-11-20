package reports

import (
	"time"

	"github.com/google/uuid"
)

// ---------------------------------------------------------------------------------------------------
// 1. Nhập – Xuất – Tồn và Thẻ kho (Stock Ledger & Balance)
// ---------------------------------------------------------------------------------------------------

type StockLedgerQuery struct {
	BranchID *uuid.UUID `json:"branch_id"`
	TankID   *uuid.UUID `json:"tank_id"`
	FromDate *time.Time `json:"from_date"`
	ToDate   *time.Time `json:"to_date"`
}

type TankSummaryItem struct {
	TankID         uuid.UUID `json:"tank_id"`
	TankCode       string    `json:"tank_code"`
	TankName       string    `json:"tank_name"`
	FuelTypeName   string    `json:"fuel_type_name"`
	BranchName     string    `json:"branch_name"`
	CapacityLiters float64   `json:"capacity_liters"`
	OpeningLiters  float64   `json:"opening_liters"`
	ReceiptLiters  float64   `json:"receipt_liters"`
	DispenseLiters float64   `json:"dispense_liters"`
	IssueLiters    float64   `json:"issue_liters"`
	AdjustLiters   float64   `json:"adjust_liters"`
	ClosingLiters  float64   `json:"closing_liters"`
}

type LedgerLineItem struct {
	ID            int64     `json:"id"`
	TankID        uuid.UUID `json:"tank_id"`
	TankCode      string    `json:"tank_code"`
	TankName      string    `json:"tank_name"`
	Seq           int64     `json:"seq"`
	OccurredAt    time.Time `json:"occurred_at"`
	Kind          string    `json:"kind"`
	KindLabel     string    `json:"kind_label"`
	RefType       *string   `json:"ref_type"`
	RefCode       *string   `json:"ref_code"`
	Note          *string   `json:"note"`
	InLiters      float64   `json:"in_liters"`
	OutLiters     float64   `json:"out_liters"`
	BalanceLiters float64   `json:"balance_liters"`
}

type StockLedgerReportResponse struct {
	Summary []TankSummaryItem `json:"summary"`
	Ledger  []LedgerLineItem  `json:"ledger"`
}

// ---------------------------------------------------------------------------------------------------
// 2. Bảng kê phiếu nhập (Receipts Summary Report)
// ---------------------------------------------------------------------------------------------------

type ReceiptReportQuery struct {
	BranchID   *uuid.UUID `json:"branch_id"`
	SupplierID *uuid.UUID `json:"supplier_id"`
	TankID     *uuid.UUID `json:"tank_id"`
	Status     *string    `json:"status"`
	FromDate   *time.Time `json:"from_date"`
	ToDate     *time.Time `json:"to_date"`
}

type ReceiptReportItem struct {
	ID             uuid.UUID  `json:"id"`
	ReceiptCode    string     `json:"receipt_code"`
	ReceivedAt     time.Time  `json:"received_at"`
	TankerPlate    *string    `json:"tanker_plate"`
	DocumentNo     *string    `json:"document_no"`
	Status         string     `json:"status"`
	Note           *string    `json:"note"`
	SupplierName   *string    `json:"supplier_name"`
	BranchName     string     `json:"branch_name"`
	TankName       string     `json:"tank_name"`
	FuelTypeName   string     `json:"fuel_type_name"`
	DocumentLiters float64    `json:"document_liters"`
	ActualLiters   float64    `json:"actual_liters"`
	VarianceLiters float64    `json:"variance_liters"`
	CreatedByName  string     `json:"created_by_name"`
	DecidedByName  *string    `json:"decided_by_name"`
	DecidedAt      *time.Time `json:"decided_at"`
}

type ReceiptReportResponse struct {
	Items               []ReceiptReportItem `json:"items"`
	TotalDocumentLiters float64             `json:"total_document_liters"`
	TotalActualLiters   float64             `json:"total_actual_liters"`
	TotalVarianceLiters float64             `json:"total_variance_liters"`
	TotalCount          int                 `json:"total_count"`
}

// ---------------------------------------------------------------------------------------------------
// 3. Lịch sử cấp phát (Dispenses Report)
// ---------------------------------------------------------------------------------------------------

type DispenseReportQuery struct {
	BranchID  *uuid.UUID `json:"branch_id"`
	PumpID    *uuid.UUID `json:"pump_id"`
	TankID    *uuid.UUID `json:"tank_id"`
	VehicleID *uuid.UUID `json:"vehicle_id"`
	DriverID  *uuid.UUID `json:"driver_id"`
	Status    *string    `json:"status"`
	FromDate  *time.Time `json:"from_date"`
	ToDate    *time.Time `json:"to_date"`
	Page      int        `json:"page"`
	PageSize  int        `json:"page_size"`
}

type DispenseReportItem struct {
	ID              uuid.UUID  `json:"id"`
	Code            string     `json:"code"`
	FinishedAt      *time.Time `json:"finished_at"`
	StartedAt       *time.Time `json:"started_at"`
	PumpName        string     `json:"pump_name"`
	TankName        *string    `json:"tank_name"`
	FuelTypeName    *string    `json:"fuel_type_name"`
	BranchName      string     `json:"branch_name"`
	VehiclePlate    *string    `json:"vehicle_plate"`
	VehicleCode     *string    `json:"vehicle_code"`
	DriverName      *string    `json:"driver_name"`
	DriverCode      *string    `json:"driver_code"`
	DispensedLiters float64    `json:"dispensed_liters"`
	PumpTotalLiters *float64   `json:"pump_total_liters"`
	SaleSeq         *int64     `json:"sale_seq"`
	Status          string     `json:"status"`
}

type DispenseReportResponse struct {
	Items                []DispenseReportItem `json:"items"`
	TotalSessions        int                  `json:"total_sessions"`
	TotalDispensedLiters float64              `json:"total_dispensed_liters"`
	Page                 int                  `json:"page"`
	PageSize             int                  `json:"page_size"`
	TotalPages           int                  `json:"total_pages"`
}

// ---------------------------------------------------------------------------------------------------
// 4. Tiêu hao theo xe (Vehicle Consumption Report)
// ---------------------------------------------------------------------------------------------------

type VehicleConsumptionQuery struct {
	BranchID  *uuid.UUID `json:"branch_id"`
	VehicleID *uuid.UUID `json:"vehicle_id"`
	FromDate  *time.Time `json:"from_date"`
	ToDate    *time.Time `json:"to_date"`
}

type VehicleConsumptionItem struct {
	VehicleID            uuid.UUID `json:"vehicle_id"`
	VehicleCode          string    `json:"vehicle_code"`
	VehiclePlate         string    `json:"vehicle_plate"`
	TypeName             *string   `json:"type_name"`
	SessionCount         int       `json:"session_count"`
	TotalDispensedLiters float64   `json:"total_dispensed_liters"`
	QuotaLiters          *float64  `json:"quota_liters"`
	QuotaPeriod          *string   `json:"quota_period"`
	VarianceLiters       *float64  `json:"variance_liters"`
	Status               string    `json:"status"` // "normal", "over_quota", "no_quota"
}

type VehicleConsumptionResponse struct {
	Items                []VehicleConsumptionItem `json:"items"`
	TotalVehicles        int                      `json:"total_vehicles"`
	TotalSessions        int                      `json:"total_sessions"`
	TotalDispensedLiters float64                  `json:"total_dispensed_liters"`
}

// ---------------------------------------------------------------------------------------------------
// 5. Cấp phát theo tài xế (Driver Dispense Report)
// ---------------------------------------------------------------------------------------------------

type DriverDispenseQuery struct {
	BranchID *uuid.UUID `json:"branch_id"`
	DriverID *uuid.UUID `json:"driver_id"`
	FromDate *time.Time `json:"from_date"`
	ToDate   *time.Time `json:"to_date"`
}

type DriverDispenseItem struct {
	DriverID             uuid.UUID `json:"driver_id"`
	DriverCode           string    `json:"driver_code"`
	DriverName           string    `json:"driver_name"`
	Phone                *string   `json:"phone"`
	SessionCount         int       `json:"session_count"`
	TotalDispensedLiters float64   `json:"total_dispensed_liters"`
	AvgLitersPerSession  float64   `json:"avg_liters_per_session"`
	VehiclesUsed         string    `json:"vehicles_used"`
}

type DriverDispenseResponse struct {
	Items                []DriverDispenseItem `json:"items"`
	TotalDrivers         int                  `json:"total_drivers"`
	TotalSessions        int                  `json:"total_sessions"`
	TotalDispensedLiters float64              `json:"total_dispensed_liters"`
}

// ---------------------------------------------------------------------------------------------------
// 6. Đối chiếu kiểm kê (Reconciliation Report)
// ---------------------------------------------------------------------------------------------------

type ReconciliationReportQuery struct {
	BranchID *uuid.UUID `json:"branch_id"`
	TankID   *uuid.UUID `json:"tank_id"`
	Status   *string    `json:"status"`
	FromDate *time.Time `json:"from_date"`
	ToDate   *time.Time `json:"to_date"`
}

type ReconciliationReportItem struct {
	ID                  uuid.UUID `json:"id"`
	PeriodDate          string    `json:"period_date"`
	BranchName          string    `json:"branch_name"`
	TankName            string    `json:"tank_name"`
	TankCode            string    `json:"tank_code"`
	FuelTypeName        string    `json:"fuel_type_name"`
	OpeningLiters       float64   `json:"opening_liters"`
	ReceiptsLiters      float64   `json:"receipts_liters"`
	DispensedLiters     float64   `json:"dispensed_liters"`
	OtherIssuesLiters   float64   `json:"other_issues_liters"`
	BookClosingLiters   float64   `json:"book_closing_liters"`
	MeasuredLiters      *float64  `json:"measured_liters"`
	PumpTotalizerLiters *float64  `json:"pump_totalizer_liters"`
	VarianceLiters      *float64  `json:"variance_liters"`
	VariancePct         *float64  `json:"variance_pct"`
	TolerancePct        float64   `json:"tolerance_pct"`
	Status              string    `json:"status"`
	MeasuredByName      *string   `json:"measured_by_name"`
	ConfirmedByName     *string   `json:"confirmed_by_name"`
}

type ReconciliationReportResponse struct {
	Items               []ReconciliationReportItem `json:"items"`
	TotalCount          int                        `json:"total_count"`
	MatchedCount        int                        `json:"matched_count"`
	AlertCount          int                        `json:"alert_count"`
	ConfirmedCount      int                        `json:"confirmed_count"`
	TotalVarianceLiters float64                    `json:"total_variance_liters"`
}
