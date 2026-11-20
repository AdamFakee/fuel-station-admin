package syncmonitor

import "time"

// EdgeStationStatus represents runtime sync & connectivity status of an Edge Agent.
type EdgeStationStatus struct {
	ID           string     `json:"id"`
	BranchID     string     `json:"branch_id"`
	BranchCode   string     `json:"branch_code"`
	BranchName   string     `json:"branch_name"`
	Code         string     `json:"code"`
	Name         string     `json:"name"`
	Status       string     `json:"status"` // active, inactive
	IsOnline     bool       `json:"is_online"`
	LastSeenAt   *time.Time `json:"last_seen_at,omitempty"`
	LastSyncAt   *time.Time `json:"last_sync_at,omitempty"`
	PendingQueue int        `json:"pending_queue"`
	AgentVersion *string    `json:"agent_version,omitempty"`
	LastError    *string    `json:"last_error,omitempty"`
	CreatedAt    time.Time  `json:"created_at"`
	UpdatedAt    time.Time  `json:"updated_at"`
}

// SyncMonitorSummary holds aggregated operational indicators.
type SyncMonitorSummary struct {
	TotalStations     int `json:"total_stations"`
	OnlineStations    int `json:"online_stations"`
	OfflineStations   int `json:"offline_stations"`
	TotalPendingQueue int `json:"total_pending_queue"`
	ErrorStations     int `json:"error_stations"`
}

// SyncMonitorResponse wraps station list and summary metrics.
type SyncMonitorResponse struct {
	Summary  SyncMonitorSummary  `json:"summary"`
	Stations []EdgeStationStatus `json:"stations"`
}
