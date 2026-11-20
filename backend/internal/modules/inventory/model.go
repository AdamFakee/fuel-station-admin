package inventory

import (
	"time"
)

// ------------------------------------------------------------------------------------------------
// SUPPLIER MODELS
// ------------------------------------------------------------------------------------------------

type Supplier struct {
	ID        string    `json:"id"`
	TenantID  string    `json:"tenant_id"`
	Code      string    `json:"code"`
	Name      string    `json:"name"`
	Phone     *string   `json:"phone,omitempty"`
	Address   *string   `json:"address,omitempty"`
	Active    bool      `json:"active"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

type CreateSupplierRequest struct {
	Code    string  `json:"code"`
	Name    string  `json:"name"`
	Phone   *string `json:"phone,omitempty"`
	Address *string `json:"address,omitempty"`
}

// ------------------------------------------------------------------------------------------------
// STOCK RECEIPT MODELS
// ------------------------------------------------------------------------------------------------

type StockReceiptLine struct {
	ID                string  `json:"id"`
	TenantID          string  `json:"tenant_id"`
	ReceiptID         string  `json:"receipt_id"`
	TankID            string  `json:"tank_id"`
	TankCode          string  `json:"tank_code"`
	TankName          string  `json:"tank_name"`
	FuelTypeID        string  `json:"fuel_type_id"`
	FuelTypeName      string  `json:"fuel_type_name"`
	LevelBeforeML     *int64  `json:"level_before_ml,omitempty"`
	DocumentVolumeML  int64   `json:"document_volume_ml"`
	ActualVolumeML    int64   `json:"actual_volume_ml"`
	LevelAfterML      *int64  `json:"level_after_ml,omitempty"`
	VarianceML        int64   `json:"variance_ml"` // actual - document
}

type StockReceiptLineInput struct {
	TankID           string `json:"tank_id"`
	FuelTypeID       string `json:"fuel_type_id"`
	LevelBeforeML    *int64 `json:"level_before_ml,omitempty"`
	DocumentVolumeML int64  `json:"document_volume_ml"`
	ActualVolumeML   int64  `json:"actual_volume_ml"`
	LevelAfterML     *int64 `json:"level_after_ml,omitempty"`
}

type StockReceipt struct {
	ID             string             `json:"id"`
	TenantID       string             `json:"tenant_id"`
	BranchID       string             `json:"branch_id"`
	BranchName     string             `json:"branch_name"`
	Code           string             `json:"code"`
	ReceivedAt     time.Time          `json:"received_at"`
	SupplierID     *string            `json:"supplier_id,omitempty"`
	SupplierName   *string            `json:"supplier_name,omitempty"`
	TankerPlate    *string            `json:"tanker_plate,omitempty"`
	DocumentNo     *string            `json:"document_no,omitempty"`
	Status         string             `json:"status"` // draft, pending, approved, rejected
	Note           *string            `json:"note,omitempty"`
	CreatedBy      string             `json:"created_by"`
	CreatedByName  string             `json:"created_by_name"`
	DecidedBy      *string            `json:"decided_by,omitempty"`
	DecidedByName  *string            `json:"decided_by_name,omitempty"`
	DecidedAt      *time.Time         `json:"decided_at,omitempty"`
	RejectReason   *string            `json:"reject_reason,omitempty"`
	TotalVolumeML  int64              `json:"total_volume_ml"`
	Lines          []StockReceiptLine `json:"lines"`
	CreatedAt      time.Time          `json:"created_at"`
	UpdatedAt      time.Time          `json:"updated_at"`
}

type CreateReceiptRequest struct {
	BranchID    string                  `json:"branch_id"`
	ReceivedAt  time.Time               `json:"received_at"`
	SupplierID  *string                 `json:"supplier_id,omitempty"`
	TankerPlate *string                 `json:"tanker_plate,omitempty"`
	DocumentNo  *string                 `json:"document_no,omitempty"`
	Note        *string                 `json:"note,omitempty"`
	Lines       []StockReceiptLineInput `json:"lines"`
}

type UpdateReceiptRequest struct {
	BranchID    string                  `json:"branch_id"`
	ReceivedAt  time.Time               `json:"received_at"`
	SupplierID  *string                 `json:"supplier_id,omitempty"`
	TankerPlate *string                 `json:"tanker_plate,omitempty"`
	DocumentNo  *string                 `json:"document_no,omitempty"`
	Note        *string                 `json:"note,omitempty"`
	Lines       []StockReceiptLineInput `json:"lines"`
}

type ApproveReceiptRequest struct {
	Approved     bool    `json:"approved"`
	RejectReason *string `json:"reject_reason,omitempty"`
}

type ReceiptListQuery struct {
	BranchID string
	Status   string
	Search   string
	Page     int
	PageSize int
}

type CapacityCheckRequest struct {
	TankID         string `json:"tank_id"`
	IncomingVolume int64  `json:"incoming_volume_ml"`
}

type CapacityCheckResult struct {
	TankID              string `json:"tank_id"`
	TankName            string `json:"tank_name"`
	CurrentStockML      int64  `json:"current_stock_ml"`
	MaxUsableCapacityML int64  `json:"max_usable_capacity_ml"`
	AvailableRoomML     int64  `json:"available_room_ml"`
	IncomingVolumeML    int64  `json:"incoming_volume_ml"`
	ExceedsCapacity     bool   `json:"exceeds_capacity"`
}

// ------------------------------------------------------------------------------------------------
// STOCK ISSUE (M11 - PHIẾU XUẤT ĐIỀU CHỈNH, HAO HỤT, KIỂM ĐỊNH)
// ------------------------------------------------------------------------------------------------

type StockIssue struct {
	ID            string     `json:"id"`
	TenantID      string     `json:"tenant_id"`
	BranchID      string     `json:"branch_id"`
	BranchName    string     `json:"branch_name"`
	Code          string     `json:"code"`
	Kind          string     `json:"kind"` // 'transfer' | 'loss' | 'inspection'
	KindName      string     `json:"kind_name"`
	TankID        string     `json:"tank_id"`
	TankCode      string     `json:"tank_code"`
	TankName      string     `json:"tank_name"`
	FuelTypeID    string     `json:"fuel_type_id"`
	FuelTypeName  string     `json:"fuel_type_name"`
	ToTankID      *string    `json:"to_tank_id,omitempty"`
	ToTankCode    *string    `json:"to_tank_code,omitempty"`
	ToTankName    *string    `json:"to_tank_name,omitempty"`
	VolumeML      int64      `json:"volume_ml"`
	VolumeLiters  float64    `json:"volume_liters"`
	Reason        string     `json:"reason"`
	Status        string     `json:"status"` // 'draft' | 'pending' | 'approved' | 'rejected'
	CreatedBy     string     `json:"created_by"`
	CreatedByName string     `json:"created_by_name"`
	DecidedBy     *string    `json:"decided_by,omitempty"`
	DecidedByName *string    `json:"decided_by_name,omitempty"`
	DecidedAt     *time.Time `json:"decided_at,omitempty"`
	RejectReason  *string    `json:"reject_reason,omitempty"`
	CreatedAt     time.Time  `json:"created_at"`
	UpdatedAt     time.Time  `json:"updated_at"`
}

type CreateIssueRequest struct {
	BranchID     string   `json:"branch_id"`
	Kind         string   `json:"kind"`
	TankID       string   `json:"tank_id"`
	ToTankID     *string  `json:"to_tank_id,omitempty"`
	VolumeLiters *float64 `json:"volume_liters,omitempty"`
	VolumeML     *int64   `json:"volume_ml,omitempty"`
	Reason       string   `json:"reason"`
}

type UpdateIssueRequest struct {
	BranchID     string   `json:"branch_id"`
	Kind         string   `json:"kind"`
	TankID       string   `json:"tank_id"`
	ToTankID     *string  `json:"to_tank_id,omitempty"`
	VolumeLiters *float64 `json:"volume_liters,omitempty"`
	VolumeML     *int64   `json:"volume_ml,omitempty"`
	Reason       string   `json:"reason"`
}

type ApproveIssueRequest struct {
	Approved     bool    `json:"approved"`
	RejectReason *string `json:"reject_reason,omitempty"`
}

type IssueListQuery struct {
	BranchID string
	Status   string
	Kind     string
	Search   string
	Page     int
	PageSize int
}

// ------------------------------------------------------------------------------------------------
// M12 - TỒN KHO TỨC THỜI, THẺ KHO, ĐỐI SOÁT KIỂM KÊ & CẢNH BÁO
// ------------------------------------------------------------------------------------------------

type TankStockItem struct {
	TenantID            string  `json:"tenant_id"`
	TankID              string  `json:"tank_id"`
	BranchID            string  `json:"branch_id"`
	BranchName          string  `json:"branch_name"`
	Code                string  `json:"code"`
	Name                string  `json:"name"`
	FuelTypeID          string  `json:"fuel_type_id"`
	FuelTypeName        string  `json:"fuel_type_name"`
	StockML             int64   `json:"stock_ml"`
	StockLiters         float64 `json:"stock_liters"`
	MaxUsableCapacityML int64   `json:"max_usable_capacity_ml"`
	MaxCapacityLiters   float64 `json:"max_capacity_liters"`
	LowStockThresholdML int64   `json:"low_stock_threshold_ml"`
	LowStockThresholdL  float64 `json:"low_stock_threshold_liters"`
	StockPct            float64 `json:"stock_pct"`
	IsLow               bool    `json:"is_low"`
	HasOpening          bool    `json:"has_opening"`
}

type StockLedgerItem struct {
	ID                 int64      `json:"id"`
	TenantID           string     `json:"tenant_id"`
	TankID             string     `json:"tank_id"`
	TankCode           string     `json:"tank_code"`
	TankName           string     `json:"tank_name"`
	Seq                int64      `json:"seq"`
	OccurredAt         time.Time  `json:"occurred_at"`
	Kind               string     `json:"kind"` // 'opening', 'receipt', 'dispense', 'issue', 'transfer_out', 'transfer_in', 'adjust'
	DeltaML            int64      `json:"delta_ml"`
	DeltaLiters        float64    `json:"delta_liters"`
	BalanceAfterML     int64      `json:"balance_after_ml"`
	BalanceAfterLiters float64    `json:"balance_after_liters"`
	RefType            *string    `json:"ref_type,omitempty"`
	RefID              *string    `json:"ref_id,omitempty"`
	Note               *string    `json:"note,omitempty"`
	CreatedBy          *string    `json:"created_by,omitempty"`
	CreatedByName      *string    `json:"created_by_name,omitempty"`
	CreatedAt          time.Time  `json:"created_at"`
}

type StockReconciliationItem struct {
	ID                  string     `json:"id"`
	TenantID            string     `json:"tenant_id"`
	BranchID            string     `json:"branch_id"`
	BranchName          string     `json:"branch_name"`
	TankID              string     `json:"tank_id"`
	TankCode            string     `json:"tank_code"`
	TankName            string     `json:"tank_name"`
	FuelTypeID          string     `json:"fuel_type_id"`
	FuelTypeName        string     `json:"fuel_type_name"`
	PeriodDate          string     `json:"period_date"` // YYYY-MM-DD
	OpeningML           int64      `json:"opening_ml"`
	OpeningLiters       float64    `json:"opening_liters"`
	ReceiptsML          int64      `json:"receipts_ml"`
	ReceiptsLiters      float64    `json:"receipts_liters"`
	DispensedML         int64      `json:"dispensed_ml"`
	DispensedLiters     float64    `json:"dispensed_liters"`
	OtherIssuesML       int64      `json:"other_issues_ml"`
	OtherIssuesLiters   float64    `json:"other_issues_liters"`
	BookClosingML       int64      `json:"book_closing_ml"`
	BookClosingLiters   float64    `json:"book_closing_liters"`
	MeasuredML          *int64     `json:"measured_ml,omitempty"`
	MeasuredLiters      *float64   `json:"measured_liters,omitempty"`
	PumpTotalizerML     *int64     `json:"pump_totalizer_ml,omitempty"`
	PumpTotalizerLiters *float64   `json:"pump_totalizer_liters,omitempty"`
	VarianceML          *int64     `json:"variance_ml,omitempty"`
	VarianceLiters      *float64   `json:"variance_liters,omitempty"`
	VariancePct         *float64   `json:"variance_pct,omitempty"`
	TolerancePct        float64    `json:"tolerance_pct"`
	Status              string     `json:"status"` // 'open', 'matched', 'alert', 'confirmed'
	MeasuredBy          *string    `json:"measured_by,omitempty"`
	MeasuredByName      *string    `json:"measured_by_name,omitempty"`
	ConfirmedBy         *string    `json:"confirmed_by,omitempty"`
	ConfirmedByName     *string    `json:"confirmed_by_name,omitempty"`
	ConfirmedAt         *time.Time `json:"confirmed_at,omitempty"`
	Note                *string    `json:"note,omitempty"`
	CreatedAt           time.Time  `json:"created_at"`
	UpdatedAt           time.Time  `json:"updated_at"`
}

type CreateReconciliationRequest struct {
	BranchID   string `json:"branch_id"`
	TankID     string `json:"tank_id"`
	PeriodDate string `json:"period_date"` // YYYY-MM-DD
}

type SubmitMeasureRequest struct {
	MeasuredLiters      *float64 `json:"measured_liters,omitempty"`
	MeasuredML          *int64   `json:"measured_ml,omitempty"`
	PumpTotalizerLiters *float64 `json:"pump_totalizer_liters,omitempty"`
	PumpTotalizerML     *int64   `json:"pump_totalizer_ml,omitempty"`
	Note                *string  `json:"note,omitempty"`
}

type ConfirmReconciliationRequest struct {
	AdjustLedger bool    `json:"adjust_ledger"`
	Note         *string `json:"note,omitempty"`
}

type AlertItem struct {
	ID              string     `json:"id"`
	TenantID        string     `json:"tenant_id"`
	BranchID        *string    `json:"branch_id,omitempty"`
	BranchName      *string    `json:"branch_name,omitempty"`
	Kind            string     `json:"kind"` // 'low_stock', 'loss_variance', 'station_offline', 'sync_error'
	TankID          *string    `json:"tank_id,omitempty"`
	TankName        *string    `json:"tank_name,omitempty"`
	EdgeStationID   *string    `json:"edge_station_id,omitempty"`
	EdgeStationName *string    `json:"edge_station_name,omitempty"`
	Message         string     `json:"message"`
	CreatedAt       time.Time  `json:"created_at"`
	ResolvedAt      *time.Time `json:"resolved_at,omitempty"`
}

type ReconciliationListQuery struct {
	BranchID   string
	TankID     string
	Status     string
	PeriodDate string
	Page       int
	PageSize   int
}

type StocktakeSummary struct {
	TotalTanks       int     `json:"total_tanks"`
	LowStockTanks    int     `json:"low_stock_tanks"`
	OpenStocktakes   int     `json:"open_stocktakes"`
	AlertStocktakes  int     `json:"alert_stocktakes"`
	TotalStockLiters float64 `json:"total_stock_liters"`
}
