package audit

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"fuel-station-backend/internal/shared/authz"
	"fuel-station-backend/internal/shared/middleware"
	"fuel-station-backend/internal/shared/tx"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
)

// Standard Audit Actions matching station.audit_log check constraint
const (
	ActionCreate  = "create"
	ActionUpdate  = "update"
	ActionDelete  = "delete"
	ActionApprove = "approve"
	ActionReject  = "reject"
	ActionLogin   = "login"
	ActionLock    = "lock"
	ActionUnlock  = "unlock"
	ActionExport  = "export"
)

// Queryer abstracts pgxpool.Pool and pgx.Tx for database executions.
type Queryer interface {
	Exec(ctx context.Context, sql string, arguments ...any) (commandTag pgconn.CommandTag, err error)
}

// Entry contains data to record in the immutable audit log.
type Entry struct {
	Action      string
	EntityType  string
	EntityID    *uuid.UUID
	EntityCode  string
	ActorUserID *uuid.UUID
	ActorName   string
	IP          string
	OldData     any
	NewData     any
}

// Record inserts an immutable audit log entry.
// It prioritizes any active transaction in context (tx.GetTx), otherwise falls back to db.
func Record(ctx context.Context, db Queryer, entry Entry) error {
	tenantIDStr, ok := middleware.TenantIDFromContext(ctx)
	if !ok || tenantIDStr == "" {
		return errors.New("audit: missing tenant_id in context")
	}

	tenantID, err := uuid.Parse(tenantIDStr)
	if err != nil {
		return fmt.Errorf("audit: parse tenant_id: %w", err)
	}

	var actorUserID *uuid.UUID
	actorName := entry.ActorName

	if p, ok := authz.FromContext(ctx); ok {
		if actorUserID == nil && p.UserID != "" {
			if uID, err := uuid.Parse(p.UserID); err == nil {
				actorUserID = &uID
			}
		}
	}
	if entry.ActorUserID != nil {
		actorUserID = entry.ActorUserID
	}
	if actorName == "" {
		actorName = "System"
	}

	reqID, _ := ctx.Value(middleware.RequestIDKey).(string)

	var oldJSON, newJSON []byte
	if entry.OldData != nil {
		oldJSON, err = json.Marshal(entry.OldData)
		if err != nil {
			return fmt.Errorf("audit: marshal old data: %w", err)
		}
	}
	if entry.NewData != nil {
		newJSON, err = json.Marshal(entry.NewData)
		if err != nil {
			return fmt.Errorf("audit: marshal new data: %w", err)
		}
	}

	query := `
		INSERT INTO station.audit_log (
			tenant_id, occurred_at, actor_user_id, actor_name, action,
			entity_type, entity_id, entity_code, old_data, new_data,
			ip, request_id
		) VALUES (
			$1, $2, $3, $4, $5,
			$6, $7, $8, $9, $10,
			$11, $12
		)
	`

	// Determine execution runner: active transaction or provided Queryer
	var runner Queryer = db
	if currentTx, hasTx := tx.GetTx(ctx); hasTx {
		runner = currentTx
	}

	var ipArg any
	if entry.IP != "" {
		ipArg = entry.IP
	}

	var reqIDArg any
	if reqID != "" {
		reqIDArg = reqID
	}

	var oldArg, newArg any
	if len(oldJSON) > 0 {
		oldArg = string(oldJSON)
	}
	if len(newJSON) > 0 {
		newArg = string(newJSON)
	}

	_, err = runner.Exec(ctx, query,
		tenantID,
		time.Now().UTC(),
		actorUserID,
		actorName,
		entry.Action,
		entry.EntityType,
		entry.EntityID,
		entry.EntityCode,
		oldArg,
		newArg,
		ipArg,
		reqIDArg,
	)
	if err != nil {
		return fmt.Errorf("audit: insert log: %w", err)
	}

	return nil
}

// Ensure interface compatibility
var _ = pgx.Tx(nil)
