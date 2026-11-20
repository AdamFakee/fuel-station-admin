package app

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"time"

	"fuel-station-backend/internal/config"
	"fuel-station-backend/internal/platform/postgres"
	"fuel-station-backend/internal/shared/httpx"
	"fuel-station-backend/internal/shared/middleware"

	"github.com/go-chi/chi/v5"
)

// Run executes the composition root, wiring dependencies and starting HTTP server with graceful shutdown.
func Run(ctx context.Context, cfg config.Config, log *slog.Logger) error {
	// Execute embedded migrations cleanly via platform migrator
	if err := postgres.RunMigrations(cfg.DB.URL, log); err != nil {
		log.WarnContext(ctx, "database migration warning (proceeding in dev mode)", "err", err)
	}

	pool, err := postgres.New(ctx, cfg.DB.URL, cfg.DB.MaxConns)
	if err != nil {
		log.WarnContext(ctx, "could not connect to postgres, running in fallback mode for dev", "err", err)
	} else {
		defer pool.Close()
		log.InfoContext(ctx, "connected to postgres database pool successfully")
	}

	// Router setup
	r := chi.NewRouter()
	r.Use(middleware.CORS)
	r.Use(middleware.RequestID)
	r.Use(middleware.Recover(log))
	r.Use(middleware.Logger(log))

	// Liveness & Readiness endpoints
	r.Get("/healthz", func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte("OK"))
	})

	r.Get("/readyz", func(w http.ResponseWriter, req *http.Request) {
		if pool != nil {
			if pingErr := pool.Ping(req.Context()); pingErr != nil {
				http.Error(w, "db ping failed", http.StatusServiceUnavailable)
				return
			}
		}
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte("READY"))
	})

	// V1 Protected & Business API Router Mount
	r.Route("/v1", func(r chi.Router) {
		// Ping / Status verification endpoint
		r.Get("/ping", func(w http.ResponseWriter, r *http.Request) {
			httpx.JSON(w, http.StatusOK, map[string]any{
				"status":    "healthy",
				"service":   "fuel-station-backend",
				"timestamp": time.Now().UTC().Format(time.RFC3339),
			})
		})

		// Sẵn sàng gắn các module nghiệp vụ mới theo chuẩn Modular Monolith:
		// e.g.:
		// pumpHandler.RegisterRoutes(r)
		// tankHandler.RegisterRoutes(r)
		// transactionHandler.RegisterRoutes(r)
	})

	srv := &http.Server{
		Addr:              cfg.HTTP.Addr,
		Handler:           r,
		ReadHeaderTimeout: 5 * time.Second,
		ReadTimeout:       cfg.HTTP.ReadTimeout,
		WriteTimeout:      cfg.HTTP.WriteTimeout,
		IdleTimeout:       60 * time.Second,
	}

	serverErrors := make(chan error, 1)
	go func() {
		log.Info("http server started", "addr", cfg.HTTP.Addr, "env", cfg.Env)
		serverErrors <- srv.ListenAndServe()
	}()

	select {
	case err := <-serverErrors:
		if !errors.Is(err, http.ErrServerClosed) {
			return fmt.Errorf("http server error: %w", err)
		}
	case <-ctx.Done():
		log.Info("shutdown signal received, closing server cleanly")
	}

	shutdownCtx, cancel := context.WithTimeout(context.Background(), cfg.HTTP.ShutdownTimeout)
	defer cancel()

	if err := srv.Shutdown(shutdownCtx); err != nil {
		return fmt.Errorf("http server forced shutdown: %w", err)
	}

	log.Info("server shutdown gracefully")
	return nil
}
