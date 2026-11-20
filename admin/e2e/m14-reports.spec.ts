import { test, expect } from '@playwright/test';

test.describe('Module M14 - Reports & Exports (6 Templates, Strictly NO Money)', () => {
  test.beforeEach(async ({ page }) => {
    // 1. Mock user profile: Manager with report:view and report:export
    await page.route('**/auth/me', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'u-mgr-01',
          tenantId: 't-01',
          username: 'quanly',
          fullName: 'Nguyễn Văn Quản Lý',
          email: 'quanly@station.vn',
          employeeCode: 'QL-001',
          role: 'MANAGER',
          roleName: 'Quản lý',
          permissions: [
            'dashboard:view',
            'report:view',
            'report:export',
            'inventory.receipt:view',
            'dispense.session:view',
          ],
        }),
      });
    });

    // 2. Mock branches and tanks
    await page.route('**/assets/branches*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: [
            { id: 'b-01', code: 'CN-01', name: 'Trạm Xăng Dầu Số 1', active: true },
            { id: 'b-02', code: 'CN-02', name: 'Trạm Xăng Dầu Số 2', active: true },
          ],
          total: 2,
        }),
      });
    });

    await page.route('**/assets/tanks*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: [
            { id: 'tank-01', code: 'B01', name: 'Bể DO 01', branch_id: 'b-01' },
            { id: 'tank-02', code: 'B02', name: 'Bể RON95 01', branch_id: 'b-01' },
          ],
          total: 2,
        }),
      });
    });

    // 3. Mock Report 1: Stock Ledger
    await page.route('**/reports/stock-ledger*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          summary: [
            {
              tank_id: 'tank-01',
              tank_code: 'B01',
              tank_name: 'Bể DO 01',
              fuel_type_name: 'DO 0.05S',
              branch_name: 'Trạm Xăng Dầu Số 1',
              capacity_liters: 25000,
              opening_liters: 5000,
              receipt_liters: 12000,
              dispense_liters: 4500,
              issue_liters: 100,
              adjust_liters: 0,
              closing_liters: 12400,
            },
          ],
          ledger: [
            {
              id: 1,
              tank_id: 'tank-01',
              tank_code: 'B01',
              tank_name: 'Bể DO 01',
              seq: 1,
              occurred_at: '2026-11-20T08:00:00Z',
              kind: 'receipt',
              kind_label: 'Nhập bể',
              ref_type: 'stock_receipt',
              ref_code: 'PN-2026-0001',
              note: 'Nhập lô xe bồn 29C-8888',
              in_liters: 12000,
              out_liters: 0,
              balance_liters: 17000,
            },
            {
              id: 2,
              tank_id: 'tank-01',
              tank_code: 'B01',
              tank_name: 'Bể DO 01',
              seq: 2,
              occurred_at: '2026-11-20T09:30:00Z',
              kind: 'dispense',
              kind_label: 'Cấp phát',
              ref_type: 'dispense_session',
              ref_code: 'GD-2026-0001',
              note: 'Bơm cho xe 29A-12345',
              in_liters: 0,
              out_liters: 150,
              balance_liters: 16850,
            },
          ],
        }),
      });
    });

    // 4. Mock Report 2: Receipts
    await page.route('**/reports/receipts*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          items: [
            {
              id: 'rc-01',
              receipt_code: 'PN-2026-0001',
              received_at: '2026-11-20T08:00:00Z',
              tanker_plate: '29C-8888',
              document_no: 'CT-PETRO-9988',
              status: 'approved',
              note: 'Nhập kho đủ niêm phong',
              supplier_name: 'Tổng kho Xăng Dầu Đức Giang',
              branch_name: 'Trạm Xăng Dầu Số 1',
              tank_name: 'Bể DO 01',
              fuel_type_name: 'DO 0.05S',
              document_liters: 12000,
              actual_liters: 11985,
              variance_liters: -15,
              created_by_name: 'Lê Văn Kho',
              decided_by_name: 'Nguyễn Văn Quản Lý',
              decided_at: '2026-11-20T08:30:00Z',
            },
          ],
          total_document_liters: 12000,
          total_actual_liters: 11985,
          total_variance_liters: -15,
          total_count: 1,
        }),
      });
    });

    // 5. Mock Report 3: Dispenses
    await page.route('**/reports/dispenses*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          items: [
            {
              id: 'ds-01',
              code: 'GD-2026-0001',
              finished_at: '2026-11-20T09:30:00Z',
              started_at: '2026-11-20T09:25:00Z',
              pump_name: 'Trụ bơm 01',
              tank_name: 'Bể DO 01',
              fuel_type_name: 'DO 0.05S',
              branch_name: 'Trạm Xăng Dầu Số 1',
              vehicle_plate: '29A-12345',
              vehicle_code: 'XE-001',
              driver_name: 'Trần Văn Lái',
              driver_code: 'TX-001',
              dispensed_liters: 150.5,
              pump_total_liters: 85230.5,
              sale_seq: 142,
              status: 'completed',
            },
          ],
          total_sessions: 1,
          total_dispensed_liters: 150.5,
          page: 1,
          page_size: 50,
          total_pages: 1,
        }),
      });
    });

    // 6. Mock Report 4: Vehicle Consumption
    await page.route('**/reports/vehicle-consumption*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          items: [
            {
              vehicle_id: 'v-01',
              vehicle_code: 'XE-001',
              vehicle_plate: '29A-12345',
              group_name: 'Đội xe vận tải 1',
              type_name: 'Xe tải 10 tấn',
              route_name: 'Hà Nội - Hải Phòng',
              session_count: 5,
              total_dispensed_liters: 450.0,
              quota_liters: 500.0,
              quota_period: 'week',
              variance_liters: -50.0,
              status: 'normal',
            },
            {
              vehicle_id: 'v-02',
              vehicle_code: 'XE-002',
              vehicle_plate: '29A-67890',
              group_name: 'Đội xe vận tải 1',
              type_name: 'Xe ben 15 tấn',
              route_name: 'Hà Nội - Quảng Ninh',
              session_count: 8,
              total_dispensed_liters: 620.0,
              quota_liters: 500.0,
              quota_period: 'week',
              variance_liters: 120.0,
              status: 'over_quota',
            },
          ],
          total_vehicles: 2,
          total_sessions: 13,
          total_dispensed_liters: 1070.0,
        }),
      });
    });

    // 7. Mock Report 5: Driver Dispense
    await page.route('**/reports/driver-dispense*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          items: [
            {
              driver_id: 'd-01',
              driver_code: 'TX-001',
              driver_name: 'Trần Văn Lái',
              phone: '0981122334',
              session_count: 5,
              total_dispensed_liters: 450.0,
              avg_liters_per_session: 90.0,
              vehicles_used: '29A-12345',
            },
          ],
          total_drivers: 1,
          total_sessions: 5,
          total_dispensed_liters: 450.0,
        }),
      });
    });

    // 8. Mock Report 6: Reconciliation
    await page.route('**/reports/reconciliation*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          items: [
            {
              id: 'rec-01',
              period_date: '2026-11-20',
              branch_name: 'Trạm Xăng Dầu Số 1',
              tank_name: 'Bể DO 01',
              tank_code: 'B01',
              fuel_type_name: 'DO 0.05S',
              opening_liters: 5000,
              receipts_liters: 12000,
              dispensed_liters: 4500,
              other_issues_liters: 100,
              book_closing_liters: 12400,
              measured_liters: 12385,
              pump_totalizer_liters: 4500,
              variance_liters: -15,
              variance_pct: -0.12,
              tolerance_pct: 0.5,
              status: 'confirmed',
              measured_by_name: 'Lê Văn Đo',
              confirmed_by_name: 'Phạm Thị Kế Toán',
            },
          ],
          total_count: 1,
          matched_count: 0,
          alert_count: 0,
          confirmed_count: 1,
          total_variance_liters: -15,
        }),
      });
    });
  });

  test('TC-M14-01: Manager can access /reports and view non-money scope notice', async ({ page }) => {
    await page.goto('/reports');
    await expect(page.locator('h1')).toContainText('Báo Cáo & Xuất Dữ Liệu');

    // Verify non-money scope banner is present
    await expect(page.getByText('Chỉ quản lý Lít • Không có cột tiền')).toBeVisible();

    // Verify Export Excel and Print buttons exist
    await expect(page.getByRole('button', { name: /Xuất Excel/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /In \/ PDF/i })).toBeVisible();
  });

  test('TC-M14-02: Strictly NO Money columns exist on all report views', async ({ page }) => {
    await page.goto('/reports');

    // 1. Stock Ledger view
    await expect(page.getByText('Tổng hợp Nhập – Xuất – Tồn theo Bể chứa')).toBeVisible();

    // Verify that NO money columns exist in any table header
    const forbiddenWords = ['Đơn giá', 'Thành tiền', 'VAT', 'Giá vốn', '₫', 'VND'];
    for (const word of forbiddenWords) {
      await expect(page.locator('th').filter({ hasText: word })).toHaveCount(0);
    }

    // Verify volume (Liters) headers exist
    await expect(page.locator('th', { hasText: 'Dung tích (L)' })).toBeVisible();
    await expect(page.locator('th', { hasText: 'Tồn đầu (L)' })).toBeVisible();
    await expect(page.locator('th', { hasText: 'Tổng nhập (L)' })).toBeVisible();
    await expect(page.locator('th', { hasText: 'Cấp phát (L)' })).toBeVisible();
    await expect(page.locator('th', { hasText: 'Tồn cuối (L)' })).toBeVisible();

    // Check footer totals
    await expect(page.getByText('TỔNG CỘNG (LÍT):')).toBeVisible();
  });

  test('TC-M14-03: Tab navigation renders all 6 report templates correctly', async ({ page }) => {
    await page.goto('/reports');

    // Tab 1: Nhập - Xuất - Tồn (Default)
    await expect(page.getByRole('cell', { name: 'Bể DO 01' }).first()).toBeVisible();
    await expect(page.getByText('PN-2026-0001')).toBeVisible();

    // Tab 2: Bảng kê phiếu nhập
    await page.getByRole('tab', { name: 'Bảng kê phiếu nhập' }).click();
    await expect(page.getByText('Tổng số chuyến nhập')).toBeVisible();
    await expect(page.getByText('29C-8888')).toBeVisible();
    await expect(page.getByText('Tổng kho Xăng Dầu Đức Giang')).toBeVisible();

    // Tab 3: Lịch sử cấp phát
    await page.getByRole('tab', { name: 'Lịch sử cấp phát' }).click();
    await expect(page.getByText('Tổng số lượt đổ nhiên liệu')).toBeVisible();
    await expect(page.getByText('GD-2026-0001')).toBeVisible();
    await expect(page.getByText('Trần Văn Lái')).toBeVisible();

    // Tab 4: Tiêu hao theo xe
    await page.getByRole('tab', { name: 'Tiêu hao theo xe' }).click();
    await expect(page.getByText('Tổng nhiên liệu tiêu thụ toàn đội xe')).toBeVisible();
    await expect(page.getByText('29A-12345')).toBeVisible();
    await expect(page.getByText('29A-67890')).toBeVisible();
    await expect(page.getByText('Trong định mức')).toBeVisible();
    await expect(page.getByText('Vượt định mức')).toBeVisible();

    // Tab 5: Cấp phát theo tài xế
    await page.getByRole('tab', { name: 'Cấp phát theo tài xế' }).click();
    await expect(page.getByText('Tổng số tài xế nhận nhiên liệu')).toBeVisible();
    await expect(page.getByText('TX-001')).toBeVisible();
    await expect(page.getByText('0981122334')).toBeVisible();

    // Tab 6: Đối chiếu kiểm kê
    await page.getByRole('tab', { name: 'Đối chiếu kiểm kê' }).click();
    await expect(page.getByText('Tổng số biên bản kiểm kê')).toBeVisible();
    await expect(page.getByText('Đã xác nhận')).toBeVisible();
    await expect(page.getByText('Phạm Thị Kế Toán')).toBeVisible();
  });

  test('TC-M14-04: Date range filter presets update date inputs', async ({ page }) => {
    await page.goto('/reports');

    // Click "7 ngày qua"
    await page.getByRole('button', { name: '7 ngày qua' }).click();

    // Verify date inputs are populated
    const fromInput = page.locator('input[type="date"]').first();
    const toInput = page.locator('input[type="date"]').nth(1);

    await expect(fromInput).not.toHaveValue('');
    await expect(toInput).not.toHaveValue('');

    // Click "Đặt lại bộ lọc"
    await page.getByRole('button', { name: 'Đặt lại bộ lọc' }).click();
    await expect(fromInput).not.toHaveValue('');
  });

  test('TC-M14-05: Excel export button triggers download successfully', async ({ page }) => {
    await page.goto('/reports');

    // Trigger excel download
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: /Xuất Excel/i }).click();

    const download = await downloadPromise;
    expect(download.suggestedFilename()).toContain('Bao_cao_nhap_xuat_ton_be');
    expect(download.suggestedFilename()).toContain('.xlsx');
  });

  test('TC-M14-06: IT role without report:view permission does NOT see reports menu', async ({ page }) => {
    // Mock user as IT
    await page.route('**/auth/me', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'u-it-01',
          tenantId: 't-01',
          username: 'it_tech',
          fullName: 'Kỹ Thuật Viên IT',
          email: 'it@station.vn',
          employeeCode: 'IT-001',
          role: 'IT',
          roleName: 'IT kỹ thuật',
          permissions: ['dashboard:view', 'sync.monitor:view', 'audit.log:view'],
        }),
      });
    });

    await page.goto('/');
    // Báo cáo link in sidebar should not be visible for IT
    await expect(page.getByRole('link', { name: 'Báo cáo', exact: true })).toHaveCount(0);
  });
});
