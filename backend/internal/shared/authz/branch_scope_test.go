package authz

import (
	"context"
	"errors"
	"reflect"
	"testing"

	"fuel-station-backend/internal/shared/apperr"
)

const (
	branchA = "11111111-1111-1111-1111-111111111111"
	branchB = "22222222-2222-2222-2222-222222222222"
)

func ctxWithBranches(branchIDs ...string) context.Context {
	return WithPrincipal(context.Background(), NewPrincipal("user-1", "tenant-1", "MANAGER", branchIDs, nil))
}

func TestBranchScope(t *testing.T) {
	if got := BranchScope(ctxWithBranches()); got != nil {
		t.Fatalf("tài khoản toàn công ty phải không bị giới hạn, got %v", got)
	}
	if got := BranchScope(ctxWithBranches(branchA)); !reflect.DeepEqual(got, []string{branchA}) {
		t.Fatalf("scope = %v", got)
	}
	if got := BranchScope(context.Background()); got != nil {
		t.Fatalf("không có principal thì không có scope, got %v", got)
	}
}

func TestEnsureBranch(t *testing.T) {
	if err := EnsureBranch(ctxWithBranches(), branchB); err != nil {
		t.Fatalf("toàn công ty phải được phép: %v", err)
	}
	if err := EnsureBranch(ctxWithBranches(branchA), branchA); err != nil {
		t.Fatalf("trạm xăng trong phạm vi phải được phép: %v", err)
	}
	if err := EnsureBranch(ctxWithBranches(branchA), branchB); !errors.Is(err, apperr.ErrForbidden) {
		t.Fatalf("trạm xăng ngoài phạm vi phải bị chặn, got %v", err)
	}
	if err := EnsureBranch(context.Background(), branchA); !errors.Is(err, apperr.ErrUnauthorized) {
		t.Fatalf("chưa đăng nhập phải báo unauthorized, got %v", err)
	}
}

func TestAddBranchScope(t *testing.T) {
	where := []string{"t.tenant_id = $1"}
	args := []any{"tenant-1"}
	argIdx := 2

	AddBranchScope(ctxWithBranches(), "t.branch_id", &where, &args, &argIdx)
	if len(where) != 1 || len(args) != 1 || argIdx != 2 {
		t.Fatalf("toàn công ty không được thêm điều kiện: where=%v args=%v argIdx=%d", where, args, argIdx)
	}

	AddBranchScope(ctxWithBranches(branchA), "t.branch_id", &where, &args, &argIdx)
	if len(where) != 2 || where[1] != "t.branch_id = ANY($2::uuid[])" {
		t.Fatalf("where = %v", where)
	}
	if len(args) != 2 || !reflect.DeepEqual(args[1], []string{branchA}) || argIdx != 3 {
		t.Fatalf("args = %v argIdx = %d", args, argIdx)
	}
}
