package authz

import "context"

type contextKey struct{}

// Permission type alias
type Permission string

// Principal represents authenticated context and role permissions.
type Principal struct {
	UserID string
	perms  map[Permission]struct{}
}

// NewPrincipal creates a new Principal.
func NewPrincipal(userID string, perms []Permission) Principal {
	m := make(map[Permission]struct{}, len(perms))
	for _, p := range perms {
		m[p] = struct{}{}
	}
	return Principal{UserID: userID, perms: m}
}

// Can checks if principal has required permission.
func (p Principal) Can(perm Permission) bool {
	_, ok := p.perms[perm]
	return ok
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
