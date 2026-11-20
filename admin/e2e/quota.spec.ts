import { test, expect } from '@playwright/test';

test.describe('Module M6 - Quota Management E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Mock user profile Manager
    await page.route('**/auth/me', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'u-mgr',
          tenantId: 't-1',
          username: 'quanly',
          fullName: 'Quản lý Hệ thống',
          email: 'quanly@station.vn',
          employeeCode: 'QL-001',
          role: 'MANAGER',
          roleName: 'Quản lý',
          permissions: [
            'dashboard:view',
            'master.quota:view',
            'master.quota:create',
            'master.quota:update',
            'master.quota:delete',
          ],
        }),
      });
    });

    // Mock targets
    await page.route('**/quotas/targets', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          vehicles: [{ id: 'v-1', code: 'XE-01', name: '51B-12345', type: 'vehicle' }],
          vehicle_groups: [{ id: 'g-1', code: 'GRP-01', name: 'Đội xe miền Tây', type: 'vehicle_group' }],
          routes: [{ id: 'r-1', code: 'RT-01', name: 'Tuyến SG-CT', type: 'route' }],
        }),
      });
    });

    // Mock quota rules
    await page.route('**/quotas/rules*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: [
            {
              id: 'rule-1',
              tenant_id: 't-1',
              code: 'DM-2026-0001',
              target_type: 'vehicle',
              target_id: 'v-1',
              target_name: '51B-12345',
              target_code: 'XE-01',
              period: 'day',
              max_volume_ml: 120000,
              max_volume_liters: 120,
              min_interval_minutes: 30,
              effective_from: '2026-01-01',
              status: 'active',
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            },
          ],
          total: 1,
          page: 1,
          page_size: 20,
        }),
      });
    });

    // Mock quota extras
    await page.route('**/quotas/extras*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: [
            {
              id: 'extra-1',
              tenant_id: 't-1',
              vehicle_id: 'v-1',
              vehicle_plate: '51B-12345',
              vehicle_code: 'XE-01',
              extra_volume_ml: 50000,
              extra_volume_liters: 50,
              valid_from: new Date().toISOString(),
              valid_to: new Date(Date.now() + 86400000).toISOString(),
              reason: 'Tăng bo phục vụ dự án',
              granted_by: 'u-mgr',
              granted_by_name: 'Quản lý Hệ thống',
              created_at: new Date().toISOString(),
            },
          ],
          total: 1,
          page: 1,
          page_size: 20,
        }),
      });
    });
  });

  test('1. Màn hình Quản lý định mức hiển thị tiêu đề, scope phi tiền tệ và 2 tab chính', async ({ page }) => {
    await page.goto('/quotas');

    // Kiểm tra Header
    await expect(page.getByText('Quản lý Định mức Nhiên liệu')).toBeVisible();
    await expect(page.getByText('Theo dõi Lít • Không xử lý tiền tệ')).toBeVisible();

    // Kiểm tra Tabs
    await expect(page.getByRole('tab', { name: /Quy tắc định mức/i })).toBeVisible();
    await expect(page.getByRole('tab', { name: /Cấp bổ sung đột xuất/i })).toBeVisible();

    // Kiểm tra Action buttons
    await expect(page.getByRole('button', { name: /Thêm quy tắc định mức/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Cấp bổ sung đột xuất/i })).toBeVisible();

    // Kiểm tra dữ liệu dòng bảng
    await expect(page.getByText('DM-2026-0001')).toBeVisible();
    await expect(page.getByText('51B-12345')).toBeVisible();
  });

  test('2. Mở dialog Thiết lập quy tắc định mức mới và kiểm tra các trường dữ liệu', async ({ page }) => {
    await page.goto('/quotas');

    const addRuleBtn = page.getByRole('button', { name: /Thêm quy tắc định mức/i });
    await addRuleBtn.click();

    // Kiểm tra tiêu đề modal
    await expect(page.getByText('Thiết lập quy tắc định mức mới')).toBeVisible();
    await expect(page.getByText('Khai báo hạn mức nhiên liệu (Lít)')).toBeVisible();

    // Kiểm tra các trường
    await expect(page.getByText('Loại đối tượng áp dụng')).toBeVisible();
    await expect(page.getByText('Chu kỳ cấp phát')).toBeVisible();
    await expect(page.getByLabel('Hạn mức tối đa (Lít)')).toBeVisible();
    await expect(page.getByLabel('Giãn cách tối thiểu giữa 2 lần bơm liên tiếp (Phút)')).toBeVisible();

    // Đóng dialog
    const cancelBtn = page.getByRole('button', { name: /Hủy/i });
    await cancelBtn.click();
    await expect(page.getByText('Thiết lập quy tắc định mức mới')).not.toBeVisible();
  });

  test('3. Mở dialog Cấp bổ sung hạn mức đột xuất và kiểm tra form', async ({ page }) => {
    await page.goto('/quotas');

    const extraBtn = page.getByRole('button', { name: /Cấp bổ sung đột xuất/i });
    await extraBtn.click();

    // Kiểm tra tiêu đề modal
    await expect(page.getByText('Cấp bổ sung hạn mức nhiên liệu đột xuất')).toBeVisible();
    await expect(page.getByText('Phương tiện được cấp bổ sung')).toBeVisible();
    await expect(page.getByLabel('Số lít nhiên liệu cấp thêm (Lít)')).toBeVisible();
    await expect(page.getByLabel('Lý do cấp bổ sung (Bắt buộc cho kiểm toán)')).toBeVisible();

    // Đóng dialog
    const cancelBtn = page.getByRole('button', { name: /Hủy/i });
    await cancelBtn.click();
  });

  test('4. Chuyển tab Cấp bổ sung đột xuất và xem bảng lịch sử', async ({ page }) => {
    await page.goto('/quotas');

    const extrasTab = page.getByRole('tab', { name: /Cấp bổ sung đột xuất/i });
    await extrasTab.click();

    // Kiểm tra hiển thị tiêu đề bảng lịch sử
    await expect(page.getByText('Phương tiện (Xe)')).toBeVisible();
    await expect(page.getByText('Lít bổ sung')).toBeVisible();
    await expect(page.getByText('Lý do cấp bổ sung')).toBeVisible();

    // Kiểm tra dòng dữ liệu đã mock
    await expect(page.getByText('Tăng bo phục vụ dự án')).toBeVisible();
  });
});
