package inventory_test

import (
	"context"
	"fmt"
	"testing"
	"time"

	"fuel-station-backend/internal/modules/inventory"
	"fuel-station-backend/internal/shared/authz"
	"fuel-station-backend/internal/shared/middleware"
	"github.com/jackc/pgx/v5/pgxpool"
)

const (
	testDBURL       = "postgres://postgres:postgres@localhost:5432/fuel_station_db?sslmode=disable"
	defaultTenantID = "11111111-1111-1111-1111-111111111111"
	adminUserID     = "33333333-3333-3333-3333-333333333331"
	accountantID    = "33333333-3333-3333-3333-333333333332"
	branch1ID       = "22222222-2222-2222-2222-222222222221"
)

func setupTest(t *testing.T) (*inventory.Service, *pgxpool.Pool, context.Context) {
	ctx := context.Background()
	pool, err := pgxpool.New(ctx, testDBURL)
	if err != nil {
		t.Skipf("skipping test: database not reachable: %v", err)
	}

	if err := pool.Ping(ctx); err != nil {
		pool.Close()
		t.Skipf("skipping test: database ping failed: %v", err)
	}

	ctx = middleware.WithTenantID(ctx, defaultTenantID)
	principal := authz.NewPrincipal(
		adminUserID,
		defaultTenantID,
		"MANAGER",
		nil,
		[]authz.Permission{
			"inventory.receipt:view", "inventory.receipt:create",
			"inventory.receipt:update", "inventory.receipt:delete",
			"inventory.receipt:approve",
			"inventory.stocktake:view", "inventory.stocktake:create",
			"inventory.stocktake:update", "inventory.stocktake:approve",
		},
	)
	ctx = authz.WithPrincipal(ctx, principal)

	svc := inventory.NewService(pool)
	return svc, pool, ctx
}

func ensureTestTank(t *testing.T, ctx context.Context, pool *pgxpool.Pool) (string, string, string) {
	var branchID, fuelTypeID string
	err := pool.QueryRow(ctx, "SELECT id FROM station.branch WHERE tenant_id = $1 LIMIT 1", defaultTenantID).Scan(&branchID)
	if err != nil {
		err = pool.QueryRow(ctx, `
			INSERT INTO station.branch (tenant_id, code, name, status)
			VALUES ($1, 'BR-TEST-M10', 'Chi nhánh Test M10', 'active')
			RETURNING id
		`, defaultTenantID).Scan(&branchID)
		if err != nil {
			t.Fatalf("create test branch: %v", err)
		}
	}

	err = pool.QueryRow(ctx, "SELECT id FROM station.fuel_type WHERE tenant_id = $1 LIMIT 1", defaultTenantID).Scan(&fuelTypeID)
	if err != nil {
		err = pool.QueryRow(ctx, `
			INSERT INTO station.fuel_type (tenant_id, code, name)
			VALUES ($1, 'DO-M10', 'Dầu DO Test M10')
			RETURNING id
		`, defaultTenantID).Scan(&fuelTypeID)
		if err != nil {
			t.Fatalf("create test fuel type: %v", err)
		}
	}

	tankCode := fmt.Sprintf("TK-%d", time.Now().UnixNano()%10000000)
	var tankID string
	err = pool.QueryRow(ctx, `
		INSERT INTO station.tank (
			tenant_id, branch_id, code, name, fuel_type_id,
			design_capacity_ml, max_usable_capacity_ml, low_stock_threshold_ml, loss_tolerance_pct
		) VALUES ($1, $2, $3, 'Bể Test', $4, 50000000, 45000000, 3000000, 0.5)
		RETURNING id
	`, defaultTenantID, branchID, tankCode, fuelTypeID).Scan(&tankID)
	if err != nil {
		t.Fatalf("create test tank: %v", err)
	}

	_, err = pool.Exec(ctx, `
		INSERT INTO station.stock_ledger (tenant_id, tank_id, occurred_at, kind, delta_ml, note)
		VALUES ($1, $2, now() - INTERVAL '1 day', 'opening', 15000000, 'Tồn đầu kỳ test')
	`, defaultTenantID, tankID)
	if err != nil {
		t.Fatalf("create test opening stock: %v", err)
	}

	return branchID, tankID, fuelTypeID
}

func TestSupplierLifecycle(t *testing.T) {
	svc, pool, ctx := setupTest(t)
	defer pool.Close()

	code := fmt.Sprintf("SUP-%d", time.Now().UnixNano()%100000)
	phone := "0987654321"
	addr := "Tổng kho Xăng dầu Đức Giang, Hà Nội"

	sup, err := svc.CreateSupplier(ctx, inventory.CreateSupplierRequest{
		Code:    code,
		Name:    "Công ty Xăng Dầu Petromex miền Bắc",
		Phone:   &phone,
		Address: &addr,
	})
	if err != nil {
		t.Fatalf("CreateSupplier failed: %v", err)
	}
	if sup.Code != code {
		t.Fatalf("expected code %s, got %s", code, sup.Code)
	}

	list, err := svc.ListSuppliers(ctx)
	if err != nil {
		t.Fatalf("ListSuppliers failed: %v", err)
	}
	if len(list) == 0 {
		t.Fatalf("expected suppliers in list")
	}
}

func TestReceiptLifecycleAndStockLedgerIntegration(t *testing.T) {
	svc, pool, ctx := setupTest(t)
	defer pool.Close()

	// 1. Ensure branch, fuel type and tank
	branchID, tankID, fuelTypeID := ensureTestTank(t, ctx, pool)

	// 2. Pre-check Capacity
	incomingML := int64(3000000) // 3,000 L
	capCheck, err := svc.CheckCapacity(ctx, inventory.CapacityCheckRequest{
		TankID:         tankID,
		IncomingVolume: incomingML,
	})
	if err != nil {
		t.Fatalf("CheckCapacity failed: %v", err)
	}
	if capCheck.TankID != tankID {
		t.Fatalf("tank id mismatch in check")
	}

	// 3. Create Supplier
	supCode := fmt.Sprintf("SUP-%d", time.Now().UnixNano()%100000)
	sup, _ := svc.CreateSupplier(ctx, inventory.CreateSupplierRequest{
		Code: supCode,
		Name: "Nhà Cung Cấp Xăng Dầu Test",
	})

	// 4. Create Stock Receipt (Draft)
	plate := "29C-88899"
	docNo := "HĐ-123456"
	levelBefore := int64(1500)
	levelAfter := int64(4500)
	rc, err := svc.CreateReceipt(ctx, inventory.CreateReceiptRequest{
		BranchID:    branchID,
		ReceivedAt:  time.Now().UTC(),
		SupplierID:  &sup.ID,
		TankerPlate: &plate,
		DocumentNo:  &docNo,
		Lines: []inventory.StockReceiptLineInput{
			{
				TankID:           tankID,
				FuelTypeID:       fuelTypeID,
				DocumentVolumeML: 3000000,
				ActualVolumeML:   3000000,
				LevelBeforeML:    &levelBefore,
				LevelAfterML:     &levelAfter,
			},
		},
	})
	if err != nil {
		t.Fatalf("CreateReceipt failed: %v", err)
	}
	if rc.Status != "draft" {
		t.Fatalf("expected status draft, got %s", rc.Status)
	}
	if len(rc.Lines) != 1 {
		t.Fatalf("expected 1 line in receipt")
	}

	// 5. Submit for Approval (Pending)
	rc, err = svc.SubmitForApproval(ctx, rc.ID)
	if err != nil {
		t.Fatalf("SubmitForApproval failed: %v", err)
	}
	if rc.Status != "pending" {
		t.Fatalf("expected status pending, got %s", rc.Status)
	}

	// 6. Test Two-Person Rule: Same user approving their own document
	_, selfApproveErr := svc.ApproveReceipt(ctx, rc.ID, inventory.ApproveReceiptRequest{
		Approved: true,
	})

	var allowSelf bool
	_ = pool.QueryRow(ctx, "SELECT allow_self_approval FROM station.tenant_setting WHERE tenant_id = $1", defaultTenantID).Scan(&allowSelf)
	if !allowSelf && selfApproveErr == nil {
		t.Fatalf("expected error when approving own document without allow_self_approval")
	}

	// 7. Approve as a different user (e.g. accountantID or manager 2)
	approverCtx := middleware.WithTenantID(ctx, defaultTenantID)
	approverPrincipal := authz.NewPrincipal(
		accountantID,
		defaultTenantID,
		"MANAGER",
		[]string{branchID},
		[]authz.Permission{"inventory.receipt:approve", "inventory.receipt:view"},
	)
	approverCtx = authz.WithPrincipal(approverCtx, approverPrincipal)

	approvedRc, err := svc.ApproveReceipt(approverCtx, rc.ID, inventory.ApproveReceiptRequest{
		Approved: true,
	})
	if err != nil {
		t.Fatalf("ApproveReceipt by second user failed: %v", err)
	}
	if approvedRc.Status != "approved" {
		t.Fatalf("expected status approved, got %s", approvedRc.Status)
	}

	// 8. Verify Stock Ledger has been credited!
	var ledgerCount int
	var ledgerDelta int64
	err = pool.QueryRow(ctx, `
		SELECT COUNT(*), delta_ml
		FROM station.stock_ledger
		WHERE tenant_id = $1 AND ref_type = 'stock_receipt' AND ref_id = $2
		GROUP BY delta_ml
	`, defaultTenantID, rc.ID).Scan(&ledgerCount, &ledgerDelta)
	if err != nil {
		t.Fatalf("verify stock ledger failed: %v", err)
	}
	if ledgerCount != 1 || ledgerDelta != 3000000 {
		t.Fatalf("expected ledger entry of 3000000 ml, got count %d, delta %d", ledgerCount, ledgerDelta)
	}
}

func TestReceiptRejection(t *testing.T) {
	svc, pool, ctx := setupTest(t)
	defer pool.Close()

	branchID, tankID, fuelTypeID := ensureTestTank(t, ctx, pool)

	// Create and submit
	rc, err := svc.CreateReceipt(ctx, inventory.CreateReceiptRequest{
		BranchID: branchID,
		Lines: []inventory.StockReceiptLineInput{
			{
				TankID:           tankID,
				FuelTypeID:       fuelTypeID,
				DocumentVolumeML: 5000000,
				ActualVolumeML:   5000000,
			},
		},
	})
	if err != nil {
		t.Fatalf("CreateReceipt failed: %v", err)
	}

	rc, err = svc.SubmitForApproval(ctx, rc.ID)
	if err != nil {
		t.Fatalf("SubmitForApproval failed: %v", err)
	}

	// Reject
	reason := "Sai lệch số chứng từ giao nhận của xe bồn"
	rejectedRc, err := svc.ApproveReceipt(ctx, rc.ID, inventory.ApproveReceiptRequest{
		Approved:     false,
		RejectReason: &reason,
	})
	if err != nil {
		t.Fatalf("RejectReceipt failed: %v", err)
	}
	if rejectedRc.Status != "rejected" {
		t.Fatalf("expected status rejected, got %s", rejectedRc.Status)
	}
	if rejectedRc.RejectReason == nil || *rejectedRc.RejectReason != reason {
		t.Fatalf("reject reason mismatch: %v", rejectedRc.RejectReason)
	}
}

func TestStockIssueLifecycleAndLedger(t *testing.T) {
	svc, pool, ctx := setupTest(t)
	defer pool.Close()

	branchID, tankID, _ := ensureTestTank(t, ctx, pool)

	// 1. Create a loss issue (Hao hụt)
	volLiters := 250.0
	issue, err := svc.CreateIssue(ctx, inventory.CreateIssueRequest{
		BranchID:     branchID,
		Kind:         "loss",
		TankID:       tankID,
		VolumeLiters: &volLiters,
		Reason:       "Hao hụt tự nhiên do nhiệt độ bay hơi mùa hè",
	})
	if err != nil {
		t.Fatalf("CreateIssue failed: %v", err)
	}
	if issue.Status != "draft" {
		t.Fatalf("expected status draft, got %s", issue.Status)
	}
	if issue.VolumeML != 250000 {
		t.Fatalf("expected volume 250000 ml, got %d", issue.VolumeML)
	}

	// 2. Submit for approval
	submitted, err := svc.SubmitIssueForApproval(ctx, issue.ID)
	if err != nil {
		t.Fatalf("SubmitIssueForApproval failed: %v", err)
	}
	if submitted.Status != "pending" {
		t.Fatalf("expected status pending, got %s", submitted.Status)
	}

	// 3. Try to self-approve with same user (should fail due to guard_document rule)
	_, err = svc.ApproveIssue(ctx, issue.ID, inventory.ApproveIssueRequest{Approved: true})
	if err == nil {
		t.Fatalf("expected self-approval to be forbidden by guard_document, got nil")
	}

	// 4. Approve with Accountant (different user)
	approverCtx := middleware.WithTenantID(context.Background(), defaultTenantID)
	approverPrincipal := authz.NewPrincipal(
		accountantID,
		defaultTenantID,
		"ACCOUNTANT",
		[]string{branchID},
		[]authz.Permission{"inventory.issue:approve", "inventory.issue:view"},
	)
	approverCtx = authz.WithPrincipal(approverCtx, approverPrincipal)

	approved, err := svc.ApproveIssue(approverCtx, issue.ID, inventory.ApproveIssueRequest{Approved: true})
	if err != nil {
		t.Fatalf("ApproveIssue failed: %v", err)
	}
	if approved.Status != "approved" {
		t.Fatalf("expected status approved, got %s", approved.Status)
	}

	// 5. Verify Stock Ledger has negative delta (Xuất kho)
	var deltaML int64
	err = pool.QueryRow(ctx, `
		SELECT delta_ml FROM station.stock_ledger
		WHERE tenant_id = $1 AND ref_type = 'stock_issue' AND ref_id = $2
	`, defaultTenantID, issue.ID).Scan(&deltaML)
	if err != nil {
		t.Fatalf("query stock ledger for issue failed: %v", err)
	}
	if deltaML != -250000 {
		t.Fatalf("expected delta_ml -250000, got %d", deltaML)
	}

	// 6. Test Tank-to-Tank Transfer
	_, targetTankID, _ := ensureTestTank(t, ctx, pool)
	transferVol := 500.0
	transferIssue, err := svc.CreateIssue(ctx, inventory.CreateIssueRequest{
		BranchID:     branchID,
		Kind:         "transfer",
		TankID:       tankID,
		ToTankID:     &targetTankID,
		VolumeLiters: &transferVol,
		Reason:       "Điều chuyển cân đối sức chứa giữa 2 bể",
	})
	if err != nil {
		t.Fatalf("Create transfer issue failed: %v", err)
	}

	_, err = svc.SubmitIssueForApproval(ctx, transferIssue.ID)
	if err != nil {
		t.Fatalf("Submit transfer issue failed: %v", err)
	}

	approvedTransfer, err := svc.ApproveIssue(approverCtx, transferIssue.ID, inventory.ApproveIssueRequest{Approved: true})
	if err != nil {
		t.Fatalf("Approve transfer issue failed: %v", err)
	}
	if approvedTransfer.Status != "approved" {
		t.Fatalf("expected status approved, got %s", approvedTransfer.Status)
	}

	// Verify two ledger entries: transfer_out (-500000) and transfer_in (+500000)
	rows, err := pool.Query(ctx, `
		SELECT tank_id, kind, delta_ml FROM station.stock_ledger
		WHERE tenant_id = $1 AND ref_type = 'stock_issue' AND ref_id = $2
		ORDER BY delta_ml ASC
	`, defaultTenantID, transferIssue.ID)
	if err != nil {
		t.Fatalf("query transfer ledger entries: %v", err)
	}
	defer rows.Close()

	var entries []struct {
		tankID  string
		kind    string
		deltaML int64
	}
	for rows.Next() {
		var e struct {
			tankID  string
			kind    string
			deltaML int64
		}
		if err := rows.Scan(&e.tankID, &e.kind, &e.deltaML); err != nil {
			t.Fatalf("scan ledger: %v", err)
		}
		entries = append(entries, e)
	}

	if len(entries) != 2 {
		t.Fatalf("expected 2 ledger entries for transfer, got %d", len(entries))
	}
	if entries[0].kind != "transfer_out" || entries[0].deltaML != -500000 {
		t.Errorf("entry 0 mismatch: %v", entries[0])
	}
	if entries[1].kind != "transfer_in" || entries[1].deltaML != 500000 {
		t.Errorf("entry 1 mismatch: %v", entries[1])
	}
}

// ------------------------------------------------------------------------------------------------
// M12 TESTS: TỒN KHO, ĐỐI SOÁT KIỂM KÊ & CẢNH BÁO
// ------------------------------------------------------------------------------------------------

func TestM12_TankStockAndLedger(t *testing.T) {
	svc, pool, ctx := setupTest(t)
	defer pool.Close()

	branchID, tankID, _ := ensureTestTank(t, ctx, pool)

	// 1. List tank stocks
	stocks, err := svc.ListTankStocks(ctx, branchID)
	if err != nil {
		t.Fatalf("ListTankStocks failed: %v", err)
	}
	if len(stocks) == 0 {
		t.Fatalf("expected at least 1 tank stock item, got 0")
	}

	found := false
	for _, st := range stocks {
		if st.TankID == tankID {
			found = true
			if st.StockLiters < 0 {
				t.Errorf("expected non-negative stock liters, got %f", st.StockLiters)
			}
			break
		}
	}
	if !found {
		t.Errorf("tank %s not found in ListTankStocks", tankID)
	}

	// 2. List tank ledger
	ledgerItems, total, err := svc.ListTankStockLedger(ctx, tankID, 1, 10)
	if err != nil {
		t.Fatalf("ListTankStockLedger failed: %v", err)
	}
	if total == 0 || len(ledgerItems) == 0 {
		t.Fatalf("expected ledger entries for tank %s, got 0", tankID)
	}
	if ledgerItems[0].BalanceAfterLiters < 0 {
		t.Errorf("expected positive balance after liters, got %f", ledgerItems[0].BalanceAfterLiters)
	}
}

func TestM12_StockReconciliation_Workflow(t *testing.T) {
	svc, pool, ctx := setupTest(t)
	defer pool.Close()

	branchID, tankID, _ := ensureTestTank(t, ctx, pool)

	periodDate := time.Now().Format("2006-01-02")

	// 1. Generate or get reconciliation
	rec, err := svc.GenerateReconciliation(ctx, inventory.CreateReconciliationRequest{
		BranchID:   branchID,
		TankID:     tankID,
		PeriodDate: periodDate,
	})
	if err != nil {
		t.Fatalf("GenerateReconciliation failed: %v", err)
	}
	if rec.ID == "" {
		t.Fatalf("expected non-empty reconciliation ID")
	}

	// 2. Submit measured stock within tolerance -> status matched
	measuredLitersMatched := rec.BookClosingLiters // perfect match
	matchedRec, err := svc.SubmitMeasuredStock(ctx, rec.ID, inventory.SubmitMeasureRequest{
		MeasuredLiters: &measuredLitersMatched,
		Note:           ptr("Đo que thăm thực tế khớp sổ sách"),
	})
	if err != nil {
		t.Fatalf("SubmitMeasuredStock matched failed: %v", err)
	}
	if matchedRec.Status != "matched" {
		t.Errorf("expected status 'matched', got '%s'", matchedRec.Status)
	}

	// 3. Submit measured stock with deviation exceeding tolerance -> status alert
	// tolerance is typically 0.5%, let's deviate by 500 L
	deviatedLiters := rec.BookClosingLiters + 500.0
	alertRec, err := svc.SubmitMeasuredStock(ctx, rec.ID, inventory.SubmitMeasureRequest{
		MeasuredLiters: &deviatedLiters,
		Note:           ptr("Đo que thăm lệch 5%"),
	})
	if err != nil {
		t.Fatalf("SubmitMeasuredStock alert failed: %v", err)
	}
	if alertRec.Status != "alert" {
		t.Errorf("expected status 'alert', got '%s' (varPct=%v, tolPct=%v, measL=%v, bookL=%v)", alertRec.Status, alertRec.VariancePct, alertRec.TolerancePct, alertRec.MeasuredLiters, alertRec.BookClosingLiters)
	}

	// 4. Separation of duties: creator (adminUserID) cannot confirm
	_, err = svc.ConfirmReconciliation(ctx, rec.ID, inventory.ConfirmReconciliationRequest{
		AdjustLedger: false,
	})
	if err == nil {
		t.Errorf("expected error when same user confirms reconciliation (anti-self-approval), got nil")
	}

	// 5. Accountant confirms reconciliation
	accountantPrincipal := authz.NewPrincipal(
		accountantID,
		defaultTenantID,
		"ACCOUNTANT",
		[]string{branch1ID},
		[]authz.Permission{"inventory.stocktake:view", "inventory.stocktake:approve"},
	)
	accountantCtx := authz.WithPrincipal(ctx, accountantPrincipal)

	confirmedRec, err := svc.ConfirmReconciliation(accountantCtx, rec.ID, inventory.ConfirmReconciliationRequest{
		AdjustLedger: true,
		Note:         ptr("Kế toán trưởng phê duyệt đối soát"),
	})
	if err != nil {
		t.Fatalf("ConfirmReconciliation failed: %v", err)
	}
	if confirmedRec.Status != "confirmed" {
		t.Errorf("expected status 'confirmed', got '%s'", confirmedRec.Status)
	}
	if confirmedRec.ConfirmedBy == nil || *confirmedRec.ConfirmedBy != accountantID {
		t.Errorf("expected confirmed_by = accountantID")
	}
}

func TestM12_AlertsAndSummary(t *testing.T) {
	svc, pool, ctx := setupTest(t)
	defer pool.Close()

	branchID, tankID, _ := ensureTestTank(t, ctx, pool)

	// Summary
	sum, err := svc.GetStocktakeSummary(ctx, branchID)
	if err != nil {
		t.Fatalf("GetStocktakeSummary failed: %v", err)
	}
	if sum.TotalTanks == 0 {
		t.Errorf("expected at least 1 tank in summary, got 0")
	}

	// Check low stock
	_, err = svc.CheckLowStock(ctx)
	if err != nil {
		t.Fatalf("CheckLowStock failed: %v", err)
	}

	// List alerts
	alerts, err := svc.ListAlerts(ctx, branchID, nil)
	if err != nil {
		t.Fatalf("ListAlerts failed: %v", err)
	}
	_ = alerts
	_ = tankID
}

func ptr[T any](v T) *T {
	return &v
}
