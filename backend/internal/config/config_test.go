package config_test

import (
	"os"
	"testing"

	"fuel-station-backend/internal/config"
)

func TestLoad_Defaults(t *testing.T) {
	os.Clearenv()

	cfg, err := config.Load()
	if err != nil {
		t.Fatalf("expected no error loading defaults, got: %v", err)
	}

	if cfg.Env != "local" {
		t.Errorf("expected Env='local', got: '%s'", cfg.Env)
	}
	if cfg.HTTP.Addr != ":8080" {
		t.Errorf("expected HTTP.Addr=':8080', got: '%s'", cfg.HTTP.Addr)
	}
	if len(cfg.CORS.AllowedOrigins) == 0 || cfg.CORS.AllowedOrigins[0] != "http://localhost:3000" {
		t.Errorf("expected default CORS origin 'http://localhost:3000', got: %v", cfg.CORS.AllowedOrigins)
	}
}

func TestLoad_EnvOverrides(t *testing.T) {
	os.Clearenv()
	t.Setenv("APP_ENV", "production")
	t.Setenv("HTTP_ADDR", ":9090")
	t.Setenv("CORS_ALLOWED_ORIGINS", "https://admin.fuelstation.vn,https://app.fuelstation.vn")

	cfg, err := config.Load()
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if cfg.Env != "production" {
		t.Errorf("expected Env='production', got: '%s'", cfg.Env)
	}
	if cfg.HTTP.Addr != ":9090" {
		t.Errorf("expected HTTP.Addr=':9090', got: '%s'", cfg.HTTP.Addr)
	}
	if len(cfg.CORS.AllowedOrigins) != 2 {
		t.Fatalf("expected 2 CORS origins, got: %d (%v)", len(cfg.CORS.AllowedOrigins), cfg.CORS.AllowedOrigins)
	}
	if cfg.CORS.AllowedOrigins[0] != "https://admin.fuelstation.vn" {
		t.Errorf("unexpected origin 0: %s", cfg.CORS.AllowedOrigins[0])
	}
}
