package assets

import (
	"time"
)

// ------------------------------------------------------------------------------------------------
// BRANCH MODELS
// ------------------------------------------------------------------------------------------------

type Branch struct {
	ID          string    `json:"id"`
	TenantID    string    `json:"tenant_id"`
	Code        string    `json:"code"`
	Name        string    `json:"name"`
	Address     *string   `json:"address,omitempty"`
	ManagerName *string   `json:"manager_name,omitempty"`
	Phone       *string   `json:"phone,omitempty"`
	Status      string    `json:"status"` // active, inactive
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

type CreateBranchRequest struct {
	Code        string  `json:"code"`
	Name        string  `json:"name"`
	Address     *string `json:"address,omitempty"`
	ManagerName *string `json:"manager_name,omitempty"`
	Phone       *string `json:"phone,omitempty"`
}

type UpdateBranchRequest struct {
	Name        string  `json:"name"`
	Address     *string `json:"address,omitempty"`
	ManagerName *string `json:"manager_name,omitempty"`
	Phone       *string `json:"phone,omitempty"`
	Status      string  `json:"status"` // active, inactive
}

type BranchListQuery struct {
	Search   string
	Status   string
	Page     int
	PageSize int
}

// ------------------------------------------------------------------------------------------------
// FUEL TYPE MODELS
// ------------------------------------------------------------------------------------------------

type FuelType struct {
	ID        string    `json:"id"`
	TenantID  string    `json:"tenant_id"`
	Code      string    `json:"code"`
	Name      string    `json:"name"`
	Active    bool      `json:"active"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

type CreateFuelTypeRequest struct {
	Code string `json:"code"`
	Name string `json:"name"`
}

// ------------------------------------------------------------------------------------------------
// TANK MODELS
// ------------------------------------------------------------------------------------------------

type Tank struct {
	ID                  string    `json:"id"`
	TenantID            string    `json:"tenant_id"`
	BranchID            string    `json:"branch_id"`
	BranchName          string    `json:"branch_name"`
	Code                string    `json:"code"`
	Name                string    `json:"name"`
	FuelTypeID          string    `json:"fuel_type_id"`
	FuelTypeName        string    `json:"fuel_type_name"`
	DesignCapacityML    int64     `json:"design_capacity_ml"`
	MaxUsableCapacityML int64     `json:"max_usable_capacity_ml"`
	LowStockThresholdML int64     `json:"low_stock_threshold_ml"`
	LossTolerancePct    float64   `json:"loss_tolerance_pct"`
	Status              string    `json:"status"` // active, inactive
	CurrentStockML      int64     `json:"current_stock_ml"`
	CreatedAt           time.Time `json:"created_at"`
	UpdatedAt           time.Time `json:"updated_at"`
}

type CreateTankRequest struct {
	BranchID            string  `json:"branch_id"`
	Code                string  `json:"code"`
	Name                string  `json:"name"`
	FuelTypeID          string  `json:"fuel_type_id"`
	DesignCapacityML    int64   `json:"design_capacity_ml"`
	MaxUsableCapacityML int64   `json:"max_usable_capacity_ml"`
	LowStockThresholdML int64   `json:"low_stock_threshold_ml"`
	LossTolerancePct    float64 `json:"loss_tolerance_pct"`
	OpeningStockML      int64   `json:"opening_stock_ml"` // Initial stock ledger opening balance
}

type UpdateTankRequest struct {
	Name                string  `json:"name"`
	FuelTypeID          string  `json:"fuel_type_id"`
	DesignCapacityML    int64   `json:"design_capacity_ml"`
	MaxUsableCapacityML int64   `json:"max_usable_capacity_ml"`
	LowStockThresholdML int64   `json:"low_stock_threshold_ml"`
	LossTolerancePct    float64 `json:"loss_tolerance_pct"`
	Status              string  `json:"status"`
}

type TankListQuery struct {
	Search   string
	BranchID string
	Status   string
	Page     int
	PageSize int
}

// ------------------------------------------------------------------------------------------------
// PUMP, NOZZLE & DEVICE MODELS
// ------------------------------------------------------------------------------------------------

type Nozzle struct {
	ID        string    `json:"id"`
	TenantID  string    `json:"tenant_id"`
	PumpID    string    `json:"pump_id"`
	NozzleNo  int       `json:"nozzle_no"`
	TankID    string    `json:"tank_id"`
	TankName  string    `json:"tank_name"`
	Status    string    `json:"status"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

type PumpSensor struct {
	ID        string    `json:"id"`
	TenantID  string    `json:"tenant_id"`
	PumpID    string    `json:"pump_id"`
	Name      string    `json:"name"` // tên gợi nhớ của bộ số, mặc định BS-<mã trụ>
	Serial    uint32    `json:"serial"`
	ComPort   string    `json:"com_port"`
	Baud      int       `json:"baud"`
	Version   int64     `json:"version"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

type AccessTerminal struct {
	ID           string    `json:"id"`
	TenantID     string    `json:"tenant_id"`
	PumpID       string    `json:"pump_id"`
	TerminalCode string    `json:"terminal_code"`
	Host         string    `json:"host"`
	Port         int       `json:"port"`
	HTTPS        bool      `json:"https"`
	Username     string    `json:"username"`
	HasPassword  bool      `json:"has_password"`
	PasswordHint string    `json:"password_hint,omitempty"` // dạng che, chỉ lộ 3 ký tự cuối
	Version      int64     `json:"version"`
	CreatedAt    time.Time `json:"created_at"`
	UpdatedAt    time.Time `json:"updated_at"`
}

type PumpDetail struct {
	ID         string          `json:"id"`
	TenantID   string          `json:"tenant_id"`
	BranchID   string          `json:"branch_id"`
	BranchName string          `json:"branch_name"`
	Code       string          `json:"code"`
	EdgePumpID int64           `json:"edge_pump_id"`
	Name       string          `json:"name"`
	Note       *string         `json:"note,omitempty"`
	Enabled    bool            `json:"enabled"`
	Version    int64           `json:"version"`
	Nozzles    []Nozzle        `json:"nozzles"`
	Sensor     *PumpSensor     `json:"sensor,omitempty"`
	Terminal   *AccessTerminal `json:"terminal,omitempty"`
	CreatedAt  time.Time       `json:"created_at"`
	UpdatedAt  time.Time       `json:"updated_at"`
}

type CreatePumpRequest struct {
	BranchID   string  `json:"branch_id"`
	Code       string  `json:"code"`
	EdgePumpID int64   `json:"edge_pump_id"`
	Name       string  `json:"name"`
	Note       *string `json:"note,omitempty"`
	TankID     string  `json:"tank_id"` // initial nozzle connected tank

	// Bộ số Montech của trụ. Cổng COM là bắt buộc (mỗi trụ một cổng riêng trong trạm xăng); serial mặc định 1234 và được phép trùng giữa các trụ.
	SensorName    *string `json:"sensor_name,omitempty"`
	SensorComPort *string `json:"sensor_com_port,omitempty"`
	SensorSerial  *uint32 `json:"sensor_serial,omitempty"`
	SensorBaud    *int    `json:"sensor_baud,omitempty"`

	// Optional initial terminal configuration
	TerminalCode     *string `json:"terminal_code,omitempty"`
	TerminalHost     *string `json:"terminal_host,omitempty"`
	TerminalPort     *int    `json:"terminal_port,omitempty"`
	TerminalHTTPS    *bool   `json:"terminal_https,omitempty"`
	TerminalUsername *string `json:"terminal_username,omitempty"`
	TerminalPassword *string `json:"terminal_password,omitempty"`
}

type UpdatePumpRequest struct {
	Name    string  `json:"name"`
	Note    *string `json:"note,omitempty"`
	Enabled bool    `json:"enabled"`
}

type UpdateSensorRequest struct {
	Name    string `json:"name"` // để trống thì giữ tên cũ
	Serial  uint32 `json:"serial"`
	ComPort string `json:"com_port"`
	Baud    int    `json:"baud"`
}

type UpdateTerminalRequest struct {
	TerminalCode string  `json:"terminal_code"`
	Host         string  `json:"host"`
	Port         int     `json:"port"`
	HTTPS        bool    `json:"https"`
	Username     string  `json:"username"`
	Password     *string `json:"password,omitempty"` // if provided, re-encrypts
}

type PumpListQuery struct {
	Search   string
	BranchID string
	Enabled  *bool
	Page     int
	PageSize int
}

// DeviceView combines pump, sensor and terminal for /devices screen
type DeviceView struct {
	PumpID     string          `json:"pump_id"`
	PumpCode   string          `json:"pump_code"`
	PumpName   string          `json:"pump_name"`
	BranchID   string          `json:"branch_id"`
	BranchName string          `json:"branch_name"`
	Sensor     *PumpSensor     `json:"sensor,omitempty"`
	Terminal   *AccessTerminal `json:"terminal,omitempty"`
}
