package app

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"time"

	"fuel-station-backend/internal/config"
	"fuel-station-backend/internal/modules/assets"
	"fuel-station-backend/internal/modules/auth"
	"fuel-station-backend/internal/modules/edge"
	"fuel-station-backend/internal/modules/iam"
	"fuel-station-backend/internal/modules/master"
	"fuel-station-backend/internal/modules/quota"
	"fuel-station-backend/internal/platform/postgres"
	"fuel-station-backend/internal/shared/httpx"
	"fuel-station-backend/internal/shared/middleware"
	"fuel-station-backend/internal/shared/storage"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// Run executes the composition root, wiring dependencies and starting HTTP server with graceful shutdown.
func Run(ctx context.Context, cfg config.Config, log *slog.Logger) error {
	// Execute embedded migrations cleanly via platform migrator
	if err := postgres.RunMigrations(cfg.DB.URL, log); err != nil {
		if cfg.Env != "local" {
			return fmt.Errorf("database migration failed in environment '%s': %w", cfg.Env, err)
		}
		log.WarnContext(ctx, "database migration warning (proceeding in local dev mode)", "err", err)
	}

	var pool *pgxpool.Pool
	var err error
	pool, err = postgres.New(ctx, cfg.DB.URL, cfg.DB.MaxConns)
	if err != nil {
		if cfg.Env != "local" {
			return fmt.Errorf("failed to connect to postgres pool in environment '%s': %w", cfg.Env, err)
		}
		log.WarnContext(ctx, "could not connect to postgres, running in fallback mode for local dev", "err", err)
	} else {
		defer pool.Close()
		log.InfoContext(ctx, "connected to postgres database pool successfully")
	}

	// Router setup
	r := chi.NewRouter()
	r.Use(middleware.CORS(cfg.CORS.AllowedOrigins))
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

	sessionValidator := middleware.NewPostgresSessionValidator(pool)
	authMiddleware := middleware.RequireAuth(sessionValidator, log)

	authRepo := auth.NewRepository(pool)
	authService := auth.NewService(authRepo, pool, log)
	authHandler := auth.NewHandler(authService, log)

	iamService := iam.NewService(pool)
	iamHandler := iam.NewHandler(iamService, log)

	assetsService := assets.NewService(pool)
	assetsHandler := assets.NewHandler(assetsService, log)

	quotaService := quota.NewService(pool)
	quotaHandler := quota.NewHandler(quotaService, log)

	diskStorage, err := storage.NewLocalDiskStorage(cfg.Storage.Dir, pool)
	if err != nil {
		log.WarnContext(ctx, "failed to initialize local disk storage", "err", err)
	}

	masterService := master.NewService(pool, diskStorage)
	masterHandler := master.NewHandler(masterService, log)

	edgeRepo := edge.NewRepository(pool)
	edgeService := edge.NewService(edgeRepo, log)
	edgeHandler := edge.NewHandler(edgeService, log)

	// Edge Agent Dedicated API Mount (/edge/v1)
	r.Route("/edge/v1", func(er chi.Router) {
		edgeHandler.RegisterRoutes(er, edge.RequireEdgeApiKey(edgeRepo, log))
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

		r.Route("/auth", func(authRouter chi.Router) {
			authHandler.RegisterRoutes(authRouter, authMiddleware)
		})
		iamHandler.RegisterRoutes(r, authMiddleware)
		assetsHandler.RegisterRoutes(r, authMiddleware)
		quotaHandler.RegisterRoutes(r, authMiddleware)
		masterHandler.RegisterRoutes(r, authMiddleware)
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
