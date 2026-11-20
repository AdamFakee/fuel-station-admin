package postgres

import (
	"context"
	"fmt"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
)

type txKey struct{}

// DBQuerier abstracts operations common between *pgxpool.Pool and pgx.Tx.
type DBQuerier interface {
	Exec(ctx context.Context, sql string, arguments ...any) (pgconn.CommandTag, error)
	Query(ctx context.Context, sql string, args ...any) (pgx.Rows, error)
	QueryRow(ctx context.Context, sql string, args ...any) pgx.Row
}

// Store wraps pgxpool to provide clean Transaction Management.
type Store struct {
	pool *pgxpool.Pool
}

// NewStore initializes a new Postgres Store helper.
func NewStore(pool *pgxpool.Pool) *Store {
	return &Store{pool: pool}
}

// DB returns either the active pgx.Tx from context (if within WithTx) or the default pool.
func (s *Store) DB(ctx context.Context) DBQuerier {
	if tx, ok := ctx.Value(txKey{}).(pgx.Tx); ok {
		return tx
	}
	return s.pool
}

// WithTx runs a transaction block safely, rolling back on error and committing on success.
func (s *Store) WithTx(ctx context.Context, fn func(ctx context.Context) error) error {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return fmt.Errorf("begin transaction: %w", err)
	}

	defer func() {
		_ = tx.Rollback(ctx) // Safe no-op if already committed
	}()

	txCtx := context.WithValue(ctx, txKey{}, tx)
	if err := fn(txCtx); err != nil {
		return err
	}

	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("commit transaction: %w", err)
	}

	return nil
}
