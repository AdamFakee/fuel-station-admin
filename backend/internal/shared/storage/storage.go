package storage

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

// StoredFile represents a stored file metadata matching station.stored_file.
type StoredFile struct {
	ID          uuid.UUID `json:"id"`
	TenantID    uuid.UUID `json:"tenant_id"`
	StorageKey  string    `json:"storage_key"`
	FileName    string    `json:"file_name"`
	ContentType string    `json:"content_type"`
	SizeBytes   int64     `json:"size_bytes"`
	SHA256      string    `json:"sha256"`
	CreatedBy   *uuid.UUID `json:"created_by,omitempty"`
	CreatedAt   time.Time `json:"created_at"`
}

// Storage provides file storage and retrieval abstraction.
type Storage interface {
	Save(ctx context.Context, tenantID uuid.UUID, fileName, contentType string, createdBy *uuid.UUID, r io.Reader) (*StoredFile, error)
	Open(ctx context.Context, tenantID uuid.UUID, storageKey string) (io.ReadCloser, error)
}

// LocalDiskStorage implements Storage on local file system with database tracking.
type LocalDiskStorage struct {
	baseDir string
	pool    *pgxpool.Pool
}

// NewLocalDiskStorage creates a new LocalDiskStorage.
func NewLocalDiskStorage(baseDir string, pool *pgxpool.Pool) (*LocalDiskStorage, error) {
	if err := os.MkdirAll(baseDir, 0o755); err != nil {
		return nil, fmt.Errorf("create storage base dir: %w", err)
	}
	return &LocalDiskStorage{
		baseDir: baseDir,
		pool:    pool,
	}, nil
}

// Save streams content to disk, computes sha256 checksum and size, and inserts metadata to station.stored_file.
func (s *LocalDiskStorage) Save(
	ctx context.Context,
	tenantID uuid.UUID,
	fileName, contentType string,
	createdBy *uuid.UUID,
	r io.Reader,
) (*StoredFile, error) {
	fileID := uuid.New()
	ext := filepath.Ext(fileName)
	storageKey := fmt.Sprintf("%d/%s%s", time.Now().Year(), fileID.String(), ext)

	targetDir := filepath.Join(s.baseDir, tenantID.String(), filepath.Dir(storageKey))
	if err := os.MkdirAll(targetDir, 0o755); err != nil {
		return nil, fmt.Errorf("storage: create target dir: %w", err)
	}

	targetFilePath := filepath.Join(s.baseDir, tenantID.String(), filepath.FromSlash(storageKey))
	destFile, err := os.OpenFile(targetFilePath, os.O_CREATE|os.O_WRONLY|os.O_TRUNC, 0o644)
	if err != nil {
		return nil, fmt.Errorf("storage: create file: %w", err)
	}
	defer destFile.Close()

	hasher := sha256.New()
	multiWriter := io.MultiWriter(destFile, hasher)

	size, err := io.Copy(multiWriter, r)
	if err != nil {
		_ = os.Remove(targetFilePath)
		return nil, fmt.Errorf("storage: write file: %w", err)
	}

	checksum := hex.EncodeToString(hasher.Sum(nil))
	now := time.Now().UTC()

	stored := &StoredFile{
		ID:          fileID,
		TenantID:    tenantID,
		StorageKey:  storageKey,
		FileName:    fileName,
		ContentType: contentType,
		SizeBytes:   size,
		SHA256:      checksum,
		CreatedBy:   createdBy,
		CreatedAt:   now,
	}

	if s.pool != nil {
		query := `
			INSERT INTO station.stored_file (
				id, tenant_id, storage_key, file_name, content_type,
				size_bytes, sha256, created_by, created_at
			) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
		`
		_, err := s.pool.Exec(ctx, query,
			stored.ID,
			stored.TenantID,
			stored.StorageKey,
			stored.FileName,
			stored.ContentType,
			stored.SizeBytes,
			stored.SHA256,
			stored.CreatedBy,
			stored.CreatedAt,
		)
		if err != nil {
			_ = os.Remove(targetFilePath)
			return nil, fmt.Errorf("storage: record file in db: %w", err)
		}
	}

	return stored, nil
}

// Open opens a stored file by tenant and key.
func (s *LocalDiskStorage) Open(ctx context.Context, tenantID uuid.UUID, storageKey string) (io.ReadCloser, error) {
	// Sanitize against directory traversal
	cleanKey := filepath.Clean(filepath.FromSlash(storageKey))
	if filepath.IsAbs(cleanKey) || len(cleanKey) > 0 && cleanKey[0] == '.' {
		return nil, errors.New("storage: invalid storage key")
	}

	targetFilePath := filepath.Join(s.baseDir, tenantID.String(), cleanKey)
	file, err := os.Open(targetFilePath)
	if err != nil {
		return nil, fmt.Errorf("storage: open file: %w", err)
	}

	return file, nil
}
