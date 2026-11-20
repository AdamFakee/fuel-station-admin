package edge

import (
	"time"
)

// StationContext holds the authenticated Edge Station identity.
type StationContext struct {
	StationID   string `json:"station_id"`
	TenantID    string `json:"tenant_id"`
	BranchID    string `json:"branch_id"`
	StationCode string `json:"station_code"`
	StationName string `json:"station_name"`
}

// CatalogChangeItem represents a single delta change in catalog.
type CatalogChangeItem struct {
	Seq        int64          `json:"seq"`
	EntityType string         `json:"entity_type"`
	EntityID   string         `json:"entity_id"`
	Version    int64          `json:"version"`
	Deleted    bool           `json:"deleted"`
	ChangedAt  time.Time      `json:"changed_at"`
	Data       map[string]any `json:"data,omitempty"`
}

// CatalogChangesResponse returns a page of catalog changes.
type CatalogChangesResponse struct {
	Changes    []CatalogChangeItem `json:"changes"`
	NextCursor int64               `json:"next_cursor"`
	HasMore    bool                `json:"has_more"`
}

// DispenseSessionEventInput represents a state transition event in a session.
type DispenseSessionEventInput struct {
	FromState  *string   `json:"from_state"`
	ToState    string    `json:"to_state"`
	OccurredAt time.Time `json:"occurred_at"`
}

// CreateDispenseSessionRequest represents incoming dispense session payload from Edge Agent.
type CreateDispenseSessionRequest struct {
	EdgeRef      string                      `json:"edge_ref"`
	PumpID       string                      `json:"pump_id"`
	EdgePumpID   *int64                      `json:"edge_pump_id,omitempty"`
	NozzleID     *string                     `json:"nozzle_id,omitempty"`
	TankID       *string                     `json:"tank_id,omitempty"`
	FuelTypeID   *string                     `json:"fuel_type_id,omitempty"`
	SensorSerial *int64                      `json:"sensor_serial,omitempty"`
	SaleSeq      *int64                      `json:"sale_seq,omitempty"`
	VehicleID    *string                     `json:"vehicle_id,omitempty"`
	VehicleCode  *string                     `json:"vehicle_code,omitempty"`
	VehiclePlate *string                     `json:"vehicle_plate,omitempty"`
	DriverID     *string                     `json:"driver_id,omitempty"`
	DriverCode   *string                     `json:"driver_code,omitempty"`
	DriverName   *string                     `json:"driver_name,omitempty"`
	LimitML      *int64                      `json:"limit_ml,omitempty"`
	DispensedML  int64                       `json:"dispensed_ml"`
	PumpTotalML  *int64                      `json:"pump_total_ml,omitempty"`
	RawHex       *string                     `json:"raw_hex,omitempty"`
	EdgeState    string                      `json:"edge_state"` // completed, enable_failed, timed_out, aborted, cancelled
	Status       string                      `json:"status"`     // completed, cancelled, failed
	PairedAt     *time.Time                  `json:"paired_at,omitempty"`
	UnlockedAt   *time.Time                  `json:"unlocked_at,omitempty"`
	StartedAt    *time.Time                  `json:"started_at,omitempty"`
	FinishedAt   *time.Time                  `json:"finished_at,omitempty"`
	Events       []DispenseSessionEventInput `json:"events,omitempty"`
}

// DispenseSessionResponse returns the created or existing idempotent session.
type DispenseSessionResponse struct {
	ID          string    `json:"id"`
	Code        string    `json:"code"`
	EdgeRef     string    `json:"edge_ref"`
	Status      string    `json:"status"`
	DispensedML int64     `json:"dispensed_ml"`
	ReceivedAt  time.Time `json:"received_at"`
}

// AccessEventInput represents an authentication log event from Edge Agent.
type AccessEventInput struct {
	EdgeRef    string         `json:"edge_ref"`
	OccurredAt time.Time      `json:"occurred_at"`
	Kind       string         `json:"kind"`
	PumpID     *string        `json:"pump_id,omitempty"`
	Method     *string        `json:"method,omitempty"` // card, face, fingerprint
	ExternalID *string        `json:"external_id,omitempty"`
	VehicleID  *string        `json:"vehicle_id,omitempty"`
	DriverID   *string        `json:"driver_id,omitempty"`
	PartyName  *string        `json:"party_name,omitempty"`
	Decision   *string        `json:"decision,omitempty"` // accept, reject
	Reason     *string        `json:"reason,omitempty"`
	SessionID  *string        `json:"session_id,omitempty"`
	Detail     map[string]any `json:"detail,omitempty"`
}

// BatchAccessEventsResponse returns the count of accepted access events.
type BatchAccessEventsResponse struct {
	ReceivedCount int `json:"received_count"`
	InsertedCount int `json:"inserted_count"`
}

// HeartbeatRequest carries Edge Agent status report.
type HeartbeatRequest struct {
	PendingQueue int     `json:"pending_queue"`
	AgentVersion string  `json:"agent_version"`
	LastError    *string `json:"last_error,omitempty"`
}

// HeartbeatResponse returns server status acknowledgment.
type HeartbeatResponse struct {
	Status     string    `json:"status"`
	ServerTime time.Time `json:"server_time"`
}
