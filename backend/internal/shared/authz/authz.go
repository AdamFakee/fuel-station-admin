package authz

import (
	"context"
	"log/slog"
	"net/http"

	"fuel-station-backend/internal/shared/apperr"
	"fuel-station-backend/internal/shared/httpx"
)

type contextKey struct{}

// Permission type alias
type Permission string

// Principal represents the authenticated actor context, multi-tenant scope, and role permissions.
type Principal struct {
	UserID    string
	TenantID  string
	RoleCode  string
	BranchIDs []string
	perms     map[Permission]struct{}
}

// NewPrincipal creates a new Principal.
func NewPrincipal(userID, tenantID, roleCode string, branchIDs []string, perms []Permission) Principal {
	m := make(map[Permission]struct{}, len(perms))
	for _, p := range perms {
		m[p] = struct{}{}
	}
	branches := make([]string, len(branchIDs))
	copy(branches, branchIDs)

	return Principal{
		UserID:    userID,
		TenantID:  tenantID,
		RoleCode:  roleCode,
		BranchIDs: branches,
		perms:     m,
	}
}

// Can checks if principal has the required permission.
func (p Principal) Can(perm Permission) bool {
	if p.perms == nil {
		return false
	}
	_, ok := p.perms[perm]
	return ok
}

// HasBranch checks if principal has access to a specific branch.
func (p Principal) HasBranch(branchID string) bool {
	for _, b := range p.BranchIDs {
		if b == branchID {
			return true
		}
	}
	return false
}

// HasAnyBranch checks if principal has access to any of the specified branches.
func (p Principal) HasAnyBranch(branchIDs ...string) bool {
	if len(branchIDs) == 0 {
		return true
	}
	for _, b := range branchIDs {
		if p.HasBranch(b) {
			return true
		}
	}
	return false
}

// WithPrincipal adds Principal to context.
func WithPrincipal(ctx context.Context, p Principal) context.Context {
	return context.WithValue(ctx, contextKey{}, p)
}

// FromContext extracts Principal from context.
func FromContext(ctx context.Context) (Principal, bool) {
	p, ok := ctx.Value(contextKey{}).(Principal)
	return p, ok
}

// RequirePermission enforces that the authenticated Principal has the required permission.
func RequirePermission(perm Permission, log *slog.Logger) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			p, ok := FromContext(r.Context())
			if !ok {
				httpx.Error(w, r, log, apperr.ErrUnauthorized)
				return
			}
			if !p.Can(perm) {
				httpx.Error(w, r, log, apperr.ErrForbidden)
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}
