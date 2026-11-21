import { test, expect } from '@playwright/test';

test.describe('Module M15 - Hoàn thiện & Phân quyền toàn diện 3 Actor (Comprehensive RBAC E2E)', () => {

  const setupMockData = async (page: any, role: 'MANAGER' | 'ACCOUNTANT' | 'IT') => {
    const isManager = role === 'MANAGER';
    const isAccountant = role === 'ACCOUNTANT';
    const isIT = role === 'IT';

    // 1. Mock thông tin phiên đăng nhập
    await page.route('**/v1/auth/me*', async (route: any) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: isManager ? 'u-manager' : isAccountant ? 'u-accountant' : 'u-it',
          tenant_id: 't-01',
          tenant_code: 'PETRO-VN',
          tenant_name: 'Tổng Công ty Xăng Dầu Petromex',
          username: isManager ? 'quanly' : isAccountant ? 'ketoan' : 'itadmin',
          full_name: isManager ? 'Nguyễn Văn Quản Lý' : isAccountant ? 'Trần Thị Kế Toán' : 'Lê Kỹ Thuật IT',
          email: `${role.toLowerCase()}@petromex.vn`,
          employee_code: isManager ? 'NV-001' : isAccountant ? 'NV-002' : 'NV-003',
          role_code: role,
          role_name: isManager ? 'Quản lý' : isAccountant ? 'Kế toán' : 'IT Kỹ thuật',
          status: 'active',
          must_change_password: false,
          branch_ids: ['b-01'],
          permissions: isManager
            ? [
                'dashboard:view',
                'iam.user:view', 'iam.user:create', 'iam.user:update', 'iam.user:delete',
                'iam.role:view', 'iam.role:create', 'iam.role:update',
                'master.branch:view', 'master.branch:create', 'master.branch:update', 'master.branch:delete',
                'master.tank:view', 'master.tank:create', 'master.tank:update', 'master.tank:delete',
                'master.pump:view', 'master.pump:create', 'master.pump:update', 'master.pump:delete',
                'master.device:view', 'master.device:create', 'master.device:update', 'master.device:delete',
                'master.vehicle:view', 'master.vehicle:create', 'master.vehicle:update', 'master.vehicle:delete',
                'master.driver:view', 'master.driver:create', 'master.driver:update', 'master.driver:delete',
                'master.quota:view', 'master.quota:create', 'master.quota:update',
                'dispense.session:view',
                'edge.sync:view',
                'inventory.receipt:view', 'inventory.receipt:create', 'inventory.receipt:update', 'inventory.receipt:delete',
                'inventory.issue:view', 'inventory.issue:create', 'inventory.issue:update', 'inventory.issue:delete',
                'report:view', 'report:export',
              ]
            : isAccountant
            ? [
                'dashboard:view',
                'master.branch:view',
                'master.tank:view',
                'master.pump:view',
                'master.device:view',
                'master.vehicle:view',
                'master.driver:view',
                'master.quota:view',
                'dispense.session:view',
                'inventory.receipt:view',
                'inventory.issue:view',
                'inventory.issue:approve',
                'report:view', 'report:export',
              ]
            : [
                'dashboard:view',
                'master.branch:view',
                'master.tank:view',
                'master.pump:view',
                'master.device:view',
                'master.vehicle:view',
                'master.driver:view',
                'master.quota:view',
                'dispense.session:view',
                'sync.monitor:view',
                'inventory.receipt:view',
                'inventory.issue:view',
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
              current_stock_ml: 15000000,
              status: 'active',
            },
          ],
          total: 1,
        }),
      });
    });
  };

  // ----------------------------------------------------------------------------------------------
  // Test 1: Actor Quản lý (MANAGER) có toàn quyền quản trị, nhưng không được duyệt xuất
  // ----------------------------------------------------------------------------------------------
  test('TC-M15-01: Actor Quản lý (MANAGER) thấy đầy đủ menu quản trị, nhưng không có quyền duyệt phiếu xuất', async ({ page }) => {
    await setupMockData(page, 'MANAGER');

    await page.route('**/v1/inventory/issues*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          items: [
            {
              id: 'is-pending-01',
              code: 'PX-2026-0001',
              kind: 'transfer',
              kind_name: 'Điều chuyển',
              branch_name: 'Trạm Xăng Dầu Số 1',
              tank_name: 'Bể Dầu DO Số 1',
              fuel_type_name: 'Dầu DO 0.05S',
              volume_liters: 1000,
              status: 'pending',
              created_at: '2026-11-20T10:00:00Z',
            },
          ],
          total: 1,
        }),
      });
    });

    await page.goto('/inventory/issues');

    // 1. Kiểm tra sidebar: Quản lý thấy các menu quản trị
    const sidebar = page.locator('aside, [data-slot="sidebar"]');
    await expect(sidebar.getByText('Tài khoản')).toBeVisible();
    await expect(sidebar.getByText('Vai trò & Phân quyền')).toBeVisible();
    await expect(sidebar.getByText('Phiếu nhập bể')).toBeVisible();
    await expect(sidebar.getByText('Phiếu xuất điều chỉnh')).toBeVisible();

    // 2. Thấy nút Lập phiếu xuất mới
    await expect(page.getByTestId('btn-create-issue')).toBeVisible();

    // 3. Không có nút duyệt trên phiếu pending (Quyền duyệt thuộc về Kế toán)
    await expect(page.getByTestId('btn-approve-PX-2026-0001')).not.toBeVisible();
  });

  // ----------------------------------------------------------------------------------------------
  // Test 2: Actor Kế toán (ACCOUNTANT) bị ẩn menu IAM, có quyền duyệt phiếu xuất
  // ----------------------------------------------------------------------------------------------
  test('TC-M15-02: Actor Kế toán (ACCOUNTANT) bị ẩn menu IAM, có quyền duyệt phiếu xuất điều chỉnh', async ({ page }) => {
    await setupMockData(page, 'ACCOUNTANT');

    await page.route('**/v1/inventory/issues*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          items: [
            {
              id: 'is-pending-02',
              code: 'PX-2026-0002',
              kind: 'loss',
              kind_name: 'Hao hụt tự nhiên',
              branch_name: 'Trạm Xăng Dầu Số 1',
              tank_name: 'Bể Dầu DO Số 1',
              fuel_type_name: 'Dầu DO 0.05S',
              volume_liters: 75,
              status: 'pending',
              created_at: '2026-11-20T11:00:00Z',
            },
          ],
          total: 1,
        }),
      });
    });

    await page.goto('/inventory/issues');

    // 1. Kiểm tra sidebar: Kế toán BỊ ẨN menu Tài khoản & Vai trò & Giám sát trạm
    const sidebar = page.locator('aside, [data-slot="sidebar"]');
    await expect(sidebar.getByText('Tài khoản')).not.toBeVisible();
    await expect(sidebar.getByText('Vai trò & Phân quyền')).not.toBeVisible();
    await expect(sidebar.getByText('Trạng thái trạm & Đồng bộ')).not.toBeVisible();

    // 2. Kế toán KHÔNG có nút lập phiếu xuất mới
    await expect(page.getByTestId('btn-create-issue')).not.toBeVisible();

    // 3. Kế toán CÓ nút duyệt trên phiếu pending
    await expect(page.getByTestId('btn-approve-PX-2026-0002')).toBeVisible();
  });

  // ----------------------------------------------------------------------------------------------
  // Test 3: Actor IT Kỹ thuật (IT) chế độ Chỉ xem (View-only)
  // ----------------------------------------------------------------------------------------------
  test('TC-M15-03: Actor IT Kỹ thuật (IT) có quyền xem giám sát trạm, chế độ View-only trên tài sản và kho', async ({ page }) => {
    await setupMockData(page, 'IT');

    await page.route('**/v1/inventory/issues*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          items: [
            {
              id: 'is-pending-03',
              code: 'PX-2026-0003',
              kind: 'inspection',
              kind_name: 'Kiểm định cột bơm',
              branch_name: 'Trạm Xăng Dầu Số 1',
              tank_name: 'Bể Dầu DO Số 1',
              fuel_type_name: 'Dầu DO 0.05S',
              volume_liters: 20,
              status: 'pending',
              created_at: '2026-11-20T12:00:00Z',
            },
          ],
          total: 1,
        }),
      });
    });

    await page.goto('/inventory/issues');

    // 1. Kiểm tra sidebar: IT thấy menu Trạng thái trạm & Đồng bộ, bị ẩn IAM và Báo cáo
    const sidebar = page.locator('aside, [data-slot="sidebar"]');
    await expect(sidebar.getByText('Trạng thái trạm & Đồng bộ')).toBeVisible();
    await expect(sidebar.getByText('Tài khoản')).not.toBeVisible();
    await expect(sidebar.getByText('Báo cáo')).not.toBeVisible();

    // 2. Không có nút lập phiếu mới, không có nút duyệt
    await expect(page.getByTestId('btn-create-issue')).not.toBeVisible();
    await expect(page.getByTestId('btn-approve-PX-2026-0003')).not.toBeVisible();

    // 3. Chỉ có nút xem chi tiết (View-only)
    await expect(page.getByTestId('btn-view-PX-2026-0003')).toBeVisible();
  });

  // ----------------------------------------------------------------------------------------------
  // Test 4: Toàn vẹn dữ liệu Phi tiền tệ (Non-financial Formatting Across System)
  // ----------------------------------------------------------------------------------------------
  test('TC-M15-04: Đảm bảo giao diện quản lý thể tích (Lít) không chứa trường tiền tệ hoặc VAT', async ({ page }) => {
    await setupMockData(page, 'MANAGER');

    await page.route('**/v1/inventory/issues*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          items: [
            {
              id: 'is-sample-01',
              code: 'PX-2026-0088',
              kind: 'transfer',
              kind_name: 'Điều chuyển',
              branch_name: 'Trạm Xăng Dầu Số 1',
              tank_name: 'Bể Dầu DO Số 1',
              fuel_type_name: 'Dầu DO 0.05S',
              volume_liters: 1250,
              status: 'approved',
              created_at: '2026-11-20T12:00:00Z',
            },
          ],
          total: 1,
        }),
      });
    });

    await page.goto('/inventory/issues');

    // Xác nhận có cột "Lượng xuất (L)"
    await expect(page.getByText('Lượng xuất (L)')).toBeVisible();
    await expect(page.getByText('1.250')).toBeVisible();

    // Tuyệt đối không chứa các từ khóa tiền tệ
    await expect(page.getByText('Đơn giá')).not.toBeVisible();
    await expect(page.getByText('Thành tiền')).not.toBeVisible();
    await expect(page.getByText('VAT')).not.toBeVisible();
    await expect(page.getByText('VNĐ')).not.toBeVisible();
  });

});
