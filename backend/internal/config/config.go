package config

import (
	"fmt"
	"time"

	"github.com/caarlos0/env/v11"
)

// Config represents the fail-fast environment configuration for production.
type Config struct {
	Env  string `env:"APP_ENV" envDefault:"local"` // local | staging | production
	HTTP struct {
		Addr            string        `env:"HTTP_ADDR" envDefault:":8080"`
		ReadTimeout     time.Duration `env:"HTTP_READ_TIMEOUT" envDefault:"10s"`
		WriteTimeout    time.Duration `env:"HTTP_WRITE_TIMEOUT" envDefault:"15s"`
		ShutdownTimeout time.Duration `env:"HTTP_SHUTDOWN_TIMEOUT" envDefault:"20s"`
	}
	DB struct {
		URL      string `env:"DATABASE_URL" envDefault:"postgres://postgres:postgres@localhost:5432/fuel_station_db?sslmode=disable"`
		MaxConns int32  `env:"DB_MAX_CONNS" envDefault:"20"`
	}
}

// Load parses environment variables into Config and validates required fields.
func Load() (Config, error) {
	var cfg Config
	if err := env.Parse(&cfg); err != nil {
		return Config{}, fmt.Errorf("parse config: %w", err)
	}

	return cfg, nil
}
