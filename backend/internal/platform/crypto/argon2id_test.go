package crypto

import (
	"testing"
)

func TestArgon2id_HashAndVerify(t *testing.T) {
	password := "Admin@123456"

	hashDefault, err := HashPassword(password)
	if err != nil {
		t.Fatalf("failed to hash password: %v", err)
	}
	t.Logf("Default hash for Admin@123456: %s", hashDefault)

	matchedDef, err := VerifyPassword(password, hashDefault)
	if err != nil || !matchedDef {
		t.Fatalf("verification error on default hash: %v", err)
	}

	wrongMatched, err := VerifyPassword("WrongPassword", hashDefault)
	if err != nil {
		t.Fatalf("verification error for wrong password: %v", err)
	}
	if wrongMatched {
		t.Fatal("expected wrong password to not match")
	}
}
