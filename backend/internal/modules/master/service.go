package master

import (
	"context"
	"errors"
	"fmt"
	"io"
	"regexp"
	"strings"
	"time"

	"fuel-station-backend/internal/shared/apperr"
	"fuel-station-backend/internal/shared/audit"
	"fuel-station-backend/internal/shared/authz"
	"fuel-station-backend/internal/shared/middleware"
	"fuel-station-backend/internal/shared/storage"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

var (
	rxMachineCode = regexp.MustCompile(`^[A-Za-z0-9]{1,32}$`)
	rxCardNumber  = regexp.MustCompile(`^[0-9]{1,32}$`)
)

const MaxFaceImageSizeBytes = 200 * 1024 // 200 KB per BRD for terminal facial recognition sync

type Service struct {
	pool    *pgxpool.Pool
	storage storage.Storage
}

func NewService(pool *pgxpool.Pool, storage storage.Storage) *Service {
	return &Service{
		pool:    pool,
		storage: storage,
	}
}

func getTenantAndActor(ctx context.Context) (tenantID, actorUserID uuid.UUID, actorName string, err error) {
	tenantIDStr, ok := middleware.TenantIDFromContext(ctx)
	if !ok || tenantIDStr == "" {
		return uuid.Nil, uuid.Nil, "", fmt.Errorf("%w: tenant_id missing in context", apperr.ErrUnauthorized)
	}
	tID, err := uuid.Parse(tenantIDStr)
	if err != nil {
		return uuid.Nil, uuid.Nil, "", fmt.Errorf("%w: invalid tenant_id in context", apperr.ErrUnauthorized)
	}

	p, ok := authz.FromContext(ctx)
	if !ok || p.UserID == "" {
		return tID, uuid.Nil, "system", nil
	}
	uID, err := uuid.Parse(p.UserID)
	if err != nil {
		return tID, uuid.Nil, p.UserID, nil
	}
	return tID, uID, p.UserID, nil
}

// ------------------------------------------------------------------------------------------------
// CATALOGS SUMMARY
// ------------------------------------------------------------------------------------------------

func (s *Service) GetCatalogsSummary(ctx context.Context) (*CatalogsSummary, error) {
	tenantID, _, _, err := getTenantAndActor(ctx)
	if err != nil {
		return nil, err
	}

	summary := &CatalogsSummary{
		Branches:     make([]BranchOption, 0),
		FuelTypes:    make([]CatalogItem, 0),
		VehicleTypes: make([]CatalogItem, 0),
		Groups:       make([]CatalogItem, 0),
		Routes:       make([]CatalogItem, 0),
	}

	// 1. Branches
	bRows, err := s.pool.Query(ctx, `
		SELECT id, code, name
		FROM station.branch
		WHERE tenant_id = $1 AND status = 'active'
		ORDER BY name ASC
	`, tenantID)
	if err != nil {
		return nil, fmt.Errorf("query branches: %w", err)
	}
	defer bRows.Close()
	for bRows.Next() {
		var b BranchOption
		if err := bRows.Scan(&b.ID, &b.Code, &b.Name); err != nil {
			return nil, fmt.Errorf("scan branch: %w", err)
		}
		summary.Branches = append(summary.Branches, b)
	}

	// 2. Fuel Types
	fRows, err := s.pool.Query(ctx, `
		SELECT id, code, name, active, created_at
		FROM station.fuel_type
		WHERE tenant_id = $1 AND active = true
		ORDER BY name ASC
	`, tenantID)
	if err != nil {
		return nil, fmt.Errorf("query fuel types: %w", err)
	}
	defer fRows.Close()
	for fRows.Next() {
		var f CatalogItem
		if err := fRows.Scan(&f.ID, &f.Code, &f.Name, &f.Active, &f.CreatedAt); err != nil {
			return nil, fmt.Errorf("scan fuel type: %w", err)
		}
		summary.FuelTypes = append(summary.FuelTypes, f)
	}

	// 3. Vehicle Types
	vtRows, err := s.pool.Query(ctx, `
		SELECT id, code, name, active, created_at
		FROM station.vehicle_type
		WHERE tenant_id = $1 AND active = true
		ORDER BY name ASC
	`, tenantID)
	if err != nil {
		return nil, fmt.Errorf("query vehicle types: %w", err)
	}
	defer vtRows.Close()
	for vtRows.Next() {
		var vt CatalogItem
		if err := vtRows.Scan(&vt.ID, &vt.Code, &vt.Name, &vt.Active, &vt.CreatedAt); err != nil {
			return nil, fmt.Errorf("scan vehicle type: %w", err)
		}
		summary.VehicleTypes = append(summary.VehicleTypes, vt)
	}

	// 4. Vehicle Groups
	gRows, err := s.pool.Query(ctx, `
		SELECT id, code, name, true, created_at
		FROM station.vehicle_group
		WHERE tenant_id = $1
		ORDER BY name ASC
	`, tenantID)
	if err != nil {
		return nil, fmt.Errorf("query groups: %w", err)
	}
	defer gRows.Close()
	for gRows.Next() {
		var g CatalogItem
		if err := gRows.Scan(&g.ID, &g.Code, &g.Name, &g.Active, &g.CreatedAt); err != nil {
			return nil, fmt.Errorf("scan group: %w", err)
		}
		summary.Groups = append(summary.Groups, g)
	}

	// 5. Routes
	rRows, err := s.pool.Query(ctx, `
		SELECT id, code, name, true, created_at
		FROM station.route
		WHERE tenant_id = $1
		ORDER BY name ASC
	`, tenantID)
	if err != nil {
		return nil, fmt.Errorf("query routes: %w", err)
	}
	defer rRows.Close()
	for rRows.Next() {
		var r CatalogItem
		if err := rRows.Scan(&r.ID, &r.Code, &r.Name, &r.Active, &r.CreatedAt); err != nil {
			return nil, fmt.Errorf("scan route: %w", err)
		}
		summary.Routes = append(summary.Routes, r)
	}

	return summary, nil
}

// ------------------------------------------------------------------------------------------------
// VEHICLE SERVICES
// ------------------------------------------------------------------------------------------------

func (s *Service) ListVehicles(ctx context.Context, q VehicleListQuery) ([]VehicleListItem, int, error) {
	tenantID, _, _, err := getTenantAndActor(ctx)
	if err != nil {
		return nil, 0, err
	}

	if q.Page < 1 {
		q.Page = 1
	}
	if q.PageSize <= 0 || q.PageSize > 100 {
		q.PageSize = 20
	}
	offset := (q.Page - 1) * q.PageSize

	whereClauses := []string{
		"v.tenant_id = $1",
		"v.deleted_at IS NULL",
	}
	args := []any{tenantID}
	argIdx := 2

	if q.Search != "" {
		trimmed := strings.TrimSpace(q.Search)
		whereClauses = append(whereClauses, fmt.Sprintf("(v.code ILIKE $%d OR v.plate ILIKE $%d OR v.note ILIKE $%d)", argIdx, argIdx, argIdx))
		args = append(args, "%"+trimmed+"%")
		argIdx++
	}

	if q.BranchID != nil {
		whereClauses = append(whereClauses, fmt.Sprintf("v.branch_id = $%d", argIdx))
		args = append(args, *q.BranchID)
		argIdx++
	}

	if q.Status != "" {
		whereClauses = append(whereClauses, fmt.Sprintf("v.status = $%d", argIdx))
		args = append(args, q.Status)
		argIdx++
	}

	if q.VehicleTypeID != nil {
		whereClauses = append(whereClauses, fmt.Sprintf("v.vehicle_type_id = $%d", argIdx))
		args = append(args, *q.VehicleTypeID)
		argIdx++
	}

	if q.FuelTypeID != nil {
		whereClauses = append(whereClauses, fmt.Sprintf("v.fuel_type_id = $%d", argIdx))
		args = append(args, *q.FuelTypeID)
		argIdx++
	}

	if q.RouteID != nil {
		whereClauses = append(whereClauses, fmt.Sprintf("v.route_id = $%d", argIdx))
		args = append(args, *q.RouteID)
		argIdx++
	}

	if q.GroupID != nil {
		whereClauses = append(whereClauses, fmt.Sprintf("EXISTS (SELECT 1 FROM station.vehicle_group_member gm WHERE gm.tenant_id = v.tenant_id AND gm.vehicle_id = v.id AND gm.group_id = $%d)", argIdx))
		args = append(args, *q.GroupID)
		argIdx++
	}

	whereSQL := strings.Join(whereClauses, " AND ")

	countSQL := fmt.Sprintf(`SELECT COUNT(*) FROM station.vehicle v WHERE %s`, whereSQL)
	var total int
	if err := s.pool.QueryRow(ctx, countSQL, args...).Scan(&total); err != nil {
		return nil, 0, fmt.Errorf("count vehicles: %w", err)
	}

	querySQL := fmt.Sprintf(`
		SELECT 
			v.id, v.branch_id, b.name AS branch_name, v.code, v.plate,
			v.vehicle_type_id, COALESCE(vt.name, '') AS vehicle_type_name,
			v.fuel_type_id, ft.name AS fuel_type_name,
			v.route_id, COALESCE(r.name, '') AS route_name,
			v.tank_capacity_ml, v.status, COALESCE(v.note, '') AS note,
			COALESCE(c.external_id, '') AS card_number,
			v.version, v.created_at, v.updated_at
		FROM station.vehicle v
		JOIN station.branch b ON b.tenant_id = v.tenant_id AND b.id = v.branch_id
		JOIN station.fuel_type ft ON ft.tenant_id = v.tenant_id AND ft.id = v.fuel_type_id
		LEFT JOIN station.vehicle_type vt ON vt.tenant_id = v.tenant_id AND vt.id = v.vehicle_type_id
		LEFT JOIN station.route r ON r.tenant_id = v.tenant_id AND r.id = v.route_id
		LEFT JOIN station.credential c ON c.tenant_id = v.tenant_id AND c.vehicle_id = v.id AND c.method = 'card' AND c.status = 'active'
		WHERE %s
		ORDER BY v.created_at DESC
		LIMIT $%d OFFSET $%d
	`, whereSQL, argIdx, argIdx+1)

	args = append(args, q.PageSize, offset)

	rows, err := s.pool.Query(ctx, querySQL, args...)
	if err != nil {
		return nil, 0, fmt.Errorf("query vehicles: %w", err)
	}
	defer rows.Close()

	items := make([]VehicleListItem, 0)
	vehicleIDs := make([]uuid.UUID, 0)

	for rows.Next() {
		var item VehicleListItem
		err := rows.Scan(
			&item.ID, &item.BranchID, &item.BranchName, &item.Code, &item.Plate,
			&item.VehicleTypeID, &item.VehicleTypeName,
			&item.FuelTypeID, &item.FuelTypeName,
			&item.RouteID, &item.RouteName,
			&item.TankCapacityML, &item.Status, &item.Note,
			&item.CardNumber,
			&item.Version, &item.CreatedAt, &item.UpdatedAt,
		)
		if err != nil {
			return nil, 0, fmt.Errorf("scan vehicle: %w", err)
		}
		if item.TankCapacityML != nil && *item.TankCapacityML > 0 {
			liters := float64(*item.TankCapacityML) / 1000.0
			item.TankCapacityL = &liters
		}
		item.GroupIDs = make([]uuid.UUID, 0)
		item.GroupNames = make([]string, 0)
		items = append(items, item)
		vehicleIDs = append(vehicleIDs, item.ID)
	}

	// Fetch groups for returned vehicles
	if len(vehicleIDs) > 0 {
		groupRows, err := s.pool.Query(ctx, `
			SELECT gm.vehicle_id, g.id, g.name
			FROM station.vehicle_group_member gm
			JOIN station.vehicle_group g ON g.tenant_id = gm.tenant_id AND g.id = gm.group_id
			WHERE gm.tenant_id = $1 AND gm.vehicle_id = ANY($2)
			ORDER BY g.name ASC
		`, tenantID, vehicleIDs)
		if err == nil {
			defer groupRows.Close()
			groupMap := make(map[uuid.UUID][]uuid.UUID)
			groupNameMap := make(map[uuid.UUID][]string)
			for groupRows.Next() {
				var vID, gID uuid.UUID
				var gName string
				if err := groupRows.Scan(&vID, &gID, &gName); err == nil {
					groupMap[vID] = append(groupMap[vID], gID)
					groupNameMap[vID] = append(groupNameMap[vID], gName)
				}
			}
			for i := range items {
				if gIDs, ok := groupMap[items[i].ID]; ok {
					items[i].GroupIDs = gIDs
					items[i].GroupNames = groupNameMap[items[i].ID]
				}
			}
		}
	}

	return items, total, nil
}

func (s *Service) GetVehicle(ctx context.Context, id uuid.UUID) (*VehicleDetail, error) {
	tenantID, _, _, err := getTenantAndActor(ctx)
	if err != nil {
		return nil, err
	}

	var d VehicleDetail
	err = s.pool.QueryRow(ctx, `
		SELECT 
			v.id, v.branch_id, b.name AS branch_name, v.code, v.plate,
			v.vehicle_type_id, COALESCE(vt.name, '') AS vehicle_type_name,
			v.fuel_type_id, ft.name AS fuel_type_name,
			v.route_id, COALESCE(r.name, '') AS route_name,
			v.tank_capacity_ml, v.status, COALESCE(v.note, '') AS note,
			COALESCE(c.external_id, '') AS card_number,
			v.version, v.created_at, v.updated_at
		FROM station.vehicle v
		JOIN station.branch b ON b.tenant_id = v.tenant_id AND b.id = v.branch_id
		JOIN station.fuel_type ft ON ft.tenant_id = v.tenant_id AND ft.id = v.fuel_type_id
		LEFT JOIN station.vehicle_type vt ON vt.tenant_id = v.tenant_id AND vt.id = v.vehicle_type_id
		LEFT JOIN station.route r ON r.tenant_id = v.tenant_id AND r.id = v.route_id
		LEFT JOIN station.credential c ON c.tenant_id = v.tenant_id AND c.vehicle_id = v.id AND c.method = 'card' AND c.status = 'active'
		WHERE v.tenant_id = $1 AND v.id = $2 AND v.deleted_at IS NULL
	`, tenantID, id).Scan(
		&d.ID, &d.BranchID, &d.BranchName, &d.Code, &d.Plate,
		&d.VehicleTypeID, &d.VehicleTypeName,
		&d.FuelTypeID, &d.FuelTypeName,
		&d.RouteID, &d.RouteName,
		&d.TankCapacityML, &d.Status, &d.Note,
		&d.CardNumber,
		&d.Version, &d.CreatedAt, &d.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, fmt.Errorf("%w: vehicle not found", apperr.ErrNotFound)
		}
		return nil, fmt.Errorf("get vehicle: %w", err)
	}

	if d.TankCapacityML != nil && *d.TankCapacityML > 0 {
		liters := float64(*d.TankCapacityML) / 1000.0
		d.TankCapacityL = &liters
	}

	// Active Card Credential
	var cred CredentialItem
	credErr := s.pool.QueryRow(ctx, `
		SELECT id, method, external_id, status, face_file_id, biometric_template_id, version, created_at, revoked_at
		FROM station.credential
		WHERE tenant_id = $1 AND vehicle_id = $2 AND method = 'card' AND status = 'active'
	`, tenantID, id).Scan(
		&cred.ID, &cred.Method, &cred.ExternalID, &cred.Status,
		&cred.FaceFileID, &cred.BiometricTemplateID, &cred.Version, &cred.CreatedAt, &cred.RevokedAt,
	)
	if credErr == nil {
		d.CardCredential = &cred
	}

	// Group assignments
	d.GroupIDs = make([]uuid.UUID, 0)
	d.GroupNames = make([]string, 0)
	gRows, err := s.pool.Query(ctx, `
		SELECT g.id, g.name
		FROM station.vehicle_group_member gm
		JOIN station.vehicle_group g ON g.tenant_id = gm.tenant_id AND g.id = gm.group_id
		WHERE gm.tenant_id = $1 AND gm.vehicle_id = $2
		ORDER BY g.name ASC
	`, tenantID, id)
	if err == nil {
		defer gRows.Close()
		for gRows.Next() {
			var gID uuid.UUID
			var gName string
			if err := gRows.Scan(&gID, &gName); err == nil {
				d.GroupIDs = append(d.GroupIDs, gID)
				d.GroupNames = append(d.GroupNames, gName)
			}
		}
	}

	return &d, nil
}

func (s *Service) CreateVehicle(ctx context.Context, req CreateVehicleRequest) (*VehicleDetail, error) {
	tenantID, actorID, actorName, err := getTenantAndActor(ctx)
	if err != nil {
		return nil, err
	}

	req.Code = strings.TrimSpace(req.Code)
	if !rxMachineCode.MatchString(req.Code) {
		return nil, fmt.Errorf("%w: vehicle code must be 1-32 alphanumeric characters", apperr.ErrInvalidInput)
	}

	req.Plate = strings.TrimSpace(req.Plate)
	if req.Plate == "" {
		return nil, fmt.Errorf("%w: license plate is required", apperr.ErrInvalidInput)
	}

	if req.BranchID == uuid.Nil {
		return nil, fmt.Errorf("%w: branch is required", apperr.ErrInvalidInput)
	}
	if req.FuelTypeID == uuid.Nil {
		return nil, fmt.Errorf("%w: fuel type is required", apperr.ErrInvalidInput)
	}

	var tankCapacityML *int64
	if req.TankCapacityL != nil && *req.TankCapacityL > 0 {
		ml := int64(*req.TankCapacityL * 1000)
		tankCapacityML = &ml
	} else if req.TankCapacityML != nil && *req.TankCapacityML > 0 {
		tankCapacityML = req.TankCapacityML
	}

	req.CardNumber = strings.TrimSpace(req.CardNumber)
	if req.CardNumber != "" && !rxCardNumber.MatchString(req.CardNumber) {
		return nil, fmt.Errorf("%w: NFC card number must be numeric decimal digits", apperr.ErrInvalidInput)
	}

	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return nil, fmt.Errorf("begin tx: %w", err)
	}
	defer tx.Rollback(ctx)

	// Check code duplicate
	var codeExists bool
	err = tx.QueryRow(ctx, `
		SELECT EXISTS(SELECT 1 FROM station.vehicle WHERE tenant_id = $1 AND code = $2 AND deleted_at IS NULL)
	`, tenantID, req.Code).Scan(&codeExists)
	if err != nil {
		return nil, fmt.Errorf("check code: %w", err)
	}
	if codeExists {
		return nil, fmt.Errorf("%w: vehicle code '%s' already exists", apperr.ErrConflict, req.Code)
	}

	// Check plate duplicate
	var plateExists bool
	err = tx.QueryRow(ctx, `
		SELECT EXISTS(SELECT 1 FROM station.vehicle WHERE tenant_id = $1 AND UPPER(plate) = UPPER($2) AND deleted_at IS NULL)
	`, tenantID, req.Plate).Scan(&plateExists)
	if err != nil {
		return nil, fmt.Errorf("check plate: %w", err)
	}
	if plateExists {
		return nil, fmt.Errorf("%w: license plate '%s' already registered", apperr.ErrConflict, req.Plate)
	}

	// Check card uniqueness if provided
	if req.CardNumber != "" {
		var cardInUse bool
		err = tx.QueryRow(ctx, `
			SELECT EXISTS(SELECT 1 FROM station.credential WHERE tenant_id = $1 AND method = 'card' AND external_id = $2 AND status = 'active')
		`, tenantID, req.CardNumber).Scan(&cardInUse)
		if err != nil {
			return nil, fmt.Errorf("check card: %w", err)
		}
		if cardInUse {
			return nil, fmt.Errorf("%w: NFC card '%s' is already assigned to another vehicle or driver", apperr.ErrConflict, req.CardNumber)
		}
	}

	vehicleID := uuid.New()
	_, err = tx.Exec(ctx, `
		INSERT INTO station.vehicle (
			id, tenant_id, branch_id, code, plate,
			vehicle_type_id, fuel_type_id, route_id,
			tank_capacity_ml, status, note, version, created_at, updated_at
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'active', $10, 1, now(), now())
	`, vehicleID, tenantID, req.BranchID, req.Code, req.Plate,
		req.VehicleTypeID, req.FuelTypeID, req.RouteID,
		tankCapacityML, req.Note)
	if err != nil {
		return nil, fmt.Errorf("insert vehicle: %w", err)
	}

	// Vehicle groups
	for _, gID := range req.GroupIDs {
		_, err = tx.Exec(ctx, `
			INSERT INTO station.vehicle_group_member (tenant_id, group_id, vehicle_id)
			VALUES ($1, $2, $3)
			ON CONFLICT DO NOTHING
		`, tenantID, gID, vehicleID)
		if err != nil {
			return nil, fmt.Errorf("assign group: %w", err)
		}
	}

	// Assign NFC card credential if provided
	if req.CardNumber != "" {
		credID := uuid.New()
		_, err = tx.Exec(ctx, `
			INSERT INTO station.credential (
				id, tenant_id, vehicle_id, method, external_id, status, version, created_at, updated_at
			) VALUES ($1, $2, $3, 'card', $4, 'active', 1, now(), now())
		`, credID, tenantID, vehicleID, req.CardNumber)
		if err != nil {
			return nil, fmt.Errorf("assign card: %w", err)
		}
	}

	// Audit Log
	_ = audit.Record(ctx, tx, audit.Entry{
		Action:      audit.ActionCreate,
		EntityType:  "vehicle",
		EntityID:    &vehicleID,
		EntityCode:  req.Code,
		ActorUserID: &actorID,
		ActorName:   actorName,
		NewData: map[string]any{
			"code":             req.Code,
			"plate":            req.Plate,
			"branch_id":        req.BranchID,
			"fuel_type_id":     req.FuelTypeID,
			"tank_capacity_ml": tankCapacityML,
			"card_number":      req.CardNumber,
			"group_ids":        req.GroupIDs,
		},
	})

	if err := tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("commit tx: %w", err)
	}

	return s.GetVehicle(ctx, vehicleID)
}

func (s *Service) UpdateVehicle(ctx context.Context, id uuid.UUID, req UpdateVehicleRequest) (*VehicleDetail, error) {
	tenantID, actorID, actorName, err := getTenantAndActor(ctx)
	if err != nil {
		return nil, err
	}

	req.Plate = strings.TrimSpace(req.Plate)
	if req.Plate == "" {
		return nil, fmt.Errorf("%w: license plate is required", apperr.ErrInvalidInput)
	}
	if req.BranchID == uuid.Nil {
		return nil, fmt.Errorf("%w: branch is required", apperr.ErrInvalidInput)
	}
	if req.FuelTypeID == uuid.Nil {
		return nil, fmt.Errorf("%w: fuel type is required", apperr.ErrInvalidInput)
	}

	var tankCapacityML *int64
	if req.TankCapacityL != nil && *req.TankCapacityL > 0 {
		ml := int64(*req.TankCapacityL * 1000)
		tankCapacityML = &ml
	} else if req.TankCapacityML != nil && *req.TankCapacityML > 0 {
		tankCapacityML = req.TankCapacityML
	}

	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return nil, fmt.Errorf("begin tx: %w", err)
	}
	defer tx.Rollback(ctx)

	var currentCode string
	var currentPlate string
	err = tx.QueryRow(ctx, `
		SELECT code, plate
		FROM station.vehicle
		WHERE tenant_id = $1 AND id = $2 AND deleted_at IS NULL
	`, tenantID, id).Scan(&currentCode, &currentPlate)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, fmt.Errorf("%w: vehicle not found", apperr.ErrNotFound)
		}
		return nil, fmt.Errorf("query existing vehicle: %w", err)
	}

	// Plate check against other vehicles
	var plateInUse bool
	err = tx.QueryRow(ctx, `
		SELECT EXISTS(
			SELECT 1 FROM station.vehicle 
			WHERE tenant_id = $1 AND UPPER(plate) = UPPER($2) AND id != $3 AND deleted_at IS NULL
		)
	`, tenantID, req.Plate, id).Scan(&plateInUse)
	if err != nil {
		return nil, fmt.Errorf("check plate: %w", err)
	}
	if plateInUse {
		return nil, fmt.Errorf("%w: license plate '%s' is used by another vehicle", apperr.ErrConflict, req.Plate)
	}

	_, err = tx.Exec(ctx, `
		UPDATE station.vehicle
		SET branch_id = $1, plate = $2, vehicle_type_id = $3, fuel_type_id = $4,
		    route_id = $5, tank_capacity_ml = $6, note = $7, updated_at = now()
		WHERE tenant_id = $8 AND id = $9 AND deleted_at IS NULL
	`, req.BranchID, req.Plate, req.VehicleTypeID, req.FuelTypeID,
		req.RouteID, tankCapacityML, req.Note, tenantID, id)
	if err != nil {
		return nil, fmt.Errorf("update vehicle: %w", err)
	}

	// Sync groups
	_, err = tx.Exec(ctx, `DELETE FROM station.vehicle_group_member WHERE tenant_id = $1 AND vehicle_id = $2`, tenantID, id)
	if err != nil {
		return nil, fmt.Errorf("delete old groups: %w", err)
	}
	for _, gID := range req.GroupIDs {
		_, err = tx.Exec(ctx, `
			INSERT INTO station.vehicle_group_member (tenant_id, group_id, vehicle_id)
			VALUES ($1, $2, $3)
			ON CONFLICT DO NOTHING
		`, tenantID, gID, id)
		if err != nil {
			return nil, fmt.Errorf("assign updated group: %w", err)
		}
	}

	// Audit Log
	_ = audit.Record(ctx, tx, audit.Entry{
		Action:      audit.ActionUpdate,
		EntityType:  "vehicle",
		EntityID:    &id,
		EntityCode:  currentCode,
		ActorUserID: &actorID,
		ActorName:   actorName,
		OldData:     map[string]any{"plate": currentPlate},
		NewData: map[string]any{
			"plate":            req.Plate,
			"branch_id":        req.BranchID,
			"fuel_type_id":     req.FuelTypeID,
			"tank_capacity_ml": tankCapacityML,
			"group_ids":        req.GroupIDs,
		},
	})

	if err := tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("commit tx: %w", err)
	}

	return s.GetVehicle(ctx, id)
}

func (s *Service) UpdateVehicleStatus(ctx context.Context, id uuid.UUID, status string) error {
	tenantID, actorID, actorName, err := getTenantAndActor(ctx)
	if err != nil {
		return err
	}

	if status != "active" && status != "banned" {
		return fmt.Errorf("%w: status must be 'active' or 'banned'", apperr.ErrInvalidInput)
	}

	var code, currentStatus string
	err = s.pool.QueryRow(ctx, `
		SELECT code, status FROM station.vehicle WHERE tenant_id = $1 AND id = $2 AND deleted_at IS NULL
	`, tenantID, id).Scan(&code, &currentStatus)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return fmt.Errorf("%w: vehicle not found", apperr.ErrNotFound)
		}
		return fmt.Errorf("get vehicle status: %w", err)
	}

	if currentStatus == status {
		return nil
	}

	_, err = s.pool.Exec(ctx, `
		UPDATE station.vehicle SET status = $1, updated_at = now() WHERE tenant_id = $2 AND id = $3 AND deleted_at IS NULL
	`, status, tenantID, id)
	if err != nil {
		return fmt.Errorf("update vehicle status: %w", err)
	}

	action := audit.ActionUnlock
	if status == "banned" {
		action = audit.ActionLock
	}

	_ = audit.Record(ctx, s.pool, audit.Entry{
		Action:      action,
		EntityType:  "vehicle",
		EntityID:    &id,
		EntityCode:  code,
		ActorUserID: &actorID,
		ActorName:   actorName,
		OldData:     map[string]any{"status": currentStatus},
		NewData:     map[string]any{"status": status},
	})

	return nil
}

func (s *Service) AssignVehicleCard(ctx context.Context, id uuid.UUID, cardNumber string) error {
	tenantID, actorID, actorName, err := getTenantAndActor(ctx)
	if err != nil {
		return err
	}

	cardNumber = strings.TrimSpace(cardNumber)
	if !rxCardNumber.MatchString(cardNumber) {
		return fmt.Errorf("%w: NFC card number must be numeric decimal digits", apperr.ErrInvalidInput)
	}

	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return fmt.Errorf("begin tx: %w", err)
	}
	defer tx.Rollback(ctx)

	var code string
	err = tx.QueryRow(ctx, `
		SELECT code FROM station.vehicle WHERE tenant_id = $1 AND id = $2 AND deleted_at IS NULL
	`, tenantID, id).Scan(&code)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return fmt.Errorf("%w: vehicle not found", apperr.ErrNotFound)
		}
		return fmt.Errorf("get vehicle: %w", err)
	}

	// Check if this card is currently active on someone else
	var activeOwner string
	err = tx.QueryRow(ctx, `
		SELECT COALESCE(vehicle_id::text, driver_id::text, '')
		FROM station.credential
		WHERE tenant_id = $1 AND method = 'card' AND external_id = $2 AND status = 'active'
	`, tenantID, cardNumber).Scan(&activeOwner)
	if err == nil && activeOwner != "" && activeOwner != id.String() {
		return fmt.Errorf("%w: card '%s' is active on another entity", apperr.ErrConflict, cardNumber)
	}

	// Revoke existing active card for this vehicle
	now := time.Now().UTC()
	_, err = tx.Exec(ctx, `
		UPDATE station.credential
		SET status = 'revoked', revoked_at = $1, updated_at = $1
		WHERE tenant_id = $2 AND vehicle_id = $3 AND method = 'card' AND status = 'active'
	`, now, tenantID, id)
	if err != nil {
		return fmt.Errorf("revoke current card: %w", err)
	}

	// Insert new credential
	credID := uuid.New()
	_, err = tx.Exec(ctx, `
		INSERT INTO station.credential (
			id, tenant_id, vehicle_id, method, external_id, status, version, created_at, updated_at
		) VALUES ($1, $2, $3, 'card', $4, 'active', 1, $5, $5)
	`, credID, tenantID, id, cardNumber, now)
	if err != nil {
		return fmt.Errorf("insert card credential: %w", err)
	}

	_ = audit.Record(ctx, tx, audit.Entry{
		Action:      audit.ActionUpdate,
		EntityType:  "vehicle",
		EntityID:    &id,
		EntityCode:  code,
		ActorUserID: &actorID,
		ActorName:   actorName,
		NewData:     map[string]any{"card_number": cardNumber},
	})

	return tx.Commit(ctx)
}

func (s *Service) RevokeVehicleCard(ctx context.Context, id uuid.UUID) error {
	tenantID, actorID, actorName, err := getTenantAndActor(ctx)
	if err != nil {
		return err
	}

	var code string
	err = s.pool.QueryRow(ctx, `
		SELECT code FROM station.vehicle WHERE tenant_id = $1 AND id = $2 AND deleted_at IS NULL
	`, tenantID, id).Scan(&code)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return fmt.Errorf("%w: vehicle not found", apperr.ErrNotFound)
		}
		return fmt.Errorf("get vehicle: %w", err)
	}

	now := time.Now().UTC()
	cmd, err := s.pool.Exec(ctx, `
		UPDATE station.credential
		SET status = 'revoked', revoked_at = $1, updated_at = $1
		WHERE tenant_id = $2 AND vehicle_id = $3 AND method = 'card' AND status = 'active'
	`, now, tenantID, id)
	if err != nil {
		return fmt.Errorf("revoke vehicle card: %w", err)
	}

	if cmd.RowsAffected() > 0 {
		_ = audit.Record(ctx, s.pool, audit.Entry{
			Action:      audit.ActionUpdate,
			EntityType:  "vehicle",
			EntityID:    &id,
			EntityCode:  code,
			ActorUserID: &actorID,
			ActorName:   actorName,
			NewData:     map[string]any{"card_revoked": true},
		})
	}

	return nil
}

func (s *Service) DeleteVehicle(ctx context.Context, id uuid.UUID) error {
	tenantID, actorID, actorName, err := getTenantAndActor(ctx)
	if err != nil {
		return err
	}

	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return fmt.Errorf("begin tx: %w", err)
	}
	defer tx.Rollback(ctx)

	var code string
	err = tx.QueryRow(ctx, `
		SELECT code FROM station.vehicle WHERE tenant_id = $1 AND id = $2 AND deleted_at IS NULL
	`, tenantID, id).Scan(&code)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return fmt.Errorf("%w: vehicle not found", apperr.ErrNotFound)
		}
		return fmt.Errorf("get vehicle: %w", err)
	}

	now := time.Now().UTC()
	// Soft delete vehicle
	_, err = tx.Exec(ctx, `
		UPDATE station.vehicle SET deleted_at = $1, updated_at = $1 WHERE tenant_id = $2 AND id = $3
	`, now, tenantID, id)
	if err != nil {
		return fmt.Errorf("soft delete vehicle: %w", err)
	}

	// Revoke active credentials
	_, err = tx.Exec(ctx, `
		UPDATE station.credential SET status = 'revoked', revoked_at = $1, updated_at = $1
		WHERE tenant_id = $2 AND vehicle_id = $3 AND status = 'active'
	`, now, tenantID, id)
	if err != nil {
		return fmt.Errorf("revoke credentials: %w", err)
	}

	_ = audit.Record(ctx, tx, audit.Entry{
		Action:      audit.ActionDelete,
		EntityType:  "vehicle",
		EntityID:    &id,
		EntityCode:  code,
		ActorUserID: &actorID,
		ActorName:   actorName,
	})

	return tx.Commit(ctx)
}

// ------------------------------------------------------------------------------------------------
// DRIVER SERVICES
// ------------------------------------------------------------------------------------------------

func (s *Service) ListDrivers(ctx context.Context, q DriverListQuery) ([]DriverListItem, int, error) {
	tenantID, _, _, err := getTenantAndActor(ctx)
	if err != nil {
		return nil, 0, err
	}

	if q.Page < 1 {
		q.Page = 1
	}
	if q.PageSize <= 0 || q.PageSize > 100 {
		q.PageSize = 20
	}
	offset := (q.Page - 1) * q.PageSize

	whereClauses := []string{
		"d.tenant_id = $1",
		"d.deleted_at IS NULL",
	}
	args := []any{tenantID}
	argIdx := 2

	if q.Search != "" {
		trimmed := strings.TrimSpace(q.Search)
		whereClauses = append(whereClauses, fmt.Sprintf("(d.code ILIKE $%d OR d.full_name ILIKE $%d OR d.phone ILIKE $%d OR d.department ILIKE $%d)", argIdx, argIdx, argIdx, argIdx))
		args = append(args, "%"+trimmed+"%")
		argIdx++
	}

	if q.BranchID != nil {
		whereClauses = append(whereClauses, fmt.Sprintf("d.branch_id = $%d", argIdx))
		args = append(args, *q.BranchID)
		argIdx++
	}

	if q.Status != "" {
		whereClauses = append(whereClauses, fmt.Sprintf("d.status = $%d", argIdx))
		args = append(args, q.Status)
		argIdx++
	}

	if q.Position != "" {
		whereClauses = append(whereClauses, fmt.Sprintf("d.position = $%d", argIdx))
		args = append(args, q.Position)
		argIdx++
	}

	if q.Department != "" {
		whereClauses = append(whereClauses, fmt.Sprintf("d.department ILIKE $%d", argIdx))
		args = append(args, "%"+strings.TrimSpace(q.Department)+"%")
		argIdx++
	}

	whereSQL := strings.Join(whereClauses, " AND ")

	countSQL := fmt.Sprintf(`SELECT COUNT(*) FROM station.driver d WHERE %s`, whereSQL)
	var total int
	if err := s.pool.QueryRow(ctx, countSQL, args...).Scan(&total); err != nil {
		return nil, 0, fmt.Errorf("count drivers: %w", err)
	}

	querySQL := fmt.Sprintf(`
		SELECT 
			d.id, d.branch_id, b.name AS branch_name, d.code, d.full_name,
			COALESCE(d.phone, '') AS phone, COALESCE(d.department, '') AS department,
			d.position, d.status, d.valid_from, d.valid_to, COALESCE(d.note, '') AS note,
			COALESCE(card.external_id, '') AS card_number,
			(face.id IS NOT NULL) AS has_face,
			face.face_file_id,
			(fp.id IS NOT NULL) AS has_fingerprint,
			d.version, d.created_at, d.updated_at
		FROM station.driver d
		JOIN station.branch b ON b.tenant_id = d.tenant_id AND b.id = d.branch_id
		LEFT JOIN station.credential card ON card.tenant_id = d.tenant_id AND card.driver_id = d.id AND card.method = 'card' AND card.status = 'active'
		LEFT JOIN station.credential face ON face.tenant_id = d.tenant_id AND face.driver_id = d.id AND face.method = 'face' AND face.status = 'active'
		LEFT JOIN station.credential fp ON fp.tenant_id = d.tenant_id AND fp.driver_id = d.id AND fp.method = 'fingerprint' AND fp.status = 'active'
		WHERE %s
		ORDER BY d.created_at DESC
		LIMIT $%d OFFSET $%d
	`, whereSQL, argIdx, argIdx+1)

	args = append(args, q.PageSize, offset)

	rows, err := s.pool.Query(ctx, querySQL, args...)
	if err != nil {
		return nil, 0, fmt.Errorf("query drivers: %w", err)
	}
	defer rows.Close()

	items := make([]DriverListItem, 0)
	for rows.Next() {
		var item DriverListItem
		err := rows.Scan(
			&item.ID, &item.BranchID, &item.BranchName, &item.Code, &item.FullName,
			&item.Phone, &item.Department, &item.Position, &item.Status,
			&item.ValidFrom, &item.ValidTo, &item.Note,
			&item.CardNumber, &item.HasFace, &item.FaceFileID, &item.HasFingerprint,
			&item.Version, &item.CreatedAt, &item.UpdatedAt,
		)
		if err != nil {
			return nil, 0, fmt.Errorf("scan driver: %w", err)
		}
		items = append(items, item)
	}

	return items, total, nil
}

func (s *Service) GetDriver(ctx context.Context, id uuid.UUID) (*DriverDetail, error) {
	tenantID, _, _, err := getTenantAndActor(ctx)
	if err != nil {
		return nil, err
	}

	var d DriverDetail
	err = s.pool.QueryRow(ctx, `
		SELECT 
			d.id, d.branch_id, b.name AS branch_name, d.code, d.full_name,
			COALESCE(d.phone, '') AS phone, COALESCE(d.department, '') AS department,
			d.position, d.status, d.valid_from, d.valid_to, COALESCE(d.note, '') AS note,
			COALESCE(card.external_id, '') AS card_number,
			(face.id IS NOT NULL) AS has_face,
			face.face_file_id,
			(fp.id IS NOT NULL) AS has_fingerprint,
			d.version, d.created_at, d.updated_at
		FROM station.driver d
		JOIN station.branch b ON b.tenant_id = d.tenant_id AND b.id = d.branch_id
		LEFT JOIN station.credential card ON card.tenant_id = d.tenant_id AND card.driver_id = d.id AND card.method = 'card' AND card.status = 'active'
		LEFT JOIN station.credential face ON face.tenant_id = d.tenant_id AND face.driver_id = d.id AND face.method = 'face' AND face.status = 'active'
		LEFT JOIN station.credential fp ON fp.tenant_id = d.tenant_id AND fp.driver_id = d.id AND fp.method = 'fingerprint' AND fp.status = 'active'
		WHERE d.tenant_id = $1 AND d.id = $2 AND d.deleted_at IS NULL
	`, tenantID, id).Scan(
		&d.ID, &d.BranchID, &d.BranchName, &d.Code, &d.FullName,
		&d.Phone, &d.Department, &d.Position, &d.Status,
		&d.ValidFrom, &d.ValidTo, &d.Note,
		&d.CardNumber, &d.HasFace, &d.FaceFileID, &d.HasFingerprint,
		&d.Version, &d.CreatedAt, &d.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, fmt.Errorf("%w: driver not found", apperr.ErrNotFound)
		}
		return nil, fmt.Errorf("get driver: %w", err)
	}

	// Fetch credentials list
	d.Credentials = make([]CredentialItem, 0)
	cRows, err := s.pool.Query(ctx, `
		SELECT id, method, external_id, status, face_file_id, biometric_template_id, version, created_at, revoked_at
		FROM station.credential
		WHERE tenant_id = $1 AND driver_id = $2
		ORDER BY created_at DESC
	`, tenantID, id)
	if err == nil {
		defer cRows.Close()
		for cRows.Next() {
			var c CredentialItem
			if err := cRows.Scan(
				&c.ID, &c.Method, &c.ExternalID, &c.Status,
				&c.FaceFileID, &c.BiometricTemplateID, &c.Version, &c.CreatedAt, &c.RevokedAt,
			); err == nil {
				d.Credentials = append(d.Credentials, c)
			}
		}
	}

	return &d, nil
}

func (s *Service) CreateDriver(ctx context.Context, req CreateDriverRequest) (*DriverDetail, error) {
	tenantID, actorID, actorName, err := getTenantAndActor(ctx)
	if err != nil {
		return nil, err
	}

	req.Code = strings.TrimSpace(req.Code)
	if !rxMachineCode.MatchString(req.Code) {
		return nil, fmt.Errorf("%w: driver code must be 1-32 alphanumeric characters", apperr.ErrInvalidInput)
	}

	req.FullName = strings.TrimSpace(req.FullName)
	if req.FullName == "" {
		return nil, fmt.Errorf("%w: full name is required", apperr.ErrInvalidInput)
	}

	if req.BranchID == uuid.Nil {
		return nil, fmt.Errorf("%w: branch is required", apperr.ErrInvalidInput)
	}

	if req.Position == "" {
		req.Position = "driver"
	}
	if req.Position != "driver" && req.Position != "guard" && req.Position != "operator" {
		return nil, fmt.Errorf("%w: invalid position (must be driver, guard, operator)", apperr.ErrInvalidInput)
	}

	if req.Status == "" {
		req.Status = "active"
	}
	if req.Status != "active" && req.Status != "blocked" && req.Status != "inactive" {
		return nil, fmt.Errorf("%w: invalid status (must be active, blocked, inactive)", apperr.ErrInvalidInput)
	}

	if req.ValidFrom != nil && req.ValidTo != nil && req.ValidFrom.After(*req.ValidTo) {
		return nil, fmt.Errorf("%w: valid_from cannot be after valid_to", apperr.ErrInvalidInput)
	}

	req.CardNumber = strings.TrimSpace(req.CardNumber)
	if req.CardNumber != "" && !rxCardNumber.MatchString(req.CardNumber) {
		return nil, fmt.Errorf("%w: NFC card number must be numeric decimal digits", apperr.ErrInvalidInput)
	}

	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return nil, fmt.Errorf("begin tx: %w", err)
	}
	defer tx.Rollback(ctx)

	// Check code duplicate
	var codeExists bool
	err = tx.QueryRow(ctx, `
		SELECT EXISTS(SELECT 1 FROM station.driver WHERE tenant_id = $1 AND code = $2 AND deleted_at IS NULL)
	`, tenantID, req.Code).Scan(&codeExists)
	if err != nil {
		return nil, fmt.Errorf("check code: %w", err)
	}
	if codeExists {
		return nil, fmt.Errorf("%w: driver code '%s' already exists", apperr.ErrConflict, req.Code)
	}

	// Check card duplicate
	if req.CardNumber != "" {
		var cardInUse bool
		err = tx.QueryRow(ctx, `
			SELECT EXISTS(SELECT 1 FROM station.credential WHERE tenant_id = $1 AND method = 'card' AND external_id = $2 AND status = 'active')
		`, tenantID, req.CardNumber).Scan(&cardInUse)
		if err != nil {
			return nil, fmt.Errorf("check card: %w", err)
		}
		if cardInUse {
			return nil, fmt.Errorf("%w: NFC card '%s' is already assigned to another vehicle or driver", apperr.ErrConflict, req.CardNumber)
		}
	}

	driverID := uuid.New()
	_, err = tx.Exec(ctx, `
		INSERT INTO station.driver (
			id, tenant_id, branch_id, code, full_name, phone, department,
			position, status, valid_from, valid_to, note, version, created_at, updated_at
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 1, now(), now())
	`, driverID, tenantID, req.BranchID, req.Code, req.FullName,
		req.Phone, req.Department, req.Position, req.Status,
		req.ValidFrom, req.ValidTo, req.Note)
	if err != nil {
		return nil, fmt.Errorf("insert driver: %w", err)
	}

	// Assign card credential if provided
	if req.CardNumber != "" {
		credID := uuid.New()
		_, err = tx.Exec(ctx, `
			INSERT INTO station.credential (
				id, tenant_id, driver_id, method, external_id, status, version, created_at, updated_at
			) VALUES ($1, $2, $3, 'card', $4, 'active', 1, now(), now())
		`, credID, tenantID, driverID, req.CardNumber)
		if err != nil {
			return nil, fmt.Errorf("assign card: %w", err)
		}
	}

	_ = audit.Record(ctx, tx, audit.Entry{
		Action:      audit.ActionCreate,
		EntityType:  "driver",
		EntityID:    &driverID,
		EntityCode:  req.Code,
		ActorUserID: &actorID,
		ActorName:   actorName,
		NewData: map[string]any{
			"code":        req.Code,
			"full_name":   req.FullName,
			"branch_id":   req.BranchID,
			"position":    req.Position,
			"status":      req.Status,
			"card_number": req.CardNumber,
		},
	})

	if err := tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("commit tx: %w", err)
	}

	return s.GetDriver(ctx, driverID)
}

func (s *Service) UpdateDriver(ctx context.Context, id uuid.UUID, req UpdateDriverRequest) (*DriverDetail, error) {
	tenantID, actorID, actorName, err := getTenantAndActor(ctx)
	if err != nil {
		return nil, err
	}

	req.FullName = strings.TrimSpace(req.FullName)
	if req.FullName == "" {
		return nil, fmt.Errorf("%w: full name is required", apperr.ErrInvalidInput)
	}
	if req.BranchID == uuid.Nil {
		return nil, fmt.Errorf("%w: branch is required", apperr.ErrInvalidInput)
	}
	if req.Position != "driver" && req.Position != "guard" && req.Position != "operator" {
		return nil, fmt.Errorf("%w: invalid position", apperr.ErrInvalidInput)
	}
	if req.ValidFrom != nil && req.ValidTo != nil && req.ValidFrom.After(*req.ValidTo) {
		return nil, fmt.Errorf("%w: valid_from cannot be after valid_to", apperr.ErrInvalidInput)
	}

	var code string
	err = s.pool.QueryRow(ctx, `
		SELECT code FROM station.driver WHERE tenant_id = $1 AND id = $2 AND deleted_at IS NULL
	`, tenantID, id).Scan(&code)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, fmt.Errorf("%w: driver not found", apperr.ErrNotFound)
		}
		return nil, fmt.Errorf("get driver: %w", err)
	}

	_, err = s.pool.Exec(ctx, `
		UPDATE station.driver
		SET branch_id = $1, full_name = $2, phone = $3, department = $4,
		    position = $5, valid_from = $6, valid_to = $7, note = $8, updated_at = now()
		WHERE tenant_id = $9 AND id = $10 AND deleted_at IS NULL
	`, req.BranchID, req.FullName, req.Phone, req.Department,
		req.Position, req.ValidFrom, req.ValidTo, req.Note, tenantID, id)
	if err != nil {
		return nil, fmt.Errorf("update driver: %w", err)
	}

	_ = audit.Record(ctx, s.pool, audit.Entry{
		Action:      audit.ActionUpdate,
		EntityType:  "driver",
		EntityID:    &id,
		EntityCode:  code,
		ActorUserID: &actorID,
		ActorName:   actorName,
		NewData: map[string]any{
			"full_name":  req.FullName,
			"branch_id":  req.BranchID,
			"position":   req.Position,
			"department": req.Department,
		},
	})

	return s.GetDriver(ctx, id)
}

func (s *Service) UpdateDriverStatus(ctx context.Context, id uuid.UUID, status string) error {
	tenantID, actorID, actorName, err := getTenantAndActor(ctx)
	if err != nil {
		return err
	}

	if status != "active" && status != "blocked" && status != "inactive" {
		return fmt.Errorf("%w: status must be active, blocked, or inactive", apperr.ErrInvalidInput)
	}

	var code, currentStatus string
	err = s.pool.QueryRow(ctx, `
		SELECT code, status FROM station.driver WHERE tenant_id = $1 AND id = $2 AND deleted_at IS NULL
	`, tenantID, id).Scan(&code, &currentStatus)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return fmt.Errorf("%w: driver not found", apperr.ErrNotFound)
		}
		return fmt.Errorf("get driver status: %w", err)
	}

	if currentStatus == status {
		return nil
	}

	_, err = s.pool.Exec(ctx, `
		UPDATE station.driver SET status = $1, updated_at = now() WHERE tenant_id = $2 AND id = $3 AND deleted_at IS NULL
	`, status, tenantID, id)
	if err != nil {
		return fmt.Errorf("update driver status: %w", err)
	}

	action := audit.ActionUnlock
	if status == "blocked" || status == "inactive" {
		action = audit.ActionLock
	}

	_ = audit.Record(ctx, s.pool, audit.Entry{
		Action:      action,
		EntityType:  "driver",
		EntityID:    &id,
		EntityCode:  code,
		ActorUserID: &actorID,
		ActorName:   actorName,
		OldData:     map[string]any{"status": currentStatus},
		NewData:     map[string]any{"status": status},
	})

	return nil
}

func (s *Service) AssignDriverCard(ctx context.Context, id uuid.UUID, cardNumber string) error {
	tenantID, actorID, actorName, err := getTenantAndActor(ctx)
	if err != nil {
		return err
	}

	cardNumber = strings.TrimSpace(cardNumber)
	if !rxCardNumber.MatchString(cardNumber) {
		return fmt.Errorf("%w: NFC card number must be numeric decimal digits", apperr.ErrInvalidInput)
	}

	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return fmt.Errorf("begin tx: %w", err)
	}
	defer tx.Rollback(ctx)

	var code string
	err = tx.QueryRow(ctx, `
		SELECT code FROM station.driver WHERE tenant_id = $1 AND id = $2 AND deleted_at IS NULL
	`, tenantID, id).Scan(&code)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return fmt.Errorf("%w: driver not found", apperr.ErrNotFound)
		}
		return fmt.Errorf("get driver: %w", err)
	}

	// Check if this card is currently active on someone else
	var activeOwner string
	err = tx.QueryRow(ctx, `
		SELECT COALESCE(vehicle_id::text, driver_id::text, '')
		FROM station.credential
		WHERE tenant_id = $1 AND method = 'card' AND external_id = $2 AND status = 'active'
	`, tenantID, cardNumber).Scan(&activeOwner)
	if err == nil && activeOwner != "" && activeOwner != id.String() {
		return fmt.Errorf("%w: card '%s' is active on another entity", apperr.ErrConflict, cardNumber)
	}

	// Revoke existing active card for this driver
	now := time.Now().UTC()
	_, err = tx.Exec(ctx, `
		UPDATE station.credential
		SET status = 'revoked', revoked_at = $1, updated_at = $1
		WHERE tenant_id = $2 AND driver_id = $3 AND method = 'card' AND status = 'active'
	`, now, tenantID, id)
	if err != nil {
		return fmt.Errorf("revoke current card: %w", err)
	}

	// Insert new credential
	credID := uuid.New()
	_, err = tx.Exec(ctx, `
		INSERT INTO station.credential (
			id, tenant_id, driver_id, method, external_id, status, version, created_at, updated_at
		) VALUES ($1, $2, $3, 'card', $4, 'active', 1, $5, $5)
	`, credID, tenantID, id, cardNumber, now)
	if err != nil {
		return fmt.Errorf("insert card credential: %w", err)
	}

	_ = audit.Record(ctx, tx, audit.Entry{
		Action:      audit.ActionUpdate,
		EntityType:  "driver",
		EntityID:    &id,
		EntityCode:  code,
		ActorUserID: &actorID,
		ActorName:   actorName,
		NewData:     map[string]any{"card_number": cardNumber},
	})

	return tx.Commit(ctx)
}

func (s *Service) UploadDriverFace(
	ctx context.Context,
	driverID uuid.UUID,
	fileName, contentType string,
	fileSize int64,
	r io.Reader,
) (*CredentialItem, error) {
	tenantID, actorID, actorName, err := getTenantAndActor(ctx)
	if err != nil {
		return nil, err
	}

	if fileSize > MaxFaceImageSizeBytes {
		return nil, fmt.Errorf("%w: face image exceeds max size of 200KB (%d bytes)", apperr.ErrInvalidInput, fileSize)
	}

	var code string
	err = s.pool.QueryRow(ctx, `
		SELECT code FROM station.driver WHERE tenant_id = $1 AND id = $2 AND deleted_at IS NULL
	`, tenantID, driverID).Scan(&code)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, fmt.Errorf("%w: driver not found", apperr.ErrNotFound)
		}
		return nil, fmt.Errorf("get driver: %w", err)
	}

	// Save to storage
	storedFile, err := s.storage.Save(ctx, tenantID, fileName, contentType, &actorID, r)
	if err != nil {
		return nil, fmt.Errorf("save face file: %w", err)
	}

	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return nil, fmt.Errorf("begin tx: %w", err)
	}
	defer tx.Rollback(ctx)

	now := time.Now().UTC()
	// Revoke old face credentials
	_, err = tx.Exec(ctx, `
		UPDATE station.credential
		SET status = 'revoked', revoked_at = $1, updated_at = $1
		WHERE tenant_id = $2 AND driver_id = $3 AND method = 'face' AND status = 'active'
	`, now, tenantID, driverID)
	if err != nil {
		return nil, fmt.Errorf("revoke old face credential: %w", err)
	}

	// Insert new face credential
	credID := uuid.New()
	_, err = tx.Exec(ctx, `
		INSERT INTO station.credential (
			id, tenant_id, driver_id, method, external_id, status, face_file_id, version, created_at, updated_at
		) VALUES ($1, $2, $3, 'face', $4, 'active', $5, 1, $6, $6)
	`, credID, tenantID, driverID, code, storedFile.ID, now)
	if err != nil {
		return nil, fmt.Errorf("insert face credential: %w", err)
	}

	_ = audit.Record(ctx, tx, audit.Entry{
		Action:      audit.ActionUpdate,
		EntityType:  "driver",
		EntityID:    &driverID,
		EntityCode:  code,
		ActorUserID: &actorID,
		ActorName:   actorName,
		NewData:     map[string]any{"face_file_id": storedFile.ID},
	})

	if err := tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("commit tx: %w", err)
	}

	return &CredentialItem{
		ID:         credID,
		Method:     "face",
		ExternalID: code,
		Status:     "active",
		FaceFileID: &storedFile.ID,
		Version:    1,
		CreatedAt:  now,
	}, nil
}

func (s *Service) RegisterDriverFingerprint(ctx context.Context, driverID uuid.UUID, biometricTemplateID string) (*CredentialItem, error) {
	tenantID, actorID, actorName, err := getTenantAndActor(ctx)
	if err != nil {
		return nil, err
	}

	biometricTemplateID = strings.TrimSpace(biometricTemplateID)
	if biometricTemplateID == "" {
		return nil, fmt.Errorf("%w: biometric template ID is required", apperr.ErrInvalidInput)
	}

	var code string
	err = s.pool.QueryRow(ctx, `
		SELECT code FROM station.driver WHERE tenant_id = $1 AND id = $2 AND deleted_at IS NULL
	`, tenantID, driverID).Scan(&code)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, fmt.Errorf("%w: driver not found", apperr.ErrNotFound)
		}
		return nil, fmt.Errorf("get driver: %w", err)
	}

	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return nil, fmt.Errorf("begin tx: %w", err)
	}
	defer tx.Rollback(ctx)

	now := time.Now().UTC()
	// Revoke old active fingerprint credential
	_, err = tx.Exec(ctx, `
		UPDATE station.credential
		SET status = 'revoked', revoked_at = $1, updated_at = $1
		WHERE tenant_id = $2 AND driver_id = $3 AND method = 'fingerprint' AND status = 'active'
	`, now, tenantID, driverID)
	if err != nil {
		return nil, fmt.Errorf("revoke old fingerprint: %w", err)
	}

	credID := uuid.New()
	_, err = tx.Exec(ctx, `
		INSERT INTO station.credential (
			id, tenant_id, driver_id, method, external_id, status, biometric_template_id, version, created_at, updated_at
		) VALUES ($1, $2, $3, 'fingerprint', $4, 'active', $5, 1, $6, $6)
	`, credID, tenantID, driverID, code, biometricTemplateID, now)
	if err != nil {
		return nil, fmt.Errorf("insert fingerprint credential: %w", err)
	}

	_ = audit.Record(ctx, tx, audit.Entry{
		Action:      audit.ActionUpdate,
		EntityType:  "driver",
		EntityID:    &driverID,
		EntityCode:  code,
		ActorUserID: &actorID,
		ActorName:   actorName,
		NewData:     map[string]any{"biometric_template_id": biometricTemplateID},
	})

	if err := tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("commit tx: %w", err)
	}

	return &CredentialItem{
		ID:                  credID,
		Method:              "fingerprint",
		ExternalID:          code,
		Status:              "active",
		BiometricTemplateID: biometricTemplateID,
		Version:             1,
		CreatedAt:           now,
	}, nil
}

func (s *Service) RevokeDriverCredential(ctx context.Context, driverID uuid.UUID, credID uuid.UUID) error {
	tenantID, actorID, actorName, err := getTenantAndActor(ctx)
	if err != nil {
		return err
	}

	var code string
	err = s.pool.QueryRow(ctx, `
		SELECT code FROM station.driver WHERE tenant_id = $1 AND id = $2 AND deleted_at IS NULL
	`, tenantID, driverID).Scan(&code)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return fmt.Errorf("%w: driver not found", apperr.ErrNotFound)
		}
		return fmt.Errorf("get driver: %w", err)
	}

	now := time.Now().UTC()
	cmd, err := s.pool.Exec(ctx, `
		UPDATE station.credential
		SET status = 'revoked', revoked_at = $1, updated_at = $1
		WHERE tenant_id = $2 AND driver_id = $3 AND id = $4 AND status = 'active'
	`, now, tenantID, driverID, credID)
	if err != nil {
		return fmt.Errorf("revoke driver credential: %w", err)
	}

	if cmd.RowsAffected() > 0 {
		_ = audit.Record(ctx, s.pool, audit.Entry{
			Action:      audit.ActionUpdate,
			EntityType:  "driver",
			EntityID:    &driverID,
			EntityCode:  code,
			ActorUserID: &actorID,
			ActorName:   actorName,
			NewData:     map[string]any{"revoked_credential_id": credID},
		})
	}

	return nil
}

func (s *Service) DeleteDriver(ctx context.Context, id uuid.UUID) error {
	tenantID, actorID, actorName, err := getTenantAndActor(ctx)
	if err != nil {
		return err
	}

	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return fmt.Errorf("begin tx: %w", err)
	}
	defer tx.Rollback(ctx)

	var code string
	err = tx.QueryRow(ctx, `
		SELECT code FROM station.driver WHERE tenant_id = $1 AND id = $2 AND deleted_at IS NULL
	`, tenantID, id).Scan(&code)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return fmt.Errorf("%w: driver not found", apperr.ErrNotFound)
		}
		return fmt.Errorf("get driver: %w", err)
	}

	now := time.Now().UTC()
	// Soft delete driver
	_, err = tx.Exec(ctx, `
		UPDATE station.driver SET deleted_at = $1, updated_at = $1 WHERE tenant_id = $2 AND id = $3
	`, now, tenantID, id)
	if err != nil {
		return fmt.Errorf("soft delete driver: %w", err)
	}

	// Revoke active credentials
	_, err = tx.Exec(ctx, `
		UPDATE station.credential SET status = 'revoked', revoked_at = $1, updated_at = $1
		WHERE tenant_id = $2 AND driver_id = $3 AND status = 'active'
	`, now, tenantID, id)
	if err != nil {
		return fmt.Errorf("revoke credentials: %w", err)
	}

	_ = audit.Record(ctx, tx, audit.Entry{
		Action:      audit.ActionDelete,
		EntityType:  "driver",
		EntityID:    &id,
		EntityCode:  code,
		ActorUserID: &actorID,
		ActorName:   actorName,
	})

	return tx.Commit(ctx)
}

// ------------------------------------------------------------------------------------------------
// STORED FILE DOWNLOAD
// ------------------------------------------------------------------------------------------------

func (s *Service) OpenFile(ctx context.Context, fileID uuid.UUID) (*storage.StoredFile, io.ReadCloser, error) {
	tenantID, _, _, err := getTenantAndActor(ctx)
	if err != nil {
		return nil, nil, err
	}

	var sf storage.StoredFile
	err = s.pool.QueryRow(ctx, `
		SELECT id, tenant_id, storage_key, file_name, content_type, size_bytes, sha256, created_at
		FROM station.stored_file
		WHERE tenant_id = $1 AND id = $2
	`, tenantID, fileID).Scan(
		&sf.ID, &sf.TenantID, &sf.StorageKey, &sf.FileName, &sf.ContentType, &sf.SizeBytes, &sf.SHA256, &sf.CreatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil, fmt.Errorf("%w: file not found", apperr.ErrNotFound)
		}
		return nil, nil, fmt.Errorf("query stored file: %w", err)
	}

	rc, err := s.storage.Open(ctx, tenantID, sf.StorageKey)
	if err != nil {
		return nil, nil, fmt.Errorf("open file stream: %w", err)
	}

	return &sf, rc, nil
}
