package master

import (
	"time"

	"github.com/google/uuid"
)

// ------------------------------------------------------------------------------------------------
// CATALOG MODELS
// ------------------------------------------------------------------------------------------------

type CatalogItem struct {
	ID        uuid.UUID `json:"id"`
	Code      string    `json:"code"`
	Name      string    `json:"name"`
	Active    bool      `json:"active"`
	CreatedAt time.Time `json:"created_at"`
}

type BranchOption struct {
	ID   uuid.UUID `json:"id"`
	Code string    `json:"code"`
	Name string    `json:"name"`
}

type CatalogsSummary struct {
	Branches     []BranchOption `json:"branches"`
	FuelTypes    []CatalogItem  `json:"fuel_types"`
	VehicleTypes []CatalogItem  `json:"vehicle_types"`
	Groups       []CatalogItem  `json:"groups"`
	Routes       []CatalogItem  `json:"routes"`
}

// ------------------------------------------------------------------------------------------------
// VEHICLE MODELS
// ------------------------------------------------------------------------------------------------

type VehicleListItem struct {
	ID               uuid.UUID  `json:"id"`
	BranchID         uuid.UUID  `json:"branch_id"`
	BranchName       string     `json:"branch_name"`
	Code             string     `json:"code"`
	Plate            string     `json:"plate"`
	VehicleTypeID    *uuid.UUID `json:"vehicle_type_id,omitempty"`
	VehicleTypeName  string     `json:"vehicle_type_name,omitempty"`
	FuelTypeID       uuid.UUID  `json:"fuel_type_id"`
	FuelTypeName     string     `json:"fuel_type_name"`
	RouteID          *uuid.UUID `json:"route_id,omitempty"`
	RouteName        string     `json:"route_name,omitempty"`
	TankCapacityML   *int64     `json:"tank_capacity_ml,omitempty"`
	TankCapacityL    *float64   `json:"tank_capacity_liters,omitempty"`
	Status           string     `json:"status"` // 'active' | 'banned'
	Note             string     `json:"note,omitempty"`
	CardNumber       string     `json:"card_number,omitempty"`
	GroupIDs         []uuid.UUID `json:"group_ids"`
	GroupNames       []string   `json:"group_names"`
	Version          int64      `json:"version"`
	CreatedAt        time.Time  `json:"created_at"`
	UpdatedAt        time.Time  `json:"updated_at"`
}

type VehicleDetail struct {
	VehicleListItem
	CardCredential *CredentialItem `json:"card_credential,omitempty"`
}

type CreateVehicleRequest struct {
	BranchID        uuid.UUID   `json:"branch_id"`
	Code            string      `json:"code"`
	Plate           string      `json:"plate"`
	VehicleTypeID   *uuid.UUID  `json:"vehicle_type_id"`
	FuelTypeID      uuid.UUID   `json:"fuel_type_id"`
	RouteID         *uuid.UUID  `json:"route_id"`
	TankCapacityML  *int64      `json:"tank_capacity_ml"`
	TankCapacityL   *float64    `json:"tank_capacity_liters"`
	Note            string      `json:"note"`
	CardNumber      string      `json:"card_number"`
	GroupIDs        []uuid.UUID `json:"group_ids"`
}

type UpdateVehicleRequest struct {
	BranchID       uuid.UUID   `json:"branch_id"`
	Plate          string      `json:"plate"`
	VehicleTypeID  *uuid.UUID  `json:"vehicle_type_id"`
	FuelTypeID     uuid.UUID   `json:"fuel_type_id"`
	RouteID        *uuid.UUID  `json:"route_id"`
	TankCapacityML *int64      `json:"tank_capacity_ml"`
	TankCapacityL  *float64    `json:"tank_capacity_liters"`
	Note           string      `json:"note"`
	GroupIDs       []uuid.UUID `json:"group_ids"`
}

type UpdateVehicleStatusRequest struct {
	Status string `json:"status"` // 'active' | 'banned'
}

type AssignVehicleCardRequest struct {
	CardNumber string `json:"card_number"`
}

type VehicleListQuery struct {
	Page          int
	PageSize      int
	Search        string
	BranchID      *uuid.UUID
	Status        string
	VehicleTypeID *uuid.UUID
	FuelTypeID    *uuid.UUID
	RouteID       *uuid.UUID
	GroupID       *uuid.UUID
}

// ------------------------------------------------------------------------------------------------
// DRIVER MODELS
// ------------------------------------------------------------------------------------------------

type DriverListItem struct {
	ID             uuid.UUID  `json:"id"`
	BranchID       uuid.UUID  `json:"branch_id"`
	BranchName     string     `json:"branch_name"`
	Code           string     `json:"code"`
	FullName       string     `json:"full_name"`
	Phone          string     `json:"phone,omitempty"`
	Department     string     `json:"department,omitempty"`
	Position       string     `json:"position"` // 'driver' | 'guard' | 'operator'
	Status         string     `json:"status"`   // 'active' | 'blocked' | 'inactive'
	ValidFrom      *time.Time `json:"valid_from,omitempty"`
	ValidTo        *time.Time `json:"valid_to,omitempty"`
	Note           string     `json:"note,omitempty"`
	CardNumber     string     `json:"card_number,omitempty"`
	HasFace        bool       `json:"has_face"`
	HasFingerprint bool       `json:"has_fingerprint"`
	FaceFileID     *uuid.UUID `json:"face_file_id,omitempty"`
	Version        int64      `json:"version"`
	CreatedAt      time.Time  `json:"created_at"`
	UpdatedAt      time.Time  `json:"updated_at"`
}

type DriverDetail struct {
	DriverListItem
	Credentials []CredentialItem `json:"credentials"`
}

type CreateDriverRequest struct {
	BranchID   uuid.UUID  `json:"branch_id"`
	Code       string     `json:"code"`
	FullName   string     `json:"full_name"`
	Phone      string     `json:"phone"`
	Department string     `json:"department"`
	Position   string     `json:"position"` // 'driver' | 'guard' | 'operator'
	Status     string     `json:"status"`   // 'active' | 'blocked' | 'inactive'
	ValidFrom  *time.Time `json:"valid_from"`
	ValidTo    *time.Time `json:"valid_to"`
	Note       string     `json:"note"`
	CardNumber string     `json:"card_number"`
}

type UpdateDriverRequest struct {
	BranchID   uuid.UUID  `json:"branch_id"`
	FullName   string     `json:"full_name"`
	Phone      string     `json:"phone"`
	Department string     `json:"department"`
	Position   string     `json:"position"`
	ValidFrom  *time.Time `json:"valid_from"`
	ValidTo    *time.Time `json:"valid_to"`
	Note       string     `json:"note"`
}

type UpdateDriverStatusRequest struct {
	Status string `json:"status"` // 'active' | 'blocked' | 'inactive'
}

type AssignDriverCardRequest struct {
	CardNumber string `json:"card_number"`
}

type RegisterDriverFingerprintRequest struct {
	BiometricTemplateID string `json:"biometric_template_id"`
}

type DriverListQuery struct {
	Page       int
	PageSize   int
	Search     string
	BranchID   *uuid.UUID
	Status     string
	Position   string
	Department string
}

// ------------------------------------------------------------------------------------------------
// CREDENTIAL MODELS
// ------------------------------------------------------------------------------------------------

type CredentialItem struct {
	ID                  uuid.UUID  `json:"id"`
	Method              string     `json:"method"` // 'card' | 'face' | 'fingerprint'
	ExternalID          string     `json:"external_id"`
	Status              string     `json:"status"` // 'active' | 'revoked'
	FaceFileID          *uuid.UUID `json:"face_file_id,omitempty"`
	BiometricTemplateID string     `json:"biometric_template_id,omitempty"`
	Version             int64      `json:"version"`
	CreatedAt           time.Time  `json:"created_at"`
	RevokedAt           *time.Time `json:"revoked_at,omitempty"`
}
