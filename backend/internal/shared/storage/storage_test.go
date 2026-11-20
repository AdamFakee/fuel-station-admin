package storage_test

import (
	"bytes"
	"context"
	"io"
	"os"
	"strings"
	"testing"

	"fuel-station-backend/internal/shared/storage"
	"github.com/google/uuid"
)

func TestLocalDiskStorage_SaveAndOpen(t *testing.T) {
	tempDir, err := os.MkdirTemp("", "storage_test_*")
	if err != nil {
		t.Fatalf("failed to create temp dir: %v", err)
	}
	defer os.RemoveAll(tempDir)

	s, err := storage.NewLocalDiskStorage(tempDir, nil)
	if err != nil {
		t.Fatalf("failed to init storage: %v", err)
	}

	tenantID := uuid.New()
	content := "test file content: 1234567890"
	fileName := "document.pdf"
	contentType := "application/pdf"

	meta, err := s.Save(context.Background(), tenantID, fileName, contentType, nil, strings.NewReader(content))
	if err != nil {
		t.Fatalf("expected Save to succeed, got: %v", err)
	}

	if meta.SizeBytes != int64(len(content)) {
		t.Errorf("expected size %d, got %d", len(content), meta.SizeBytes)
	}
	if meta.FileName != fileName {
		t.Errorf("expected fileName %s, got %s", fileName, meta.FileName)
	}
	if meta.SHA256 == "" {
		t.Errorf("expected non-empty sha256 checksum")
	}

	// Verify file can be opened
	reader, err := s.Open(context.Background(), tenantID, meta.StorageKey)
	if err != nil {
		t.Fatalf("expected Open to succeed, got: %v", err)
	}
	defer reader.Close()

	var buf bytes.Buffer
	if _, err := io.Copy(&buf, reader); err != nil {
		t.Fatalf("failed to read stored file: %v", err)
	}
	if buf.String() != content {
		t.Errorf("expected content '%s', got '%s'", content, buf.String())
	}

	// Verify path traversal prevention
	_, err = s.Open(context.Background(), tenantID, "../../../etc/passwd")
	if err == nil {
		t.Errorf("expected path traversal to fail with error")
	}
}
