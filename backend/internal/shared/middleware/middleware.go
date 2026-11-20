package middleware

import (
	"context"
	"fmt"
	"log/slog"
	"net/http"
	"strings"
	"time"

	"fuel-station-backend/internal/shared/authz"
	"fuel-station-backend/internal/shared/httpx"
	"github.com/google/uuid"
)

type contextKey string

const (
	RequestIDKey contextKey = "request_id"
	TenantIDKey  contextKey = "tenant_id"
)

type statusRecorder struct {
	http.ResponseWriter
	status int
	bytes  int
}

func (r *statusRecorder) WriteHeader(status int) {
	r.status = status
	r.ResponseWriter.WriteHeader(status)
}

func (r *statusRecorder) Write(b []byte) (int, error) {
	n, err := r.ResponseWriter.Write(b)
	r.bytes += n
	return n, err
}

// RequestID attaches a unique request ID to each HTTP request context and response header.
func RequestID(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		reqID := r.Header.Get("X-Request-ID")
		if reqID == "" {
			reqID = uuid.NewString()
		}
		w.Header().Set("X-Request-ID", reqID)
		ctx := context.WithValue(r.Context(), RequestIDKey, reqID)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

// Recover recovers from panics and logs the stack trace.
func Recover(log *slog.Logger) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			defer func() {
				if err := recover(); err != nil {
					log.ErrorContext(r.Context(), "panic recovered", "panic", err, "path", r.URL.Path)
					httpx.Error(w, r, log, fmt.Errorf("panic: %v", err))
				}
			}()
			next.ServeHTTP(w, r)
		})
	}
}

// Logger logs HTTP request details including status, duration, request_id, and user_id.
func Logger(log *slog.Logger) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			start := time.Now()
			rec := &statusRecorder{ResponseWriter: w, status: http.StatusOK}

			next.ServeHTTP(rec, r)

			reqID, _ := r.Context().Value(RequestIDKey).(string)
			if reqID == "" {
				reqID = r.Header.Get("X-Request-ID")
			}

			attrs := []any{
				"method", r.Method,
				"path", r.URL.Path,
				"status", rec.status,
				"bytes", rec.bytes,
				"duration_ms", time.Since(start).Milliseconds(),
				"request_id", reqID,
				"ip", r.RemoteAddr,
			}

			if p, ok := authz.FromContext(r.Context()); ok {
				if p.UserID != "" {
					attrs = append(attrs, "user_id", p.UserID)
				}
				if p.TenantID != "" {
					attrs = append(attrs, "tenant_id", p.TenantID)
				}
			} else if tenantID, ok := TenantIDFromContext(r.Context()); ok && tenantID != "" {
				attrs = append(attrs, "tenant_id", tenantID)
			}

			log.InfoContext(r.Context(), "http request completed", attrs...)
		})
	}
}

// CORS provides configurable Cross-Origin Resource Sharing headers.
// Origins are strictly matched against allowedOrigins.
// X-Tenant-ID is strictly removed to prevent tenant injection attacks (P0 Security).
func CORS(allowedOrigins []string) func(http.Handler) http.Handler {
	allowedMap := make(map[string]struct{}, len(allowedOrigins))
	for _, o := range allowedOrigins {
		trimmed := strings.TrimSpace(o)
		if trimmed != "" {
			allowedMap[trimmed] = struct{}{}
		}
	}

	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			origin := r.Header.Get("Origin")
			if origin != "" {
				if _, ok := allowedMap[origin]; ok {
					w.Header().Set("Access-Control-Allow-Origin", origin)
					w.Header().Set("Access-Control-Allow-Credentials", "true")
					w.Header().Set("Vary", "Origin")
				}
			}

			w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")
			w.Header().Set("Access-Control-Allow-Headers", "Accept, Authorization, Content-Type, X-CSRF-Token, X-Request-ID")

			if r.Method == http.MethodOptions {
				w.WriteHeader(http.StatusNoContent)
				return
			}

			next.ServeHTTP(w, r)
		})
	}
}

// WithTenantID injects tenant_id into context for multi-tenant isolation.
func WithTenantID(ctx context.Context, tenantID string) context.Context {
	return context.WithValue(ctx, TenantIDKey, tenantID)
}

// TenantIDFromContext extracts tenant_id from context.
func TenantIDFromContext(ctx context.Context) (string, bool) {
	val, ok := ctx.Value(TenantIDKey).(string)
	return val, ok && val != ""
}
