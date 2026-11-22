package master_test

import (
	"testing"

	"fuel-station-backend/internal/modules/master"
)

// Nhập hàng loạt: dòng hợp lệ được tạo, dòng lỗi (thiếu họ tên) được báo đúng số dòng, không làm hỏng các dòng khác.
func TestImportDriversReportsFailedRowsAndCreatesTheRest(t *testing.T) {
	svc, pool, ctx, _ := scopeSetup(t)
	defer pool.Close()

	result, err := svc.ImportDrivers(ctx, master.ImportDriversRequest{Rows: []master.CreateDriverRequest{
		{FullName: "Nhập thử A"},
		{FullName: ""},
		{FullName: "Nhập thử B"},
		{FullName: "   "},
	}})
	if err != nil {
		t.Fatalf("ImportDrivers failed: %v", err)
	}
	// Dọn các tài xế vừa nhập (mã do hệ thống sinh nên xóa theo tên riêng của dữ liệu thử).
	defer func() {
		_, _ = pool.Exec(ctx, `UPDATE station.driver SET deleted_at = now() WHERE full_name IN ('Nhập thử A', 'Nhập thử B') AND deleted_at IS NULL`)
	}()

	if result.Created != 2 {
		t.Fatalf("expected 2 created, got %d (failed: %+v)", result.Created, result.Failed)
	}
	if len(result.Failed) != 2 || result.Failed[0].Row != 2 || result.Failed[1].Row != 4 {
		t.Fatalf("expected rows 2 and 4 to fail, got %+v", result.Failed)
	}
}

func TestImportDriversRejectsEmptyAndOversizedRequests(t *testing.T) {
	svc, pool, ctx, _ := scopeSetup(t)
	defer pool.Close()

	if _, err := svc.ImportDrivers(ctx, master.ImportDriversRequest{}); err == nil {
		t.Fatal("expected an error for an empty import")
	}
	tooMany := make([]master.CreateDriverRequest, master.MaxImportRows+1)
	if _, err := svc.ImportDrivers(ctx, master.ImportDriversRequest{Rows: tooMany}); err == nil {
		t.Fatal("expected an error for more than MaxImportRows rows")
	}
}
