package authz

import (
	"context"
	"errors"
	"fmt"

	"fuel-station-backend/internal/shared/apperr"
	"github.com/jackc/pgx/v5"
)

// Phạm vi trạm xăng của tài khoản.
//
// Quy ước: tài khoản KHÔNG gán trạm xăng nào thì không bị giới hạn (xem toàn công ty);
// có gán thì chỉ được xem và thao tác dữ liệu của các trạm xăng đó. Mọi kiểm tra phạm vi đều
// làm ở backend, không dựa vào giao diện.

// Restricted cho biết tài khoản có bị giới hạn theo trạm xăng hay không.
func (p Principal) Restricted() bool { return len(p.BranchIDs) > 0 }

// CanAccessBranch: tài khoản có được phép dùng trạm xăng này không (không giới hạn thì luôn được).
func (p Principal) CanAccessBranch(branchID string) bool {
	return !p.Restricted() || p.HasBranch(branchID)
}

// BranchScope trả về danh sách trạm xăng được phép; nil nghĩa là không giới hạn.
func BranchScope(ctx context.Context) []string {
	p, ok := FromContext(ctx)
	if !ok || !p.Restricted() {
		return nil
	}
	return p.BranchIDs
}

// AddBranchScope thêm điều kiện `column = ANY($n)` vào câu truy vấn đang dựng khi tài khoản bị giới hạn.
// Nếu người dùng còn chỉ định một trạm xăng cụ thể (`requested`) thì trạm xăng đó phải nằm trong phạm vi:
// ngoài phạm vi thì điều kiện trả về tập rỗng chứ không báo lỗi, để không lộ trạm xăng đó có tồn tại hay không.
func AddBranchScope(ctx context.Context, column string, where *[]string, args *[]any, argIdx *int) {
	scope := BranchScope(ctx)
	if scope == nil {
		return
	}
	*where = append(*where, fmt.Sprintf("%s = ANY($%d::uuid[])", column, *argIdx))
	*args = append(*args, scope)
	*argIdx++
}

// EnsureBranch kiểm tra trạm xăng đích khi tạo hoặc sửa dữ liệu; ngoài phạm vi thì trả `ErrForbidden`.
func EnsureBranch(ctx context.Context, branchID string) error {
	p, ok := FromContext(ctx)
	if !ok {
		return apperr.ErrUnauthorized
	}
	// Chưa chọn trạm xăng thì để bước kiểm tra dữ liệu đầu vào báo thiếu, không báo ngoài phạm vi.
	if branchID != "" && !p.CanAccessBranch(branchID) {
		return apperr.ErrForbidden
	}
	return nil
}

// EnsureBranchVisible giống EnsureBranch nhưng dùng khi đọc/sửa một trạm xăng theo id:
// trạm xăng ngoài phạm vi trả `ErrNotFound` để không lộ trạm xăng đó có tồn tại hay không.
func EnsureBranchVisible(ctx context.Context, branchID string) error {
	err := EnsureBranch(ctx, branchID)
	if errors.Is(err, apperr.ErrForbidden) {
		return apperr.ErrNotFound
	}
	return err
}

// RowQuerier là phần tối thiểu của pgxpool/pgx.Tx dùng để tra trạm xăng của một bản ghi.
type RowQuerier interface {
	QueryRow(ctx context.Context, sql string, args ...any) pgx.Row
}

// scopedTables là danh sách bảng được phép tra trạm xăng (chống chèn tên bảng tùy ý).
var scopedTables = map[string]struct{}{
	"station.tank":                 {},
	"station.pump":                 {},
	"station.stock_receipt":        {},
	"station.stock_issue":          {},
	"station.stock_reconciliation": {},
	"station.alert":                {},
	"station.dispense_session":     {},
}

// EnsureRecordInScope kiểm tra bản ghi `id` của `table` có thuộc trạm xăng được phép không.
// Ngoài phạm vi trả `ErrNotFound` (giống như không tồn tại). Không tìm thấy bản ghi thì trả nil để nơi gọi tự báo lỗi của nó.
func EnsureRecordInScope(ctx context.Context, q RowQuerier, table, id string) error {
	p, ok := FromContext(ctx)
	if !ok {
		return apperr.ErrUnauthorized
	}
	if !p.Restricted() {
		return nil
	}
	if _, allowed := scopedTables[table]; !allowed {
		return fmt.Errorf("authz: bảng %q chưa khai báo phạm vi trạm xăng", table)
	}
	var branchID string
	err := q.QueryRow(ctx, fmt.Sprintf("SELECT branch_id::text FROM %s WHERE tenant_id = $1 AND id = $2", table), p.TenantID, id).Scan(&branchID)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil
	}
	if err != nil {
		return fmt.Errorf("authz: tra trạm xăng của bản ghi: %w", err)
	}
	if !p.HasBranch(branchID) {
		return apperr.ErrNotFound
	}
	return nil
}
