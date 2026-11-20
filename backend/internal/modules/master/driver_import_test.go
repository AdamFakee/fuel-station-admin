package master_test

import (
	"fmt"
	"testing"
	"time"

	"fuel-station-backend/internal/modules/master"
)

// Nhập hàng loạt: dòng hợp lệ được tạo, dòng lỗi (trùng mã) được báo đúng số dòng và mã, không làm hỏng các dòng khác.
func TestImportDriversReportsFailedRowsAndCreatesTheRest(t *testing.T) {
	svc, pool, ctx, _ := scopeSetup(t)
	defer pool.Close()

	suffix := time.Now().UnixNano() % 1000000
	codeA := fmt.Sprintf("IMP%dA", suffix)
	codeB := fmt.Sprintf("IMP%dB", suffix)

	result, err := svc.ImportDrivers(ctx, master.ImportDriversRequest{Rows: []master.CreateDriverRequest{
		{Code: codeA, FullName: "Nhập thử A"},
		{Code: codeA, FullName: "Trùng mã với dòng 1"},
		{Code: codeB, FullName: "Nhập thử B"},
		{Code: "", FullName: "Thiếu mã"},
	}})
	if err != nil {
		t.Fatalf("ImportDrivers failed: %v", err)
	}
	t.Cleanup(func() {
		_, _ = pool.Exec(ctx, `UPDATE station.driver SET deleted_at = now() WHERE code IN ($1, $2)`, codeA, codeB)
	})

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
