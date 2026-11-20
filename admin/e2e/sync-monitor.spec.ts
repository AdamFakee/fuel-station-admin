import { test, expect } from '@playwright/test';

test.describe('Module M8 - Theo dõi đồng bộ & Trạng thái trạm (Sync Monitor)', () => {
  test('1. Màn hình /sync-monitor hiển thị đầy đủ KPI Cards và Bảng trạm', async ({ page }) => {
    // Mock user profile (IT Kỹ thuật - có quyền sync.monitor:view)
    await page.route('**/auth/me', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'u-it',
          username: 'itadmin',
          full_name: 'Lê Kỹ Thuật IT',
          role_code: 'IT',
          permissions: ['sync.monitor:view', 'dashboard:view'],
        }),
      });
    });

    // Mock danh sách trạm Edge
    await page.route('**/sync-monitor/stations', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          summary: {
            total_stations: 2,
            online_stations: 1,
            offline_stations: 1,
            total_pending_queue: 15,
            error_stations: 1,
          },
          stations: [
            {
              id: 'st-01',
              branch_id: 'b-01',
              branch_code: 'TRAM-01',
              branch_name: 'Trạm Xăng Số 1',
              code: 'EDGE-01',
              name: 'Edge Agent Trạm 1',
              status: 'active',
              is_online: true,
              last_seen_at: '2026-11-20T10:45:00Z',
              last_sync_at: '2026-11-20T10:40:00Z',
              pending_queue: 0,
              agent_version: '1.0.4',
              last_error: null,
              created_at: '2026-11-20T08:00:00Z',
              updated_at: '2026-11-20T10:45:00Z',
            },
            {
              id: 'st-02',
              branch_id: 'b-02',
              branch_code: 'TRAM-02',
              branch_name: 'Kho Nhiên Liệu Hải Phòng',
              code: 'EDGE-02',
              name: 'Edge Agent Kho HP',
              status: 'active',
              is_online: false,
              last_seen_at: '2026-11-20T10:20:00Z',
              last_sync_at: '2026-11-20T10:15:00Z',
              pending_queue: 15,
              agent_version: '1.0.3',
              last_error: 'Timeout connecting COM7 Montech sensor',
              created_at: '2026-11-20T08:00:00Z',
              updated_at: '2026-11-20T10:20:00Z',
            },
          ],
        }),
      });
    });

    await page.goto('/sync-monitor');

    // Tiêu đề & KPI
    await expect(page.getByText('Trạng thái trạm & Giám sát đồng bộ')).toBeVisible();
    await expect(page.getByText('Tổng số Trạm Edge')).toBeVisible();
    await expect(page.getByText('Đang kết nối (Online)')).toBeVisible();
    await expect(page.getByText('Mất kết nối (Offline)', { exact: true })).toBeVisible();
    await expect(page.getByText('Hàng đợi chờ đẩy lên')).toBeVisible();

    // Kiểm tra Bảng dữ liệu
    await expect(page.getByText('EDGE-01')).toBeVisible();
    await expect(page.getByText('Edge Agent Trạm 1')).toBeVisible();
    await expect(page.getByText('Online', { exact: true })).toBeVisible();

    await expect(page.getByText('EDGE-02')).toBeVisible();
    await expect(page.getByText('Edge Agent Kho HP')).toBeVisible();
    await expect(page.getByText('Offline', { exact: true })).toBeVisible();
    await expect(page.getByText('Timeout connecting COM7 Montech sensor')).toBeVisible();

    // Toggle tự làm mới và nút làm mới
    await expect(page.getByText('Tự làm mới (30s)')).toBeVisible();
    await expect(page.getByRole('button', { name: /Làm mới/i })).toBeVisible();
  });
});
