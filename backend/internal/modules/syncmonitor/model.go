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
	// HasStation là false khi chi nhánh chưa có trạm Edge (ID, Code rỗng): chưa cấp khóa lần nào.
	HasStation bool `json:"has_station"`
	// HasAPIKey cho biết trạm đang có khóa API còn hiệu lực. Khóa thật và bản băm không bao giờ trả ra.
	HasAPIKey bool `json:"has_api_key"`
	// APIKeyHint là 7 ký tự cuối của khóa đang dùng, để nhận ra khóa. Rỗng khi chưa cấp hoặc khóa cấp từ trước khi có gợi ý.
	APIKeyHint *string `json:"api_key_hint,omitempty"`
}

// IssuedAPIKey là kết quả cấp khóa. APIKey chỉ xuất hiện đúng một lần trong phản hồi này, server chỉ giữ bản băm.
type IssuedAPIKey struct {
	BranchID string `json:"branch_id"`
	// StationCode là giá trị `station_id` điền vào edge.conf của mini server.
	StationCode string    `json:"station_code"`
	APIKey      string    `json:"api_key"`
	IssuedAt    time.Time `json:"issued_at"`
	// Reissued là true khi trạm đã có khóa trước đó (khóa cũ mất hiệu lực ngay).
	Reissued bool `json:"reissued"`
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
