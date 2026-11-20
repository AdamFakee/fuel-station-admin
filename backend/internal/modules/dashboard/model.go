package dashboard

import "time"

// TankStockItem holds instantaneous fuel inventory level for a tank.
type TankStockItem struct {
	TankID            string  `json:"tank_id"`
	TankCode          string  `json:"tank_code"`
	TankName          string  `json:"tank_name"`
	BranchID          string  `json:"branch_id"`
	BranchName        string  `json:"branch_name"`
	FuelTypeCode      string  `json:"fuel_type_code"`
	FuelTypeName      string  `json:"fuel_type_name"`
	StockLiters       float64 `json:"stock_liters"`
	MaxCapacityLiters float64 `json:"max_capacity_liters"`
	StockPct          float64 `json:"stock_pct"`
	IsLow             bool    `json:"is_low"`
	HasOpening        bool    `json:"has_opening"`
}

// PumpStatusItem represents operational pump status and connection to Edge Station.
type PumpStatusItem struct {
	PumpID               string  `json:"pump_id"`
	PumpCode             string  `json:"pump_code"`
	PumpName             string  `json:"pump_name"`
	EdgePumpID           int64   `json:"edge_pump_id"`
	BranchName           string  `json:"branch_name"`
	IsStationOnline      bool    `json:"is_station_online"`
	TodayDispensedLiters float64 `json:"today_dispensed_liters"`
	TodayDispenseCount   int     `json:"today_dispense_count"`
}

// RecentSessionItem represents recent dispense session.
type RecentSessionItem struct {
	ID              string     `json:"id"`
	Code            string     `json:"code"`
	PumpName        string     `json:"pump_name"`
	VehiclePlate    string     `json:"vehicle_plate"`
	DriverName      string     `json:"driver_name"`
	DispensedLiters float64    `json:"dispensed_liters"`
	Status          string     `json:"status"`
	FinishedAt      *time.Time `json:"finished_at,omitempty"`
	ReceivedAt      time.Time  `json:"received_at"`
}

// DashboardKpi contains key operational summary counters.
type DashboardKpi struct {
	TodayTotalLiters        float64 `json:"today_total_liters"`
	TodayTotalSessions      int     `json:"today_total_sessions"`
	TodayCompletedSessions  int     `json:"today_completed_sessions"`
	TodayFailedSessions     int     `json:"today_failed_sessions"`
	ActivePumps             int     `json:"active_pumps"`
	OnlineStations          int     `json:"online_stations"`
	LowStockTanks           int     `json:"low_stock_tanks"`
}

// DashboardResponse aggregates all dashboard widgets.
type DashboardResponse struct {
	Kpi            DashboardKpi        `json:"kpi"`
	Tanks          []TankStockItem     `json:"tanks"`
	Pumps          []PumpStatusItem    `json:"pumps"`
	RecentSessions []RecentSessionItem `json:"recent_sessions"`
	GeneratedAt    time.Time           `json:"generated_at"`
}
