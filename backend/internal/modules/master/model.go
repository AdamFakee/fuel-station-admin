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
}

// ------------------------------------------------------------------------------------------------
// VEHICLE MODELS
// ------------------------------------------------------------------------------------------------

type VehicleListItem struct {
	ID              uuid.UUID  `json:"id"`
	Code            string     `json:"code"`
	Plate           string     `json:"plate"`
	VehicleTypeID   *uuid.UUID `json:"vehicle_type_id,omitempty"`
	VehicleTypeName string     `json:"vehicle_type_name,omitempty"`
	FuelTypeID      uuid.UUID  `json:"fuel_type_id"`
	FuelTypeName    string     `json:"fuel_type_name"`
	Status          string     `json:"status"` // 'active' | 'banned'
	Note            string     `json:"note,omitempty"`
	CardNumber      string     `json:"card_number,omitempty"`
	// Cửa hàng mà xe được phép đổ. Rỗng nghĩa là xe chưa được đổ ở cửa hàng nào.
	BranchIDs   []uuid.UUID `json:"branch_ids"`
	BranchNames []string    `json:"branch_names"`
	Version     int64       `json:"version"`
	CreatedAt   time.Time   `json:"created_at"`
	UpdatedAt   time.Time   `json:"updated_at"`
}

type VehicleDetail struct {
	VehicleListItem
	CardCredential *CredentialItem `json:"card_credential,omitempty"`
}

type CreateVehicleRequest struct {
	// Cửa hàng được phép đổ (tùy chọn; không chọn thì xe chưa đổ được ở đâu).
	BranchIDs     []uuid.UUID `json:"branch_ids"`
	Code          string      `json:"code"`
	Plate         string      `json:"plate"`
	VehicleTypeID *uuid.UUID  `json:"vehicle_type_id"`
	FuelTypeID    uuid.UUID   `json:"fuel_type_id"`
	Note          string      `json:"note"`
	CardNumber    string      `json:"card_number"`
}

type UpdateVehicleRequest struct {
	BranchIDs     []uuid.UUID `json:"branch_ids"`
	Plate         string      `json:"plate"`
	VehicleTypeID *uuid.UUID  `json:"vehicle_type_id"`
	FuelTypeID    uuid.UUID   `json:"fuel_type_id"`
	Note          string      `json:"note"`
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
}

// ------------------------------------------------------------------------------------------------
// DRIVER MODELS
// ------------------------------------------------------------------------------------------------

type DriverListItem struct {
	ID             uuid.UUID  `json:"id"`
	Code           string     `json:"code"`
	FullName       string     `json:"full_name"`
	Phone          string     `json:"phone,omitempty"`
	Department     string     `json:"department,omitempty"`
	Status         string     `json:"status"` // 'active' | 'blocked' | 'inactive'
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
	Code       string     `json:"code"`
	FullName   string     `json:"full_name"`
	Phone      string     `json:"phone"`
	Department string     `json:"department"`
	Status     string     `json:"status"` // 'active' | 'blocked' | 'inactive'
	ValidFrom  *time.Time `json:"valid_from"`
	ValidTo    *time.Time `json:"valid_to"`
	Note       string     `json:"note"`
	CardNumber string     `json:"card_number"`
}

type UpdateDriverRequest struct {
	FullName   string     `json:"full_name"`
	Phone      string     `json:"phone"`
	Department string     `json:"department"`
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
	Status     string
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

// ---------------------------------------------------------------------------------------------------
// Nhập tài xế hàng loạt (từ Excel)
// ---------------------------------------------------------------------------------------------------

// MaxImportRows là số dòng tối đa của một lần nhập.
const MaxImportRows = 500

type ImportDriversRequest struct {
	Rows []CreateDriverRequest `json:"rows"`
}

// ImportRowError là một dòng nhập bị từ chối. Row đếm từ 1 theo thứ tự trong danh sách gửi lên.
type ImportRowError struct {
	Row     int    `json:"row"`
	Code    string `json:"code"`
	Message string `json:"message"`
}

type ImportDriversResult struct {
	Created int              `json:"created"`
	Failed  []ImportRowError `json:"failed"`
}
