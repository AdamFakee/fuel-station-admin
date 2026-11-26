import { test, expect, type Page } from '@playwright/test';

/** Chọn một dòng trong ô chọn tùy biến (Radix Select): mở ô rồi bấm dòng có tên khớp. */
async function pickOption(page: Page, triggerSelector: string, optionName: string | RegExp) {
  await page.locator(triggerSelector).click();
  await page.getByRole('option', { name: optionName }).click();
}

test.describe('Module M11 - Xuất điều chỉnh (Stock Issues) E2E Tests', () => {

  const setupMockData = async (page: any, role = 'MANAGER') => {
    // 1. Mock Auth user theo role
    await page.route('**/v1/auth/me*', async (route: any) => {
      const isAccountant = role === 'ACCOUNTANT';
      const isIT = role === 'IT';

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: isAccountant ? 'u-accountant' : isIT ? 'u-it' : 'u-manager',
          tenant_id: 't-01',
          tenant_code: 'CTY-01',
          tenant_name: 'Tổng Công ty Xăng Dầu Petromex',
          username: isAccountant ? 'ketoan' : isIT ? 'it_support' : 'quanly',
          full_name: isAccountant ? 'Trần Thị Kế Toán' : isIT ? 'Lê Văn IT' : 'Nguyễn Văn Quản Lý',
          email: `${role.toLowerCase()}@petromex.vn`,
          employee_code: isAccountant ? 'NV-002' : isIT ? 'NV-003' : 'NV-001',
          role_code: role,
          role_name: isAccountant ? 'Kế toán' : isIT ? 'IT' : 'Quản lý',
          status: 'active',
          must_change_password: false,
          permissions: isAccountant
            ? ['dashboard:view', 'inventory.issue:view', 'inventory.issue:approve']
            : isIT
            ? ['dashboard:view', 'inventory.issue:view']
            : [
                'dashboard:view',
                'inventory.issue:view',
                'inventory.issue:create',
                'inventory.issue:update',
                'inventory.issue:delete',
              ],
        }),
      });
    });

    // 2. Mock Trạm xăng
    await page.route('**/v1/assets/branches*', async (route: any) => {
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

    // 3. Mock Bể chứa
    await page.route('**/v1/assets/tanks*', async (route: any) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: [
            {
              id: 'tk-do-01',
              tenant_id: 't-01',
              branch_id: 'b-01',
              branch_name: 'Trạm Xăng Dầu Số 1',
              code: 'TK-DO-01',
              name: 'Bể Dầu DO Số 1',
              fuel_type_id: 'ft-01',
              fuel_type_name: 'Dầu DO 0.05S',
              design_capacity_ml: 25000000,
              max_usable_capacity_ml: 24000000,
              current_stock_ml: 15000000, // 15,000 L
              status: 'active',
            },
            {
              id: 'tk-do-02',
              tenant_id: 't-01',
              branch_id: 'b-01',
              branch_name: 'Trạm Xăng Dầu Số 1',
              code: 'TK-DO-02',
              name: 'Bể Dầu DO Số 2',
              fuel_type_id: 'ft-01',
              fuel_type_name: 'Dầu DO 0.05S',
              design_capacity_ml: 25000000,
              max_usable_capacity_ml: 24000000,
              current_stock_ml: 5000000, // 5,000 L
              status: 'active',
            },
            {
              id: 'tk-a95-01',
              tenant_id: 't-01',
              branch_id: 'b-01',
              branch_name: 'Trạm Xăng Dầu Số 1',
              code: 'TK-A95-01',
              name: 'Bể Xăng A95 Số 1',
              fuel_type_id: 'ft-02',
              fuel_type_name: 'Xăng RON 95-III',
              design_capacity_ml: 20000000,
              max_usable_capacity_ml: 19000000,
              current_stock_ml: 8000000, // 8,000 L
              status: 'active',
            },
          ],
          total: 3,
        }),
      });
    });
  };

  // ----------------------------------------------------------------------------------------------
  // Test 1: Hiển thị danh sách phiếu xuất điều chỉnh
  // ----------------------------------------------------------------------------------------------
  test('TC-M11-01: Hiển thị danh sách phiếu xuất điều chỉnh với các cột và định dạng Lít', async ({ page }) => {
    await setupMockData(page, 'MANAGER');

    await page.route('**/v1/inventory/issues*', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            items: [
              {
                id: 'is-01',
                tenant_id: 't-01',
                branch_id: 'b-01',
                branch_name: 'Trạm Xăng Dầu Số 1',
                code: 'PX-2026-0001',
                kind: 'transfer',
                kind_name: 'Điều chuyển nội bộ',
                tank_id: 'tk-do-01',
                tank_code: 'TK-DO-01',
                tank_name: 'Bể Dầu DO Số 1',
                fuel_type_id: 'ft-01',
                fuel_type_name: 'Dầu DO 0.05S',
                to_tank_id: 'tk-do-02',
                to_tank_code: 'TK-DO-02',
                to_tank_name: 'Bể Dầu DO Số 2',
                volume_ml: 2000000,
                volume_liters: 2000,
                reason: 'Điều chuyển cân bằng giữa bể 1 sang bể 2',
                status: 'draft',
                created_by: 'u-manager',
                created_by_name: 'Nguyễn Văn Quản Lý',
                created_at: '2026-11-20T09:00:00Z',
                updated_at: '2026-11-20T09:00:00Z',
              },
              {
                id: 'is-02',
                tenant_id: 't-01',
                branch_id: 'b-01',
                branch_name: 'Trạm Xăng Dầu Số 1',
                code: 'PX-2026-0002',
                kind: 'loss',
                kind_name: 'Hao hụt tự nhiên',
                tank_id: 'tk-a95-01',
                tank_code: 'TK-A95-01',
                tank_name: 'Bể Xăng A95 Số 1',
                fuel_type_id: 'ft-02',
                fuel_type_name: 'Xăng RON 95-III',
                volume_ml: 150000,
                volume_liters: 150,
                reason: 'Hao hụt bốc hơi định kỳ tháng 11',
                status: 'pending',
                created_by: 'u-manager',
                created_by_name: 'Nguyễn Văn Quản Lý',
                created_at: '2026-11-20T10:00:00Z',
                updated_at: '2026-11-20T10:00:00Z',
              },
            ],
            total: 2,
            page: 1,
            page_size: 15,
          }),
        });
      }
    });

    await page.goto('/inventory/issues');

    // Kiểm tra tiêu đề trang

    // Kiểm tra dòng phiếu 1
    const row1 = page.getByTestId('issue-row-PX-2026-0001');
    await expect(row1).toBeVisible();
    await expect(row1.getByText('PX-2026-0001')).toBeVisible();
    await expect(row1.getByText('Điều chuyển')).toBeVisible();
    await expect(row1.getByText('Bể Dầu DO Số 1')).toBeVisible();
    await expect(row1.getByText('Bể Dầu DO Số 2')).toBeVisible();
    await expect(row1.getByText('2.000')).toBeVisible(); // 2,000 L
    await expect(row1.getByText('Bản nháp')).toBeVisible();

    // Kiểm tra dòng phiếu 2
    const row2 = page.getByTestId('issue-row-PX-2026-0002');
    await expect(row2).toBeVisible();
    await expect(row2.getByText('PX-2026-0002')).toBeVisible();
    await expect(row2.getByText('Hao hụt')).toBeVisible();
    await expect(row2.getByText('Bể Xăng A95 Số 1')).toBeVisible();
    await expect(row2.getByText('150')).toBeVisible(); // 150 L
    await expect(row2.getByText('Chờ duyệt')).toBeVisible();
  });

  // ----------------------------------------------------------------------------------------------
  // Test 2: Lập phiếu xuất điều chuyển nội bộ (Transfer)
  // ----------------------------------------------------------------------------------------------
  test('TC-M11-02: Lập phiếu xuất điều chuyển nội bộ giữa 2 bể cùng loại nhiên liệu', async ({ page }) => {
    await setupMockData(page, 'MANAGER');

    await page.route('**/v1/inventory/issues*', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ items: [], total: 0 }),
        });
      } else if (route.request().method() === 'POST') {
        const body = route.request().postDataJSON();
        expect(body.kind).toBe('transfer');
        expect(body.tank_id).toBe('tk-do-01');
        expect(body.to_tank_id).toBe('tk-do-02');
        expect(body.volume_liters).toBe(1200);
        expect(body.reason).toContain('Chuyển bớt DO sang bể 2');

        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({
            id: 'is-created',
            code: 'PX-2026-0003',
            kind: 'transfer',
            status: 'draft',
            volume_liters: 1200,
            volume_ml: 1200000,
          }),
        });
      }
    });

    await page.goto('/inventory/issues');

    // Bấm nút Lập phiếu xuất mới
    await page.getByTestId('btn-create-issue').click();

    // Dialog mở ra
    await expect(page.getByRole('heading', { name: 'Lập phiếu xuất điều chỉnh' })).toBeVisible();

    // Trạm xăng không được chọn sẵn
    await pickOption(page, '#issue-branch', /Trạm Xăng Dầu Số 1/);

    // Chọn Bể xuất
    await pickOption(page, '#issue-tank', /Bể Dầu DO Số 1/);

    // Chọn Bể nhận (Bể nhận chỉ xuất hiện tk-do-02 vì cùng loại DO, không có tk-a95)
    await pickOption(page, '#issue-to-tank', /Bể Dầu DO Số 2/);

    // Nhập thể tích 1200 Lít
    await page.locator('#issue-volume').fill('1200');

    // Nhập lý do
    await page.locator('#issue-reason').fill('Chuyển bớt DO sang bể 2 chống quá tải');

    // Bấm Tạo phiếu xuất
    await page.getByRole('button', { name: 'Tạo phiếu xuất' }).click();

    // Kiểm tra toast thông báo thành công
    await expect(page.getByText('Lập phiếu xuất điều chỉnh thành công')).toBeVisible();
  });

  // ----------------------------------------------------------------------------------------------
  // Test 3: Lập phiếu xuất hao hụt tự nhiên (Loss) và Kiểm định (Inspection)
  // ----------------------------------------------------------------------------------------------
  test('TC-M11-03: Lập phiếu xuất hao hụt tự nhiên không yêu cầu bể nhận', async ({ page }) => {
    await setupMockData(page, 'MANAGER');

    await page.route('**/v1/inventory/issues*', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ items: [], total: 0 }),
        });
      } else if (route.request().method() === 'POST') {
        const body = route.request().postDataJSON();
        expect(body.kind).toBe('loss');
        expect(body.tank_id).toBe('tk-a95-01');
        expect(body.to_tank_id).toBeUndefined();
        expect(body.volume_liters).toBe(45);

        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({
            id: 'is-loss',
            code: 'PX-2026-0004',
            kind: 'loss',
            status: 'draft',
            volume_liters: 45,
            volume_ml: 45000,
          }),
        });
      }
    });

    await page.goto('/inventory/issues');
    await page.getByTestId('btn-create-issue').click();

    // Đổi loại phiếu sang Hao hụt tự nhiên
    await pickOption(page, '#issue-kind', /Hao hụt tự nhiên/);

    // Dropdown bể nhận phải biến mất
    await expect(page.locator('#issue-to-tank')).not.toBeVisible();

    // Trạm xăng không được chọn sẵn
    await pickOption(page, '#issue-branch', /Trạm Xăng Dầu Số 1/);

    // Chọn Bể xuất
    await pickOption(page, '#issue-tank', /Bể Xăng A95 Số 1/);

    // Nhập lượng xuất 45 Lít
    await page.locator('#issue-volume').fill('45');
    await page.locator('#issue-reason').fill('Hao hụt bốc hơi tự nhiên tuần 46');

    // Bấm Tạo phiếu xuất
    await page.getByRole('button', { name: 'Tạo phiếu xuất' }).click();

    await expect(page.getByText('Lập phiếu xuất điều chỉnh thành công')).toBeVisible();
  });

  // ----------------------------------------------------------------------------------------------
  // Test 4: Quản lý nộp duyệt phiếu xuất (Submit for approval)
  // ----------------------------------------------------------------------------------------------
  test('TC-M11-04: Quản lý nộp phiếu xuất bản nháp để chờ phê duyệt', async ({ page }) => {
    await setupMockData(page, 'MANAGER');

    await page.route('**/v1/inventory/issues*', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            items: [
              {
                id: 'is-draft-01',
                code: 'PX-2026-0010',
                kind: 'transfer',
                kind_name: 'Điều chuyển nội bộ',
                branch_name: 'Trạm Xăng Dầu Số 1',
                tank_name: 'Bể Dầu DO Số 1',
                fuel_type_name: 'Dầu DO 0.05S',
                to_tank_name: 'Bể Dầu DO Số 2',
                volume_liters: 500,
                reason: 'Điều chuyển thử nghiệm',
                status: 'draft',
                created_by_name: 'Nguyễn Văn Quản Lý',
                created_at: '2026-11-20T11:00:00Z',
              },
            ],
            total: 1,
          }),
        });
      }
    });

    await page.route('**/v1/inventory/issues/is-draft-01/submit', async (route) => {
      expect(route.request().method()).toBe('POST');
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'is-draft-01',
          code: 'PX-2026-0010',
          status: 'pending',
        }),
      });
    });

    await page.goto('/inventory/issues');

    // Bấm nút gửi phê duyệt
    await page.getByTestId('btn-submit-PX-2026-0010').click();

    // Toast thông báo nộp thành công
    await expect(page.getByText('Đã nộp phiếu PX-2026-0010 chờ phê duyệt')).toBeVisible();
  });

  // ----------------------------------------------------------------------------------------------
  // Test 5: Kế toán (ACCOUNTANT) phê duyệt phiếu xuất
  // ----------------------------------------------------------------------------------------------
  test('TC-M11-05: Kế toán duyệt phiếu xuất đang ở trạng thái Chờ duyệt', async ({ page }) => {
    // Đăng nhập vai trò Kế toán
    await setupMockData(page, 'ACCOUNTANT');

    await page.route('**/v1/inventory/issues*', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            items: [
              {
                id: 'is-pending-01',
                code: 'PX-2026-0020',
                kind: 'transfer',
                kind_name: 'Điều chuyển nội bộ',
                branch_id: 'b-01',
                branch_name: 'Trạm Xăng Dầu Số 1',
                tank_id: 'tk-do-01',
                tank_name: 'Bể Dầu DO Số 1',
                fuel_type_name: 'Dầu DO 0.05S',
                to_tank_id: 'tk-do-02',
                to_tank_name: 'Bể Dầu DO Số 2',
                volume_liters: 1500,
                volume_ml: 1500000,
                reason: 'Điều chuyển cân đối kho',
                status: 'pending',
                created_by: 'u-manager',
                created_by_name: 'Nguyễn Văn Quản Lý',
                created_at: '2026-11-20T11:00:00Z',
              },
            ],
            total: 1,
          }),
        });
      }
    });

    await page.route('**/v1/inventory/issues/is-pending-01/approve', async (route) => {
      const body = route.request().postDataJSON();
      expect(body.approved).toBe(true);

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'is-pending-01',
          code: 'PX-2026-0020',
          status: 'approved',
          decided_by_name: 'Trần Thị Kế Toán',
        }),
      });
    });

    await page.goto('/inventory/issues');

    // Kế toán thấy nút duyệt
    await page.getByTestId('btn-approve-PX-2026-0020').click();

    // Dialog phê duyệt hiện ra
    const dialog = page.getByRole('dialog');
    await expect(page.getByRole('heading', { name: 'Phê duyệt phiếu xuất điều chỉnh' })).toBeVisible();
    await expect(dialog.getByText('PX-2026-0020')).toBeVisible();
    await expect(dialog.getByText('1.500 L')).toBeVisible();

    // Bấm Xác nhận duyệt
    await dialog.getByRole('button', { name: 'Xác nhận duyệt' }).click();

    // Toast thông báo duyệt thành công
    await expect(page.getByText('Đã phê duyệt phiếu xuất PX-2026-0020')).toBeVisible();
  });

  // ----------------------------------------------------------------------------------------------
  // Test 6: Kế toán từ chối duyệt phiếu xuất (phải nhập lý do)
  // ----------------------------------------------------------------------------------------------
  test('TC-M11-06: Kế toán từ chối phiếu xuất kèm lý do giải trình', async ({ page }) => {
    await setupMockData(page, 'ACCOUNTANT');

    await page.route('**/v1/inventory/issues*', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            items: [
              {
                id: 'is-pending-02',
                code: 'PX-2026-0021',
                kind: 'loss',
                kind_name: 'Hao hụt tự nhiên',
                branch_id: 'b-01',
                branch_name: 'Trạm Xăng Dầu Số 1',
                tank_id: 'tk-do-01',
                tank_name: 'Bể Dầu DO Số 1',
                fuel_type_name: 'Dầu DO 0.05S',
                volume_liters: 800,
                reason: 'Hao hụt tháng 11',
                status: 'pending',
                created_by: 'u-manager',
                created_by_name: 'Nguyễn Văn Quản Lý',
                created_at: '2026-11-20T11:00:00Z',
              },
            ],
            total: 1,
          }),
        });
      }
    });

    await page.route('**/v1/inventory/issues/is-pending-02/approve', async (route) => {
      const body = route.request().postDataJSON();
      expect(body.approved).toBe(false);
      expect(body.reject_reason).toBe('Hao hụt vượt định mức cho phép, yêu cầu đo lại');

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'is-pending-02',
          code: 'PX-2026-0021',
          status: 'rejected',
          reject_reason: body.reject_reason,
        }),
      });
    });

    await page.goto('/inventory/issues');

    // Bấm nút duyệt/từ chối
    await page.getByTestId('btn-approve-PX-2026-0021').click();

    // Chuyển sang chế độ Từ chối duyệt
    await page.getByRole('button', { name: 'Từ chối duyệt' }).click();

    // Nhập lý do từ chối
    await page.locator('#issue-reject-reason').fill('Hao hụt vượt định mức cho phép, yêu cầu đo lại');

    // Bấm Xác nhận từ chối
    await page.getByRole('button', { name: 'Xác nhận từ chối' }).click();

    // Toast thông báo từ chối thành công
    await expect(page.getByText('Đã từ chối phiếu xuất PX-2026-0021')).toBeVisible();
  });

  // ----------------------------------------------------------------------------------------------
  // Test 7: Kiểm tra phân quyền RBAC (Quản lý không được duyệt, Kế toán không được lập, IT chỉ xem)
  // ----------------------------------------------------------------------------------------------
  test('TC-M11-07: Kiểm tra phân quyền RBAC giữa Quản lý, Kế toán và IT', async ({ page }) => {
    // 1. Quản lý: Có nút lập phiếu xuất, nhưng KHÔNG có nút duyệt trên phiếu pending
    await setupMockData(page, 'MANAGER');
    await page.route('**/v1/inventory/issues*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          items: [
            {
              id: 'is-01',
              code: 'PX-2026-0099',
              kind: 'transfer',
              kind_name: 'Điều chuyển',
              branch_name: 'Trạm Xăng Dầu Số 1',
              tank_name: 'Bể Dầu DO Số 1',
              fuel_type_name: 'Dầu DO 0.05S',
              volume_liters: 100,
              status: 'pending',
              created_at: '2026-11-20T11:00:00Z',
            },
          ],
          total: 1,
        }),
      });
    });

    await page.goto('/inventory/issues');
    await expect(page.getByTestId('btn-create-issue')).toBeVisible();
    await expect(page.getByTestId('btn-approve-PX-2026-0099')).not.toBeVisible();

    // 2. Kế toán: Có nút duyệt trên phiếu pending, nhưng KHÔNG có nút lập phiếu xuất mới
    await setupMockData(page, 'ACCOUNTANT');
    await page.reload();
    await expect(page.getByTestId('btn-create-issue')).not.toBeVisible();
    await expect(page.getByTestId('btn-approve-PX-2026-0099')).toBeVisible();

    // 3. IT: Không có nút lập phiếu, không có nút duyệt, chỉ có nút xem chi tiết
    await setupMockData(page, 'IT');
    await page.reload();
    await expect(page.getByTestId('btn-create-issue')).not.toBeVisible();
    await expect(page.getByTestId('btn-approve-PX-2026-0099')).not.toBeVisible();
    await expect(page.getByTestId('btn-view-PX-2026-0099')).toBeVisible();
  });

});
