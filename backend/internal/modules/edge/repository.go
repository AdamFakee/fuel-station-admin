package edge

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"fuel-station-backend/internal/platform/crypto"
	"log/slog"
	"time"

	"fuel-station-backend/internal/shared/apperr"
	"fuel-station-backend/internal/shared/storage"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type Repository interface {
	FindStationByApiKeyHash(ctx context.Context, keyHash string) (*StationContext, error)
	GetCatalogChanges(ctx context.Context, tenantID, branchID string, cursor int64, limit int) ([]CatalogChangeItem, int64, bool, error)
	UpdateLastSyncAt(ctx context.Context, stationID string) error
	FindDispenseSessionByRef(ctx context.Context, stationID, edgeRef string) (*DispenseSessionResponse, error)
	CreateDispenseSession(ctx context.Context, station *StationContext, req CreateDispenseSessionRequest) (*DispenseSessionResponse, error)
	BatchInsertAccessEvents(ctx context.Context, station *StationContext, events []AccessEventInput) (int, error)
	UpdateHeartbeat(ctx context.Context, stationID string, pendingQueue int, agentVersion string, lastError *string) error
	// CatalogStats: số thay đổi sau cursor (dừng đếm ở limit) và số thứ tự lớn nhất của nhật ký danh mục. Chỉ đọc.
	CatalogStats(ctx context.Context, tenantID string, cursor int64, limit int) (pending int64, maxSeq int64, err error)
}

type postgresRepository struct {
	pool      *pgxpool.Pool
	cryptoKey []byte          // khóa giải mã mật khẩu máy chấm công gửi kèm cho Edge Agent (mạng LAN)
	files     storage.Storage // kho ảnh: dùng để chắc ảnh mặt đọc được trước khi báo cho trạm; nil thì không kiểm tra
}

func NewRepository(pool *pgxpool.Pool) Repository {
	return &postgresRepository{pool: pool, cryptoKey: crypto.DefaultCryptoKey}
}

// WithCryptoKey đặt khóa giải mã mật khẩu máy chấm công (cùng khóa mà module assets dùng để mã hóa).
func WithCryptoKey(repo Repository, key []byte) Repository {
	if r, ok := repo.(*postgresRepository); ok {
		r.cryptoKey = key
	}
	return repo
}

// WithFileStore gắn kho ảnh để danh mục xuống trạm chỉ gồm thẻ mặt có ảnh đọc được thật sự.
func WithFileStore(repo Repository, files storage.Storage) Repository {
	if r, ok := repo.(*postgresRepository); ok {
		r.files = files
	}
	return repo
}

// faceImageReadable chắc rằng ảnh của thẻ mặt có dòng trong stored_file VÀ mở đọc được từ kho. Dòng DB còn mà tệp mất
// (xóa tay, đổi thư mục kho, sao lưu thiếu) thì trạm sẽ nhận 404 khi tải ảnh; không để lỗi đó đi tới trạm.
func (r *postgresRepository) faceImageReadable(ctx context.Context, tenantID, fileID string) error {
	if r.files == nil {
		return nil
	}
	tenantUUID, err := uuid.Parse(tenantID)
	if err != nil {
		return fmt.Errorf("tenant_id không hợp lệ: %w", err)
	}
	var storageKey string
	if err := r.pool.QueryRow(ctx, `SELECT storage_key FROM station.stored_file WHERE tenant_id = $1 AND id = $2`, tenantID, fileID).Scan(&storageKey); err != nil {
		return fmt.Errorf("không có dòng stored_file: %w", err)
	}
	body, err := r.files.Open(ctx, tenantUUID, storageKey)
	if err != nil {
		return fmt.Errorf("tệp ảnh không đọc được: %w", err)
	}
	return body.Close()
}

func (r *postgresRepository) FindStationByApiKeyHash(ctx context.Context, keyHash string) (*StationContext, error) {
	if r.pool == nil {
		return nil, errors.New("db pool not initialized")
	}

	query := `
		SELECT id, tenant_id, branch_id, code, name
		FROM station.edge_station
		WHERE api_key_hash = $1 AND status = 'active'
	`
	var s StationContext
	err := r.pool.QueryRow(ctx, query, keyHash).Scan(&s.StationID, &s.TenantID, &s.BranchID, &s.StationCode, &s.StationName)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, apperr.ErrUnauthorized
		}
		return nil, fmt.Errorf("find edge station by key: %w", err)
	}
	return &s, nil
}

func (r *postgresRepository) UpdateLastSyncAt(ctx context.Context, stationID string) error {
	if r.pool == nil {
		return nil
	}
	query := `UPDATE station.edge_station SET last_sync_at = now(), updated_at = now() WHERE id = $1`
	_, err := r.pool.Exec(ctx, query, stationID)
	return err
}

func (r *postgresRepository) CatalogStats(ctx context.Context, tenantID string, cursor int64, limit int) (int64, int64, error) {
	if r.pool == nil {
		return 0, 0, errors.New("db pool not initialized")
	}
	var maxSeq int64
	if err := r.pool.QueryRow(ctx, `SELECT COALESCE(MAX(seq), 0) FROM station.sync_change_log WHERE tenant_id = $1`, tenantID).Scan(&maxSeq); err != nil {
		return 0, 0, fmt.Errorf("max seq: %w", err)
	}
	var pending int64
	if err := r.pool.QueryRow(ctx, `SELECT COUNT(*) FROM (SELECT 1 FROM station.sync_change_log WHERE tenant_id = $1 AND seq > $2 LIMIT $3) t`, tenantID, cursor, limit).Scan(&pending); err != nil {
		return 0, 0, fmt.Errorf("count pending: %w", err)
	}
	return pending, maxSeq, nil
}

func (r *postgresRepository) GetCatalogChanges(ctx context.Context, tenantID, branchID string, cursor int64, limit int) ([]CatalogChangeItem, int64, bool, error) {
	if r.pool == nil {
		return nil, cursor, false, errors.New("db pool not initialized")
	}

	if limit <= 0 || limit > 1000 {
		limit = 100
	}

	// Fetch up to limit + 1 items to determine has_more
	query := `
		SELECT seq, entity_type, entity_id, version, deleted, changed_at
		FROM station.sync_change_log
		WHERE tenant_id = $1 AND seq > $2
		ORDER BY seq ASC
		LIMIT $3
	`

	rows, err := r.pool.Query(ctx, query, tenantID, cursor, limit+1)
	if err != nil {
		return nil, cursor, false, fmt.Errorf("query sync change log: %w", err)
	}
	defer rows.Close()

	var changes []CatalogChangeItem
	for rows.Next() {
		var item CatalogChangeItem
		if err := rows.Scan(&item.Seq, &item.EntityType, &item.EntityID, &item.Version, &item.Deleted, &item.ChangedAt); err != nil {
			return nil, cursor, false, fmt.Errorf("scan sync change log: %w", err)
		}
		changes = append(changes, item)
	}

	hasMore := false
	if len(changes) > limit {
		hasMore = true
		changes = changes[:limit]
	}

	nextCursor := cursor
	if len(changes) > 0 {
		nextCursor = changes[len(changes)-1].Seq
	}

	// Enrich entity data for non-deleted records
	for i := range changes {
		item := &changes[i]
		if !item.Deleted {
			data, err := r.loadEntityData(ctx, tenantID, branchID, item.EntityType, item.EntityID)
			if err == nil && data != nil {
				item.Data = data
			}
		}
	}

	return changes, nextCursor, hasMore, nil
}

func (r *postgresRepository) loadEntityData(ctx context.Context, tenantID, branchID, entityType, entityID string) (map[string]any, error) {
	data := make(map[string]any)

	switch entityType {
	case "pump":
		query := `SELECT id, code, edge_pump_id, name, enabled, version FROM station.pump WHERE tenant_id = $1 AND id = $2 AND branch_id = $3`
		var id, code, name string
		var edgePumpID, version int64
		var enabled bool
		err := r.pool.QueryRow(ctx, query, tenantID, entityID, branchID).Scan(&id, &code, &edgePumpID, &name, &enabled, &version)
		if err != nil {
			return nil, err
		}
		data["id"] = id
		data["code"] = code
		data["edge_pump_id"] = edgePumpID
		data["name"] = name
		data["enabled"] = enabled
		data["version"] = version

	case "pump_sensor":
		query := `
			SELECT s.id, s.pump_id, s.name, s.serial, s.com_port, s.baud, s.version, p.edge_pump_id
			FROM station.pump_sensor s
			JOIN station.pump p ON p.id = s.pump_id AND p.tenant_id = s.tenant_id
			WHERE s.tenant_id = $1 AND s.id = $2 AND p.branch_id = $3
		`
		var id, pumpID, name, comPort string
		var serial, version, edgePumpID int64
		var baud int
		err := r.pool.QueryRow(ctx, query, tenantID, entityID, branchID).Scan(&id, &pumpID, &name, &serial, &comPort, &baud, &version, &edgePumpID)
		if err != nil {
			return nil, err
		}
		data["id"] = id
		data["pump_id"] = pumpID
		data["name"] = name
		data["serial"] = serial
		data["com_port"] = comPort
		data["baud"] = baud
		data["version"] = version
		data["edge_pump_id"] = edgePumpID // số trụ trên trạm: Edge Agent dùng số này, không dùng uuid

	case "access_terminal":
		query := `
			SELECT t.id, t.pump_id, t.terminal_code, t.host, t.port, t.https, t.username, t.version, t.password_enc, p.edge_pump_id
			FROM station.access_terminal t
			JOIN station.pump p ON p.id = t.pump_id AND p.tenant_id = t.tenant_id
			WHERE t.tenant_id = $1 AND t.id = $2 AND p.branch_id = $3
		`
		var id, pumpID, terminalCode, host, username string
		var port int
		var https bool
		var version, edgePumpID int64
		var passwordEnc []byte
		err := r.pool.QueryRow(ctx, query, tenantID, entityID, branchID).Scan(&id, &pumpID, &terminalCode, &host, &port, &https, &username, &version, &passwordEnc, &edgePumpID)
		if err != nil {
			return nil, err
		}
		// Edge Agent cần mật khẩu thật để đăng nhập máy chấm công trong LAN: giải mã rồi gửi kèm (đường truyền chỉ cho Edge đã xác thực).
		if len(passwordEnc) > 0 {
			if plain, derr := crypto.DecryptAESGCM(passwordEnc, r.cryptoKey); derr == nil {
				data["password"] = string(plain)
			}
		}
		data["id"] = id
		data["pump_id"] = pumpID
		data["terminal_code"] = terminalCode
		data["host"] = host
		data["port"] = port
		data["https"] = https
		data["username"] = username
		data["version"] = version
		data["edge_pump_id"] = edgePumpID

	case "vehicle":
		// Xe là dữ liệu cấp công ty: đẩy MỌI xe của công ty xuống mọi trạm (xe đổ được ở mọi trạm xăng).
		query := `
			SELECT v.id, v.code, v.plate, v.fuel_type_id, v.status, v.version
			FROM station.vehicle v
			WHERE v.tenant_id = $1 AND v.id = $2 AND v.deleted_at IS NULL`
		var id, code, plate, fuelTypeID, status string
		var version int64
		err := r.pool.QueryRow(ctx, query, tenantID, entityID).Scan(&id, &code, &plate, &fuelTypeID, &status, &version)
		if err != nil {
			return nil, err
		}
		data["id"] = id
		data["code"] = code
		data["plate"] = plate
		data["fuel_type_id"] = fuelTypeID
		data["status"] = status
		data["version"] = version

	case "driver":
		query := `SELECT id, code, full_name, phone, status, version, valid_from, valid_to FROM station.driver WHERE tenant_id = $1 AND id = $2 AND deleted_at IS NULL`
		var id, code, fullName, status string
		var phone *string
		var version int64
		var validFrom, validTo *time.Time
		err := r.pool.QueryRow(ctx, query, tenantID, entityID).Scan(&id, &code, &fullName, &phone, &status, &version, &validFrom, &validTo)
		if err != nil {
			return nil, err
		}
		data["valid_from"] = validFrom
		data["valid_to"] = validTo
		data["id"] = id
		data["code"] = code
		data["full_name"] = fullName
		data["phone"] = phone
		data["status"] = status
		data["version"] = version

	case "credential":
		query := `SELECT id, vehicle_id, driver_id, method, external_id, status, version, face_file_id FROM station.credential WHERE tenant_id = $1 AND id = $2`
		var id, method, externalID, status string
		var vehicleID, driverID, faceFileID *string
		var version int64
		err := r.pool.QueryRow(ctx, query, tenantID, entityID).Scan(&id, &vehicleID, &driverID, &method, &externalID, &status, &version, &faceFileID)
		if err != nil {
			return nil, err
		}
		// Thẻ mặt còn hiệu lực mà ảnh không đọc được thì KHÔNG đưa xuống trạm: bỏ dữ liệu của mục này (trạm bỏ qua mục không có
		// dữ liệu) để một ảnh hỏng không làm hỏng cả đợt kéo danh mục. Ảnh được tải lại thì thẻ đổi phiên bản và được gửi lại.
		if method == "face" && status == "active" && faceFileID != nil {
			if err := r.faceImageReadable(ctx, tenantID, *faceFileID); err != nil {
				slog.Error("thẻ mặt không có ảnh đọc được, không đưa xuống trạm: tải lại ảnh hoặc thu hồi thẻ",
					"credential_id", id, "external_id", externalID, "face_file_id", *faceFileID, "err", err)
				return nil, err
			}
		}
		data["id"] = id
		data["vehicle_id"] = vehicleID
		data["driver_id"] = driverID
		data["method"] = method
		data["external_id"] = externalID
		data["status"] = status
		data["version"] = version
		if faceFileID != nil {
			data["face_file_id"] = *faceFileID
		}
	}

	return data, nil
}

func (r *postgresRepository) FindDispenseSessionByRef(ctx context.Context, stationID, edgeRef string) (*DispenseSessionResponse, error) {
	if r.pool == nil {
		return nil, errors.New("db pool not initialized")
	}

	query := `
		SELECT id, code, edge_ref, status, dispensed_ml, received_at
		FROM station.dispense_session
		WHERE edge_station_id = $1 AND edge_ref = $2
	`
	var resp DispenseSessionResponse
	err := r.pool.QueryRow(ctx, query, stationID, edgeRef).Scan(
		&resp.ID, &resp.Code, &resp.EdgeRef, &resp.Status, &resp.DispensedML, &resp.ReceivedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil // Not found
		}
		return nil, fmt.Errorf("check idempotent session: %w", err)
	}
	return &resp, nil
}

func (r *postgresRepository) CreateDispenseSession(ctx context.Context, station *StationContext, req CreateDispenseSessionRequest) (*DispenseSessionResponse, error) {
	if r.pool == nil {
		return nil, errors.New("db pool not initialized")
	}

	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return nil, fmt.Errorf("begin transaction: %w", err)
	}
	defer tx.Rollback(ctx)

	// Check idempotency inside tx
	existingQuery := `
		SELECT id, code, edge_ref, status, dispensed_ml, received_at
		FROM station.dispense_session
		WHERE edge_station_id = $1 AND edge_ref = $2
	`
	var existing DispenseSessionResponse
	err = tx.QueryRow(ctx, existingQuery, station.StationID, req.EdgeRef).Scan(
		&existing.ID, &existing.Code, &existing.EdgeRef, &existing.Status, &existing.DispensedML, &existing.ReceivedAt,
	)
	if err == nil {
		_ = tx.Commit(ctx)
		return &existing, nil
	}

	// 1. Resolve pump
	pumpID := req.PumpID
	var pumpName string
	if pumpID == "" && req.EdgePumpID != nil {
		pQuery := `SELECT id, name FROM station.pump WHERE tenant_id = $1 AND branch_id = $2 AND edge_pump_id = $3`
		if err := tx.QueryRow(ctx, pQuery, station.TenantID, station.BranchID, *req.EdgePumpID).Scan(&pumpID, &pumpName); err != nil {
			return nil, fmt.Errorf("resolve pump by edge_pump_id %d: %w", *req.EdgePumpID, err)
		}
	} else if pumpID != "" {
		pQuery := `SELECT name FROM station.pump WHERE tenant_id = $1 AND id = $2`
		if err := tx.QueryRow(ctx, pQuery, station.TenantID, pumpID).Scan(&pumpName); err != nil {
			return nil, fmt.Errorf("lookup pump %s: %w", pumpID, err)
		}
	} else {
		return nil, fmt.Errorf("%w: pump_id or edge_pump_id is required", apperr.ErrInvalidInput)
	}

	// 2. Resolve nozzle & tank
	nozzleID := req.NozzleID
	tankID := req.TankID
	fuelTypeID := req.FuelTypeID

	if tankID == nil || *tankID == "" {
		if nozzleID != nil && *nozzleID != "" {
			var tID, fID string
			nQuery := `SELECT tank_id, fuel_type_id FROM station.nozzle n JOIN station.tank t ON t.id = n.tank_id WHERE n.id = $1`
			if err := tx.QueryRow(ctx, nQuery, *nozzleID).Scan(&tID, &fID); err == nil {
				tankID = &tID
				if fuelTypeID == nil {
					fuelTypeID = &fID
				}
			}
		} else {
			// Find primary active nozzle on this pump
			var nID, tID, fID string
			pnQuery := `
				SELECT n.id, n.tank_id, t.fuel_type_id
				FROM station.nozzle n
				JOIN station.tank t ON t.id = n.tank_id
				WHERE n.pump_id = $1 AND n.status = 'active'
				ORDER BY n.nozzle_no ASC LIMIT 1
			`
			if err := tx.QueryRow(ctx, pnQuery, pumpID).Scan(&nID, &tID, &fID); err == nil {
				nozzleID = &nID
				tankID = &tID
				if fuelTypeID == nil {
					fuelTypeID = &fID
				}
			}
		}
	}

	// Edge Agent chỉ biết mã xe và mã tài xế (không biết uuid của server): tra id theo mã để phiên đổ gắn đúng xe và tài xế.
	if (req.VehicleID == nil || *req.VehicleID == "") && req.VehicleCode != nil && *req.VehicleCode != "" {
		var vid string
		if err := tx.QueryRow(ctx, `SELECT id FROM station.vehicle WHERE tenant_id = $1 AND code = $2 AND deleted_at IS NULL`, station.TenantID, *req.VehicleCode).Scan(&vid); err == nil {
			req.VehicleID = &vid
		}
	}
	if (req.DriverID == nil || *req.DriverID == "") && req.DriverCode != nil && *req.DriverCode != "" {
		var did string
		if err := tx.QueryRow(ctx, `SELECT id FROM station.driver WHERE tenant_id = $1 AND code = $2 AND deleted_at IS NULL`, station.TenantID, *req.DriverCode).Scan(&did); err == nil {
			req.DriverID = &did
		}
	}

	// 3. Resolve vehicle code / plate if vehicle_id supplied
	vehiclePlate := req.VehiclePlate
	vehicleCode := req.VehicleCode
	if req.VehicleID != nil && *req.VehicleID != "" {
		var code, plate string
		if err := tx.QueryRow(ctx, `SELECT code, plate FROM station.vehicle WHERE id = $1`, *req.VehicleID).Scan(&code, &plate); err == nil {
			if vehicleCode == nil {
				vehicleCode = &code
			}
			if vehiclePlate == nil {
				vehiclePlate = &plate
			}
		}
	}

	// 4. Resolve driver code / name if driver_id supplied
	driverName := req.DriverName
	driverCode := req.DriverCode
	if req.DriverID != nil && *req.DriverID != "" {
		var code, name string
		if err := tx.QueryRow(ctx, `SELECT code, full_name FROM station.driver WHERE id = $1`, *req.DriverID).Scan(&code, &name); err == nil {
			if driverCode == nil {
				driverCode = &code
			}
			if driverName == nil {
				driverName = &name
			}
		}
	}

	// 5. Generate human-friendly transaction code GD-2026-0001
	var code string
	if err := tx.QueryRow(ctx, `SELECT station.next_code($1, 'GD')`, station.TenantID).Scan(&code); err != nil {
		return nil, fmt.Errorf("generate dispense code: %w", err)
	}

	now := time.Now().UTC()
	var newID string
	insertSessionSQL := `
		INSERT INTO station.dispense_session (
			tenant_id, branch_id, edge_station_id, code, edge_ref,
			pump_id, nozzle_id, tank_id, fuel_type_id,
			vehicle_id, driver_id, pump_name, vehicle_code, vehicle_plate,
			driver_code, driver_name, limit_ml, paired_at, unlocked_at,
			started_at, finished_at, dispensed_ml, pump_total_ml,
			sensor_serial, sale_seq, raw_hex, edge_state, status, received_at
		) VALUES (
			$1, $2, $3, $4, $5,
			$6, $7, $8, $9,
			$10, $11, $12, $13, $14,
			$15, $16, $17, $18, $19,
			$20, $21, $22, $23,
			$24, $25, $26, $27, $28, $29
		)
		RETURNING id
	`

	err = tx.QueryRow(ctx, insertSessionSQL,
		station.TenantID, station.BranchID, station.StationID, code, req.EdgeRef,
		pumpID, nozzleID, tankID, fuelTypeID,
		req.VehicleID, req.DriverID, pumpName, vehicleCode, vehiclePlate,
		driverCode, driverName, req.LimitML, req.PairedAt, req.UnlockedAt,
		req.StartedAt, req.FinishedAt, req.DispensedML, req.PumpTotalML,
		req.SensorSerial, req.SaleSeq, req.RawHex, req.EdgeState, req.Status, now,
	).Scan(&newID)

	if err != nil {
		return nil, fmt.Errorf("insert dispense session: %w", err)
	}

	// 6. Insert events
	if len(req.Events) > 0 {
		for _, ev := range req.Events {
			_, eErr := tx.Exec(ctx, `
				INSERT INTO station.dispense_session_event (tenant_id, session_id, from_state, to_state, occurred_at)
				VALUES ($1, $2, $3, $4, $5)
			`, station.TenantID, newID, ev.FromState, ev.ToState, ev.OccurredAt)
			if eErr != nil {
				return nil, fmt.Errorf("insert dispense session event: %w", eErr)
			}
		}
	}

	// 7. Stock Ledger Integration (P0 Money/Volume Safety)
	// If completed and dispensed_ml > 0, deduct stock in same transaction
	if req.Status == "completed" && req.DispensedML > 0 && tankID != nil && *tankID != "" {
		vPlateStr := ""
		if vehiclePlate != nil {
			vPlateStr = *vehiclePlate
		}
		dNameStr := ""
		if driverName != nil {
			dNameStr = *driverName
		}
		note := fmt.Sprintf("Xuất nhiên liệu phiên %s (xe %s, tài xế %s)", code, vPlateStr, dNameStr)

		ledgerSQL := `
			INSERT INTO station.stock_ledger (
				tenant_id, tank_id, occurred_at, kind, delta_ml, ref_type, ref_id, note
			) VALUES (
				$1, $2, COALESCE($3, now()), 'dispense', -($4::bigint), 'dispense_session', $5, $6
			)
		`
		var occurredAt any
		if req.FinishedAt != nil {
			occurredAt = *req.FinishedAt
		}

		_, lErr := tx.Exec(ctx, ledgerSQL, station.TenantID, *tankID, occurredAt, req.DispensedML, newID, note)
		if lErr != nil {
			return nil, fmt.Errorf("stock ledger deduction failed: %w", lErr)
		}
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("commit transaction: %w", err)
	}

	return &DispenseSessionResponse{
		ID:          newID,
		Code:        code,
		EdgeRef:     req.EdgeRef,
		Status:      req.Status,
		DispensedML: req.DispensedML,
		ReceivedAt:  now,
	}, nil
}

func (r *postgresRepository) BatchInsertAccessEvents(ctx context.Context, station *StationContext, events []AccessEventInput) (int, error) {
	if r.pool == nil {
		return 0, errors.New("db pool not initialized")
	}
	if len(events) == 0 {
		return 0, nil
	}

	query := `
		INSERT INTO station.access_event (
			tenant_id, branch_id, edge_station_id, edge_ref, occurred_at,
			kind, pump_id, method, external_id, vehicle_id, driver_id,
			party_name, decision, reason, session_id, detail, received_at
		) VALUES (
			$1, $2, $3, $4, $5,
			$6, $7, $8, $9, $10, $11,
			$12, $13, $14, $15, $16, now()
		)
		ON CONFLICT (edge_station_id, edge_ref) DO NOTHING
	`

	inserted := 0
	for _, ev := range events {
		var detailJSON any
		if ev.Detail != nil {
			if b, err := json.Marshal(ev.Detail); err == nil {
				detailJSON = string(b)
			}
		}

		tag, err := r.pool.Exec(ctx, query,
			station.TenantID, station.BranchID, station.StationID, ev.EdgeRef, ev.OccurredAt,
			ev.Kind, ev.PumpID, ev.Method, ev.ExternalID, ev.VehicleID, ev.DriverID,
			ev.PartyName, ev.Decision, ev.Reason, ev.SessionID, detailJSON,
		)
		if err == nil && tag.RowsAffected() > 0 {
			inserted++
		}
	}

	return inserted, nil
}

func (r *postgresRepository) UpdateHeartbeat(ctx context.Context, stationID string, pendingQueue int, agentVersion string, lastError *string) error {
	if r.pool == nil {
		return errors.New("db pool not initialized")
	}

	query := `
		UPDATE station.edge_station
		SET last_seen_at = now(),
		    pending_queue = $2,
		    agent_version = $3,
		    last_error = $4,
		    updated_at = now()
		WHERE id = $1
	`
	_, err := r.pool.Exec(ctx, query, stationID, pendingQueue, agentVersion, lastError)
	if err != nil {
		return fmt.Errorf("update heartbeat: %w", err)
	}
	return nil
}
