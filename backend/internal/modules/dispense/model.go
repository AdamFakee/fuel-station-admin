package dispense

import "time"

type DispenseSessionListItem struct {
	ID              string     `json:"id"`
	Code            string     `json:"code"`
	EdgeRef         string     `json:"edge_ref"`
	BranchID        string     `json:"branch_id"`
	BranchName      string     `json:"branch_name"`
	PumpID          string     `json:"pump_id"`
	PumpName        string     `json:"pump_name"`
	TankID          *string    `json:"tank_id,omitempty"`
	TankName        *string    `json:"tank_name,omitempty"`
	FuelTypeName    *string    `json:"fuel_type_name,omitempty"`
	VehicleID       *string    `json:"vehicle_id,omitempty"`
	VehiclePlate    *string    `json:"vehicle_plate,omitempty"`
	VehicleCode     *string    `json:"vehicle_code,omitempty"`
	DriverID        *string    `json:"driver_id,omitempty"`
	DriverName      *string    `json:"driver_name,omitempty"`
	DriverCode      *string    `json:"driver_code,omitempty"`
	LimitMl         *int64     `json:"limit_ml,omitempty"`
	LimitLiters     *float64   `json:"limit_liters,omitempty"`
	DispensedMl     int64      `json:"dispensed_ml"`
	DispensedLiters float64    `json:"dispensed_liters"`
	PumpTotalMl     *int64     `json:"pump_total_ml,omitempty"`
	PumpTotalLiters *float64   `json:"pump_total_liters,omitempty"`
	SensorSerial    *int64     `json:"sensor_serial,omitempty"`
	SaleSeq         *int64     `json:"sale_seq,omitempty"`
	Status          string     `json:"status"` // 'completed', 'cancelled', 'failed'
	EdgeState       string     `json:"edge_state"`
	StartedAt       *time.Time `json:"started_at,omitempty"`
	FinishedAt      *time.Time `json:"finished_at,omitempty"`
	ReceivedAt      time.Time  `json:"received_at"`
	CreatedAt       time.Time  `json:"created_at"`
}

type SessionTimelineEvent struct {
	FromState  *string   `json:"from_state,omitempty"`
	ToState    string    `json:"to_state"`
	OccurredAt time.Time `json:"occurred_at"`
}

type SessionAccessEvent struct {
	ID          int64     `json:"id"`
	Kind        string    `json:"kind"`
	Method      *string   `json:"method,omitempty"`
	ExternalID  *string   `json:"external_id,omitempty"`
	PartyName   *string   `json:"party_name,omitempty"`
	Decision    string    `json:"decision"`
	Reason      *string   `json:"reason,omitempty"`
	OccurredAt  time.Time `json:"occurred_at"`
}

type DispenseSessionDetail struct {
	DispenseSessionListItem
	RawHex       *string                `json:"raw_hex,omitempty"`
	Timeline     []SessionTimelineEvent `json:"timeline"`
	AccessEvents []SessionAccessEvent   `json:"access_events"`
}

type AccessEventListItem struct {
	ID           int64      `json:"id"`
	EdgeRef      string     `json:"edge_ref"`
	BranchID     string     `json:"branch_id"`
	BranchName   string     `json:"branch_name"`
	OccurredAt   time.Time  `json:"occurred_at"`
	Kind         string     `json:"kind"`
	Method       *string    `json:"method,omitempty"`
	ExternalID   *string    `json:"external_id,omitempty"`
	VehiclePlate *string    `json:"vehicle_plate,omitempty"`
	DriverName   *string    `json:"driver_name,omitempty"`
	PartyName    *string    `json:"party_name,omitempty"`
	Decision     string     `json:"decision"` // 'accept', 'reject'
	Reason       *string    `json:"reason,omitempty"`
	SessionID    *string    `json:"session_id,omitempty"`
	Detail       any        `json:"detail,omitempty"`
	ReceivedAt   time.Time  `json:"received_at"`
}

type DispenseSummary struct {
	TotalSessions        int     `json:"total_sessions"`
	CompletedSessions    int     `json:"completed_sessions"`
	CancelledSessions    int     `json:"cancelled_sessions"`
	FailedSessions       int     `json:"failed_sessions"`
	TotalDispensedLiters float64 `json:"total_dispensed_liters"`
	RejectedAuthCount    int     `json:"rejected_auth_count"`
}

type SessionListQuery struct {
	Page      int        `json:"page"`
	PageSize  int        `json:"page_size"`
	Search    string     `json:"search"`
	BranchID  string     `json:"branch_id"`
	PumpID    string     `json:"pump_id"`
	VehicleID string     `json:"vehicle_id"`
	DriverID  string     `json:"driver_id"`
	Status    string     `json:"status"`
	FromDate  *time.Time `json:"from_date"`
	ToDate    *time.Time `json:"to_date"`
}

type AccessEventListQuery struct {
	Page     int        `json:"page"`
	PageSize int        `json:"page_size"`
	Search   string     `json:"search"`
	BranchID string     `json:"branch_id"`
	Decision string     `json:"decision"` // 'accept', 'reject', or 'all'
	Method   string     `json:"method"`
	FromDate *time.Time `json:"from_date"`
	ToDate   *time.Time `json:"to_date"`
}

type PagedResponse[T any] struct {
	Items      []T `json:"items"`
	Total      int `json:"total"`
	Page       int `json:"page"`
	PageSize   int `json:"page_size"`
	TotalPages int `json:"total_pages"`
}
