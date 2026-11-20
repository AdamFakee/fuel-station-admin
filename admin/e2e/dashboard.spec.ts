import { test, expect } from '@playwright/test';

test.describe('Module M13 - Bảng điều khiển & Giám sát vận hành (Dashboard)', () => {
  const mockDashboardData = {
    kpi: {
      today_total_liters: 1250.75,
      today_total_sessions: 24,
      today_completed_sessions: 24,
      today_failed_sessions: 0,
      active_pumps: 3,
      online_stations: 2,
      low_stock_tanks: 1,
    },
    tanks: [
      {
        tank_id: 't-01',
        tank_code: 'BE-01',
        tank_name: 'Bể Xăng RON 95-III',
        branch_id: 'b-01',
        branch_name: 'Trạm Xăng Số 1',
        fuel_type_code: 'RON95',
        fuel_type_name: 'Xăng RON 95-III',
        stock_liters: 18500.5,
        max_capacity_liters: 25000.0,
        stock_pct: 74.0,
        is_low: false,
        has_opening: true,
      },
      {
        tank_id: 't-02',
        tank_code: 'BE-02',
        tank_name: 'Bể Dầu DO 0.05S',
        branch_id: 'b-01',
        branch_name: 'Trạm Xăng Số 1',
        fuel_type_code: 'DO',
        fuel_type_name: 'Dầu DO 0.05S-II',
        stock_liters: 2200.0,
        max_capacity_liters: 20000.0,
        stock_pct: 11.0,
        is_low: true,
        has_opening: true,
      },
    ],
    pumps: [
      {
        pump_id: 'p-01',
        pump_code: 'TRU-01',
        pump_name: 'Trụ bơm 01',
        edge_pump_id: 1,
        branch_name: 'Trạm Xăng Số 1',
        is_station_online: true,
        today_dispensed_liters: 540.0,
        today_dispense_count: 12,
      },
      {
        pump_id: 'p-02',
        pump_code: 'TRU-02',
        pump_name: 'Trụ bơm 02',
        edge_pump_id: 2,
        branch_name: 'Trạm Xăng Số 1',
        is_station_online: false,
        today_dispensed_liters: 120.0,
        today_dispense_count: 3,
      },
    ],
    recent_sessions: [
      {
        id: 's-01',
        code: 'SS-20261120-0001',
        pump_name: 'Trụ bơm 01',
        vehicle_plate: '29A-12345',
        driver_name: 'Nguyễn Văn Tài',
        dispensed_liters: 45.5,
        status: 'completed',
        finished_at: '2026-11-20T09:35:00Z',
        received_at: '2026-11-20T09:30:00Z',
      },
      {
        id: 's-02',
        code: 'SS-20261120-0002',
        pump_name: 'Trụ bơm 02',
        vehicle_plate: '51C-98765',
        driver_name: 'Trần Văn Lái',
        dispensed_liters: 120.0,
        status: 'completed',
        finished_at: '2026-11-20T10:20:00Z',
        received_at: '2026-11-20T10:10:00Z',
      },
    ],
  };

  test('1. Màn hình Dashboard hiển thị đầy đủ KPI Cards, Bể chứa, Trụ bơm và Bảng phiên cấp phát', async ({ page }) => {
    // Mock user profile (Quản lý - có quyền dashboard:view)
    await page.route('**/auth/me', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'u-mgr',
          username: 'quanly',
          full_name: 'Trần Quản Lý',
          role_code: 'MANAGER',
          permissions: ['dashboard:view', 'assets.branch:view'],
        }),
      });
    });

    // Mock API Dashboard
    await page.route('**/dashboard', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockDashboardData),
      });
    });

    await page.goto('/');

    // 1. Tiêu đề trang

    // 2. KPI Cards
    await expect(page.getByText('Nhiên liệu cấp hôm nay')).toBeVisible();
    await expect(page.getByText('1.250,8 Lít')).toBeVisible();
    await expect(page.getByText('24 lượt hoàn thành')).toBeVisible();

    await expect(page.getByText('Tỷ lệ phiên thành công')).toBeVisible();
    await expect(page.getByText('100%')).toBeVisible();

    await expect(page.getByText('Trụ bơm & Trạm kết nối')).toBeVisible();
    await expect(page.getByText('3 Trụ')).toBeVisible();
    await expect(page.getByText('2 trạm Edge Online')).toBeVisible();

    await expect(page.getByText('Cảnh báo mức tồn bể')).toBeVisible();
    await expect(page.getByText('1 Bể', { exact: true })).toBeVisible();

    // 3. Bể: liệt kê bể tồn thấp nhất, bể thấp nhất (BE-02) đứng đầu
    await expect(page.getByRole('heading', { name: /Bể tồn thấp nhất/i })).toBeVisible();
    await expect(page.getByText('1 bể cần chú ý')).toBeVisible();
    await expect(page.getByText('Bể Dầu DO 0.05S')).toBeVisible();
    await expect(page.getByText('11%', { exact: true })).toBeVisible();

    // 4. Trụ: biểu đồ vòng trụ kết nối / mất kết nối và các trạm có trụ offline
    await expect(page.getByRole('heading', { name: /^Trụ bơm$/ })).toBeVisible();
    await expect(page.getByText('1/2 trụ offline')).toBeVisible();

    // 5. Recent Sessions Table
    await expect(page.getByRole('heading', { name: /Giao dịch cấp phát nhiên liệu gần nhất/i })).toBeVisible();
    await expect(page.getByText('SS-20261120-0001')).toBeVisible();
    await expect(page.getByText('29A-12345')).toBeVisible();
    await expect(page.getByText('Nguyễn Văn Tài')).toBeVisible();
    await expect(page.getByText('45,50')).toBeVisible();

    await expect(page.getByText('SS-20261120-0002')).toBeVisible();
    await expect(page.getByText('51C-98765')).toBeVisible();
    await expect(page.getByText('Trần Văn Lái')).toBeVisible();
    await expect(page.getByText('120,00')).toBeVisible();
  });

  test('2. Dashboard không tự làm mới và không có nút làm mới thủ công', async ({ page }) => {
    await page.route('**/auth/me', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'u-mgr',
          username: 'quanly',
          full_name: 'Trần Quản Lý',
          role_code: 'MANAGER',
          permissions: ['dashboard:view'],
        }),
      });
    });

    await page.route('**/dashboard', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockDashboardData),
      });
    });

    await page.goto('/');

    await expect(page.getByRole('button', { name: /Làm mới/i })).toHaveCount(0);
    await expect(page.locator('#auto-refresh')).toHaveCount(0);
  });

  test('3. Kế toán (ACCOUNTANT) có quyền dashboard:view truy cập dashboard bình thường', async ({ page }) => {
    await page.route('**/auth/me', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'u-acc',
          username: 'ketoan',
          full_name: 'Nguyễn Thị Kế Toán',
          role_code: 'ACCOUNTANT',
          permissions: ['dashboard:view', 'inventory.receipt:view'],
        }),
      });
    });

    await page.route('**/dashboard', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockDashboardData),
      });
    });

    await page.goto('/');

    await expect(page.getByText('Nhiên liệu cấp hôm nay')).toBeVisible();
  });
});
