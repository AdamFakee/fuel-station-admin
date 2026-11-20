package quota

import (
	"time"
)

// QuotaRuleListItem represents a quota rule item for listing and detail.
type QuotaRuleListItem struct {
	ID                 string    `json:"id"`
	TenantID           string    `json:"tenant_id"`
	Code               string    `json:"code"`
	TargetType         string    `json:"target_type"` // luôn là 'vehicle' (định mức chỉ áp theo xe)
	TargetID           string    `json:"target_id"`
	TargetCode         string    `json:"target_code"`
	TargetName         string    `json:"target_name"`
	Period             string    `json:"period"` // 'per_dispense', 'day', 'week', 'month'
	MaxVolumeML        int64     `json:"max_volume_ml"`
	MaxVolumeLiters    float64   `json:"max_volume_liters"`
	MinIntervalMinutes int       `json:"min_interval_minutes"`
	EffectiveFrom      string    `json:"effective_from"` // YYYY-MM-DD
	EffectiveTo        *string   `json:"effective_to,omitempty"`
	Status             string    `json:"status"` // 'active', 'cancelled'
	CreatedBy          *string   `json:"created_by,omitempty"`
	CreatedAt          time.Time `json:"created_at"`
	UpdatedAt          time.Time `json:"updated_at"`
}

// CreateQuotaRuleRequest payload for creating a new rule.
type CreateQuotaRuleRequest struct {
	Code               string  `json:"code"`
	TargetType         string  `json:"target_type"` // luôn là 'vehicle' (định mức chỉ áp theo xe)
	TargetID           string  `json:"target_id"`
	Period             string  `json:"period"` // 'per_dispense', 'day', 'week', 'month'
	MaxVolumeLiters    float64 `json:"max_volume_liters"`
	MinIntervalMinutes int     `json:"min_interval_minutes"`
	EffectiveFrom      string  `json:"effective_from"` // YYYY-MM-DD
	EffectiveTo        *string `json:"effective_to,omitempty"`
}

// UpdateQuotaRuleRequest payload for editing an existing rule.
type UpdateQuotaRuleRequest struct {
	MaxVolumeLiters    float64 `json:"max_volume_liters"`
	MinIntervalMinutes int     `json:"min_interval_minutes"`
	EffectiveTo        *string `json:"effective_to,omitempty"`
}

// QuotaExtraListItem represents an emergency extra quota grant.
type QuotaExtraListItem struct {
	ID                string    `json:"id"`
	TenantID          string    `json:"tenant_id"`
	VehicleID         string    `json:"vehicle_id"`
	VehiclePlate      string    `json:"vehicle_plate"`
	VehicleCode       string    `json:"vehicle_code"`
	ExtraVolumeML     int64     `json:"extra_volume_ml"`
	ExtraVolumeLiters float64   `json:"extra_volume_liters"`
	ValidFrom         time.Time `json:"valid_from"`
	ValidTo           time.Time `json:"valid_to"`
	Reason            string    `json:"reason"`
	GrantedBy         string    `json:"granted_by"`
	GrantedByName     string    `json:"granted_by_name"`
	CreatedAt         time.Time `json:"created_at"`
}

// CreateQuotaExtraRequest payload for granting emergency extra quota.
type CreateQuotaExtraRequest struct {
	VehicleID         string    `json:"vehicle_id"`
	ExtraVolumeLiters float64   `json:"extra_volume_liters"`
	ValidFrom         time.Time `json:"valid_from"`
	ValidTo           time.Time `json:"valid_to"`
	Reason            string    `json:"reason"`
}

// TargetOption represents an selectable entity (vehicle, group, route).
type TargetOption struct {
	ID   string `json:"id"`
	Code string `json:"code"`
	Name string `json:"name"`
	Type string `json:"type"` // luôn là 'vehicle' (định mức chỉ áp theo xe)
}

// QuotaTargets lists available targets for creating rules.
type QuotaTargets struct {
	Vehicles []TargetOption `json:"vehicles"`
}
