package crypto

import (
	"bytes"
	"testing"
)

func TestAESGCM_EncryptDecrypt(t *testing.T) {
	key := DefaultCryptoKey
	plaintext := []byte("DevicePassword123@#$")

	ciphertext, err := EncryptAESGCM(plaintext, key)
	if err != nil {
		t.Fatalf("encryption failed: %v", err)
	}

	if bytes.Equal(ciphertext, plaintext) {
		t.Fatal("ciphertext equals plaintext")
	}

	decrypted, err := DecryptAESGCM(ciphertext, key)
	if err != nil {
		t.Fatalf("decryption failed: %v", err)
	}

	if !bytes.Equal(decrypted, plaintext) {
		t.Fatalf("expected '%s', got '%s'", plaintext, decrypted)
	}
}

func TestAESGCM_InvalidKey(t *testing.T) {
	_, err := EncryptAESGCM([]byte("hello"), []byte("short-key"))
	if err != ErrInvalidKeySize {
		t.Fatalf("expected ErrInvalidKeySize, got %v", err)
	}
}
