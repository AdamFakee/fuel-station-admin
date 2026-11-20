package edge

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"log/slog"
	"net/http"
	"strings"

	"fuel-station-backend/internal/shared/apperr"
	"fuel-station-backend/internal/shared/httpx"
	"fuel-station-backend/internal/shared/middleware"
)

type stationCtxKey struct{}

// WithStationContext injects StationContext into context.
func WithStationContext(ctx context.Context, station *StationContext) context.Context {
	return context.WithValue(ctx, stationCtxKey{}, station)
}

// StationFromContext extracts StationContext from context.
func StationFromContext(ctx context.Context) (*StationContext, bool) {
	val, ok := ctx.Value(stationCtxKey{}).(*StationContext)
	return val, ok && val != nil
}

// HashApiKey hashes a raw API key using SHA-256 to compare with api_key_hash in DB.
func HashApiKey(rawKey string) string {
	sum := sha256.Sum256([]byte(rawKey))
	return hex.EncodeToString(sum[:])
}

// RequireEdgeApiKey middleware authenticates Edge Agent using X-Api-Key header.
func RequireEdgeApiKey(repo Repository, log *slog.Logger) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			apiKey := strings.TrimSpace(r.Header.Get("X-Api-Key"))
			if apiKey == "" {
				httpx.Error(w, r, log, apperr.ErrUnauthorized)
				return
			}

			keyHash := HashApiKey(apiKey)
			station, err := repo.FindStationByApiKeyHash(r.Context(), keyHash)
			if err != nil {
				log.WarnContext(r.Context(), "edge station auth failed", "err", err)
				httpx.Error(w, r, log, apperr.ErrUnauthorized)
				return
			}

			// Inject station context and tenant context
			ctx := WithStationContext(r.Context(), station)
			ctx = middleware.WithTenantID(ctx, station.TenantID)

			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}
