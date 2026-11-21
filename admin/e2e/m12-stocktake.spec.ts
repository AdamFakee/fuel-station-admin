import { test, expect, Page, Route } from '@playwright/test';

test.describe('Module M12 - Kiểm kê, Tồn kho & Cảnh báo (Stocktake & Alerts) E2E Tests', () => {

  const setupMockData = async (page: Page, role: 'MANAGER' | 'ACCOUNTANT' = 'MANAGER') => {
    const isAccountant = role === 'ACCOUNTANT';

    // 1. Mock Auth
    await page.route('**/v1/auth/me*', async (route: Route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: isAccountant ? 'u-accountant' : 'u-manager',
          tenant_id: 't-01',
          tenant_code: 'CTY-01',
          tenant_name: 'Tổng Công ty Xăng Dầu Petromex',
          username: isAccountant ? 'ketoan' : 'quanly',
          full_name: isAccountant ? 'Trần Thị Kế Toán' : 'Nguyễn Văn Quản Lý',
          email: `${role.toLowerCase()}@petromex.vn`,
          employee_code: isAccountant ? 'NV-002' : 'NV-001',
          role_code: role,
          role_name: isAccountant ? 'Kế toán' : 'Quản lý',
          status: 'active',
          must_change_password: false,
          branch_ids: ['b-01'],
          permissions: isAccountant
            ? ['dashboard:view', 'inventory.stocktake:view', 'inventory.stocktake:approve']
            : [
                'dashboard:view',
                'inventory.stocktake:view',
                'inventory.stocktake:create',
                'inventory.stocktake:update',
              ],
        }),
      });
    });

    // 2. Mock Trạm xăng
    await page.route('**/v1/assets/branches*', async (route: Route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: [
            {
              id: 'b-01',
              tenant_id: 't-01',
              code: 'TRAM-01',
              name: 'Trạm Xăng Dầu Số 1',
              address: '123 Đường Giải Phóng, Hà Nội',
              status: 'active',
            },
          ],
          total: 1,
        }),
      });
    });

    // 3. Mock Tank Stock Ledger (phải đặt trước tanks/stock)
    await page.route('**/v1/inventory/tanks/*/ledger*', async (route: Route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          items: [
            {
              id: 1,
              tenant_id: 't-01',
              tank_id: 'tk-do-01',
              tank_code: 'TK-DO-01',
              tank_name: 'Bể Dầu DO Số 1',
              seq: 1,
              occurred_at: '2026-11-20T09:30:00Z',
              kind: 'dispense',
              delta_ml: -1500000,
              delta_liters: -1500,
              balance_after_ml: 18500000,
              balance_after_liters: 18500,
              ref_id: 'disp-sess-001',
              note: 'Bơm xuất ca sáng',
            },
            {
              id: 2,
              tenant_id: 't-01',
              tank_id: 'tk-do-01',
              tank_code: 'TK-DO-01',
              tank_name: 'Bể Dầu DO Số 1',
              seq: 2,
              occurred_at: '2026-11-20T07:15:00Z',
              kind: 'receipt',
              delta_ml: 2000000,
              delta_liters: 2000,
              balance_after_ml: 20000000,
              balance_after_liters: 20000,
              ref_id: 'rcpt-001',
              note: 'Nhập xe bồn BKS 29C-12345',
            },
          ],
          total: 2,
          page: 1,
          page_size: 20,
          total_pages: 1,
        }),
      });
    });

    // 4. Mock Tank Stocks
    await page.route('**/v1/inventory/tanks/stock*', async (route: Route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            tank_id: 'tk-do-01',
            branch_id: 'b-01',
            branch_name: 'Trạm Xăng Dầu Số 1',
            code: 'TK-DO-01',
            name: 'Bể Dầu DO Số 1',
            fuel_type_id: 'ft-01',
            fuel_type_name: 'Dầu DO 0.05S',
            max_capacity_liters: 25000,
            stock_liters: 18500,
            stock_pct: 74,
            low_stock_threshold_liters: 3000,
            is_low: false,
            updated_at: '2026-11-20T10:00:00Z',
          },
          {
            tank_id: 'tk-a95-01',
            branch_id: 'b-01',
            branch_name: 'Trạm Xăng Dầu Số 1',
            code: 'TK-A95-01',
            name: 'Bể Xăng RON 95 Số 1',
            fuel_type_id: 'ft-02',
            fuel_type_name: 'Xăng RON 95-III',
            max_capacity_liters: 20000,
            stock_liters: 2100,
            stock_pct: 10.5,
            low_stock_threshold_liters: 4000,
            is_low: true,
            updated_at: '2026-11-20T10:00:00Z',
          },
        ]),
      });
    });

    // 5. Mock Stocktake Summary
    await page.route('**/v1/inventory/stocktake/summary*', async (route: Route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          total_tanks: 2,
          low_stock_tanks: 1,
          open_stocktakes: 1,
          alert_stocktakes: 1,
          total_stock_liters: 20600,
        }),
      });
    });

    // 6. Mock Measure stock
    await page.route('**/v1/inventory/stocktake/*/measure', async (route: Route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'rec-01',
          status: 'matched',
          measured_liters: 18510,
          variance_liters: 10,
          variance_pct: 0.05,
        }),
      });
    });

    // 7. Mock Confirm stocktake
    await page.route('**/v1/inventory/stocktake/*/confirm', async (route: Route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'rec-02',
          status: 'confirmed',
          confirmed_by: 'u-accountant',
          confirmed_at: '2026-11-20T10:30:00Z',
        }),
      });
    });

    // 8. Mock Reconciliations list & create
    await page.route('**/v1/inventory/stocktake*', async (route: Route) => {
      if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({
            id: 'rec-03',
            tenant_id: 't-01',
            branch_id: 'b-01',
            branch_name: 'Trạm Xăng Dầu Số 1',
            tank_id: 'tk-do-01',
            tank_code: 'TK-DO-01',
            tank_name: 'Bể Dầu DO Số 1',
            fuel_type_id: 'ft-01',
            fuel_type_name: 'Dầu DO 0.05S',
            period_date: '2026-11-20',
            opening_liters: 18000,
            receipts_liters: 2000,
            dispensed_liters: 1500,
            other_issues_liters: 0,
            book_closing_liters: 18500,
            tolerance_pct: 0.5,
            status: 'open',
            created_at: '2026-11-20T08:00:00Z',
            updated_at: '2026-11-20T08:00:00Z',
          }),
        });
        return;
      }

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          items: [
            {
              id: 'rec-01',
              tenant_id: 't-01',
              branch_id: 'b-01',
              branch_name: 'Trạm Xăng Dầu Số 1',
              tank_id: 'tk-do-01',
              tank_code: 'TK-DO-01',
              tank_name: 'Bể Dầu DO Số 1',
              fuel_type_id: 'ft-01',
              fuel_type_name: 'Dầu DO 0.05S',
              period_date: '2026-11-20',
              opening_liters: 18000,
              receipts_liters: 2000,
              dispensed_liters: 1500,
              other_issues_liters: 0,
              book_closing_liters: 18500,
              tolerance_pct: 0.5,
              status: 'open',
              created_at: '2026-11-20T08:00:00Z',
              updated_at: '2026-11-20T08:00:00Z',
            },
            {
              id: 'rec-02',
              tenant_id: 't-01',
              branch_id: 'b-01',
              branch_name: 'Trạm Xăng Dầu Số 1',
              tank_id: 'tk-a95-01',
              tank_code: 'TK-A95-01',
              tank_name: 'Bể Xăng RON 95 Số 1',
              fuel_type_id: 'ft-02',
              fuel_type_name: 'Xăng RON 95-III',
              period_date: '2026-11-20',
              opening_liters: 10000,
              receipts_liters: 0,
              dispensed_liters: 2000,
              other_issues_liters: 0,
              book_closing_liters: 8000,
              measured_liters: 7800,
              variance_liters: -200,
              variance_pct: -2.5,
              tolerance_pct: 0.5,
              status: 'alert',
              measured_by: 'u-manager',
              measured_by_name: 'Nguyễn Văn Quản Lý',
              note: 'Nghi vấn rò rỉ que thăm đáy',
              created_at: '2026-11-20T08:00:00Z',
              updated_at: '2026-11-20T09:00:00Z',
            },
          ],
          total: 2,
          page: 1,
          page_size: 15,
          total_pages: 1,
        }),
      });
    });

    // 9. Mock Alerts resolve & list
    await page.route('**/v1/inventory/alerts/*/resolve', async (route: Route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true }),
      });
    });

    await page.route('**/v1/inventory/alerts*', async (route: Route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: 'alt-01',
            tenant_id: 't-01',
            branch_id: 'b-01',
            branch_name: 'Trạm Xăng Dầu Số 1',
            kind: 'low_stock',
            tank_id: 'tk-a95-01',
            tank_name: 'Bể Xăng RON 95 Số 1',
            message: 'Tồn kho Bể Xăng RON 95 Số 1 hiện còn 2,100 L, dưới ngưỡng an toàn (4,000 L).',
            created_at: '2026-11-20T09:00:00Z',
          },
          {
            id: 'alt-02',
            tenant_id: 't-01',
            branch_id: 'b-01',
            branch_name: 'Trạm Xăng Dầu Số 1',
            kind: 'loss_variance',
            tank_id: 'tk-a95-01',
            tank_name: 'Bể Xăng RON 95 Số 1',
            message: 'Sai lệch que thăm -200 L (-2.50%) vượt ngưỡng cho phép 0.50%.',
            created_at: '2026-11-20T09:15:00Z',
          },
        ]),
      });
    });
  };

  test('TC-M12-01: Hiển thị đúng 4 thẻ KPI Summary và danh sách phiếu kiểm kê', async ({ page }) => {
    await setupMockData(page, 'MANAGER');
    await page.goto('/inventory/stocktake');

    // Kiểm tra Header

    // Kiểm tra 4 thẻ KPI
    await expect(page.getByText('Tổng tồn kho toàn bể')).toBeVisible();
    await expect(page.getByText('20.600 L')).toBeVisible();

    await expect(page.getByText('Bể dưới mức tồn tối thiểu')).toBeVisible();
    await expect(page.getByText('Phiếu chờ nhập số đo')).toBeVisible();
    await expect(page.getByText('Phiếu vượt ngưỡng sai số')).toBeVisible();

    // Kiểm tra danh sách bảng đối chiếu
    await expect(page.getByRole('table')).toBeVisible();
    await expect(page.getByText('Bể Dầu DO Số 1')).toBeVisible();
    await expect(page.getByText('Bể Xăng RON 95 Số 1')).toBeVisible();

    // Kiểm tra badges trạng thái
    await expect(page.getByText('Chờ đo')).toBeVisible();
    await expect(page.getByText('Lệch ngưỡng')).toBeVisible();
  });

  test('TC-M12-02: Chuyển Tab "Tồn kho & Thẻ kho", xem thẻ bể và mở modal thẻ kho chi tiết', async ({ page }) => {
    await setupMockData(page, 'MANAGER');
    await page.goto('/inventory/stocktake');

    // Chuyển sang Tab "Tồn kho & Thẻ kho"
    await page.getByRole('tab', { name: 'Tồn kho & Thẻ kho' }).click();

    // Kiểm tra hiển thị thẻ bể
    await expect(page.getByText('TK-DO-01')).toBeVisible();
    await expect(page.getByText('An toàn')).toBeVisible();
    await expect(page.getByText('TK-A95-01')).toBeVisible();
    await expect(page.getByText('Tồn thấp')).toBeVisible();

    // Bấm nút xem thẻ kho chi tiết của bể DO
    const viewLedgerBtns = page.getByRole('button', { name: /Xem thẻ kho chi tiết/i });
    await viewLedgerBtns.first().click();

    // Dialog thẻ kho phải mở lên
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText(/Thẻ kho bể: Bể Dầu DO Số 1/i)).toBeVisible();
    await expect(dialog.getByText('Nhập xe bồn BKS 29C-12345')).toBeVisible();
    await expect(dialog.getByText('+2.000 L')).toBeVisible();
    await expect(dialog.getByText('-1.500 L')).toBeVisible();

    // Đóng dialog
    await dialog.getByRole('button', { name: 'Đóng' }).click();
    await expect(dialog).not.toBeVisible();
  });

  test('TC-M12-03: Quản lý nhập số đo thực tế que thăm, xem preview chênh lệch thời gian thực', async ({ page }) => {
    await setupMockData(page, 'MANAGER');
    await page.goto('/inventory/stocktake');

    // Bấm nút Nhập số đo (icon Ruler) trên dòng phiếu 'rec-01' (Chờ đo)
    const measureBtn = page.getByTitle('Nhập số đo que thăm thực tế').first();
    await measureBtn.click();

    // Modal nhập số đo xuất hiện
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText('Nhập số đo kiểm kê thực tế')).toBeVisible();
    await expect(dialog.getByText('18.500 L')).toBeVisible(); // Tồn cuối sổ

    // Nhập số đo thực tế que thăm: 18510 L (lệch +10 L, nằm trong sai số 0.5%)
    const measuredInput = dialog.locator('#measured_liters');
    await measuredInput.fill('18510');

    // Preview hiển thị khớp sổ
    await expect(dialog.getByText('Sai số nằm trong ngưỡng cho phép (Khớp sổ)')).toBeVisible();
    await expect(dialog.getByText('+10 L')).toBeVisible();

    // Nhập ghi chú
    await dialog.locator('#stocktake_note').fill('Đo que thăm chuẩn lúc 08:30 sáng');

    // Bấm lưu kết quả đo
    await dialog.getByRole('button', { name: 'Lưu kết quả đo' }).click();

    // Dialog đóng lại sau khi lưu thành công
    await expect(dialog).not.toBeVisible();
  });

  test('TC-M12-04: Kế toán mở dialog xác nhận kiểm kê cho phiếu lệch ngưỡng, tích chọn ghi bút toán điều chỉnh', async ({ page }) => {
    await setupMockData(page, 'ACCOUNTANT');
    await page.goto('/inventory/stocktake');

    // Dòng phiếu 'rec-02' đang ở trạng thái 'alert' (Lệch ngưỡng)
    const confirmBtn = page.getByTitle('Kế toán xác nhận chênh lệch kiểm kê');
    await confirmBtn.click();

    // Dialog xác nhận kiểm kê hiển thị
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText('Xác nhận kết quả đối soát kiểm kê')).toBeVisible();
    await expect(dialog.getByText('Lưu ý hao hụt vượt ngưỡng cho phép')).toBeVisible();
    await expect(dialog.getByText('-200 L').first()).toBeVisible();

    // Checkbox điều chỉnh tồn kho được tích mặc định
    const adjustCheckbox = dialog.locator('#adjust_ledger');
    await expect(adjustCheckbox).toBeChecked();

    // Điền ý kiến kế toán
    await dialog.locator('#confirm_note').fill('Đã kiểm tra biên bản hao hụt, duyệt điều chỉnh sổ sách.');

    // Bấm Phê duyệt & Chốt kiểm kê
    await dialog.getByRole('button', { name: 'Phê duyệt & Chốt kiểm kê' }).click();

    // Dialog đóng lại sau khi confirm
    await expect(dialog).not.toBeVisible();
  });

  test('TC-M12-05: Chuyển Tab "Cảnh báo", kiểm tra danh sách tồn thấp & hao hụt, thực hiện giải quyết cảnh báo', async ({ page }) => {
    await setupMockData(page, 'MANAGER');
    await page.goto('/inventory/stocktake');

    // Bấm Tab Cảnh báo
    await page.getByRole('tab', { name: /Cảnh báo/i }).click();

    // Kiểm tra 2 cảnh báo hiển thị trong bảng
    await expect(page.getByText('Tồn kho Bể Xăng RON 95 Số 1 hiện còn 2,100 L')).toBeVisible();
    await expect(page.getByText('Sai lệch que thăm -200 L (-2.50%)')).toBeVisible();

    // Bấm nút "Xử lý" trên một cảnh báo
    const resolveBtns = page.getByRole('button', { name: 'Xử lý' });
    await resolveBtns.first().click();

    // Toast thông báo thành công
    await expect(page.getByText('Đã giải quyết cảnh báo thành công')).toBeVisible();
  });

});
