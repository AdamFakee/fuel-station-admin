import { test, expect } from '@playwright/test';

test.describe('Module M9 - Giám sát Phiên đổ & Cấp phát (Dispense Sessions)', () => {
  const mockBranches = [
    { id: 'b-1', code: 'BR-01', name: 'Trạm Xăng Cầu Giấy', address: '123 Cầu Giấy, Hà Nội' },
    { id: 'b-2', code: 'BR-02', name: 'Kho Nhiên Liệu Hải Phòng', address: '456 Cảng Đình Vũ, Hải Phòng' },
  ];

  const mockSummary = {
    total_sessions: 45,
    completed_sessions: 42,
    cancelled_sessions: 1,
    failed_sessions: 2,
    total_dispensed_liters: 1450.5,
    rejected_auth_count: 5,
  };

  const mockSessions = [
    {
      id: 's-1',
      code: 'SS-20261120-0001',
      edge_ref: 'EDGE-SS-001',
      branch_id: 'b-1',
      branch_name: 'Trạm Xăng Cầu Giấy',
      pump_id: 'p-1',
      pump_name: 'Trụ bơm 01',
      tank_id: 't-1',
      tank_name: 'Bể xăng 01',
      fuel_type_name: 'Xăng RON 95-III',
      vehicle_id: 'v-1',
      vehicle_code: 'VH-001',
      vehicle_plate: '29A-88888',
      driver_id: 'd-1',
      driver_code: 'TX-001',
      driver_name: 'Nguyễn Văn Tài',
      status: 'completed',
      edge_state: 'completed',
      dispensed_ml: 125500,
      dispensed_liters: 125.5,
      limit_ml: 150000,
      limit_liters: 150.0,
      started_at: '2026-11-20T08:00:00Z',
      finished_at: '2026-11-20T08:05:00Z',
      received_at: '2026-11-20T08:05:05Z',
      created_at: '2026-11-20T08:00:00Z',
    },
    {
      id: 's-2',
      code: 'SS-20261120-0002',
      edge_ref: 'EDGE-SS-002',
      branch_id: 'b-1',
      branch_name: 'Trạm Xăng Cầu Giấy',
      pump_id: 'p-2',
      pump_name: 'Trụ bơm 02',
      tank_id: 't-2',
      tank_name: 'Bể dầu 02',
      fuel_type_name: 'Dầu DO 0.05S-II',
      vehicle_id: 'v-2',
      vehicle_code: 'VH-002',
      vehicle_plate: '29C-99999',
      driver_id: 'd-2',
      driver_code: 'TX-002',
      driver_name: 'Trần Văn Xế',
      status: 'failed',
      edge_state: 'aborted',
      dispensed_ml: 20000,
      dispensed_liters: 20.0,
      limit_ml: 100000,
      limit_liters: 100.0,
      started_at: '2026-11-20T09:00:00Z',
      finished_at: '2026-11-20T09:01:30Z',
      received_at: '2026-11-20T09:01:35Z',
      created_at: '2026-11-20T09:00:00Z',
    },
  ];

  const mockSessionDetail = {
    ...mockSessions[0],
    sale_seq: 42,
    sensor_serial: 10082,
    raw_hex: '02 01 04 29 41 38 38 38 38 38 03 4B',
    timeline: [
      {
        from_state: 'idle',
        to_state: 'paired',
        occurred_at: '2026-11-20T07:59:55Z',
      },
      {
        from_state: 'paired',
        to_state: 'ready',
        occurred_at: '2026-11-20T08:00:00Z',
      },
      {
        from_state: 'ready',
        to_state: 'pumping',
        occurred_at: '2026-11-20T08:00:05Z',
      },
      {
        from_state: 'pumping',
        to_state: 'completed',
        occurred_at: '2026-11-20T08:05:00Z',
      },
    ],
    access_events: [
      {
        id: 1,
        kind: 'rfid_card',
        method: 'card' as const,
        external_id: 'CARD-12345',
        party_name: 'Nguyễn Văn Tài',
        decision: 'accept' as const,
        occurred_at: '2026-11-20T07:59:55Z',
      },
    ],
  };

  const mockAccessEvents = [
    {
      id: 101,
      edge_ref: 'EVT-001',
      branch_id: 'b-1',
      branch_name: 'Trạm Xăng Cầu Giấy',
      method: 'card' as const,
      kind: 'rfid_card',
      external_id: 'CARD-99999',
      vehicle_plate: '30E-12345',
      driver_name: 'Lê Văn Lạ',
      party_name: 'Lê Văn Lạ',
      decision: 'reject' as const,
      reason: 'UnknownCard',
      received_at: '2026-11-20T10:15:05Z',
      occurred_at: '2026-11-20T10:15:00Z',
    },
    {
      id: 102,
      edge_ref: 'EVT-002',
      branch_id: 'b-1',
      branch_name: 'Trạm Xăng Cầu Giấy',
      method: 'card' as const,
      kind: 'rfid_card',
      external_id: 'CARD-BLOCKED',
      vehicle_plate: '29C-11111',
      driver_name: 'Phạm Văn Bị Khóa',
      party_name: 'Phạm Văn Bị Khóa',
      decision: 'reject' as const,
      reason: 'Blocked',
      received_at: '2026-11-20T10:30:05Z',
      occurred_at: '2026-11-20T10:30:00Z',
    },
  ];

  test.beforeEach(async ({ page }) => {
    // Mock Auth Me
    await page.route('**/auth/me', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'u-admin',
          tenant_id: 't-1',
          tenant_code: 'PETRO-VN',
          tenant_name: 'Tổng Công ty Xăng dầu Demo',
          username: 'admin',
          full_name: 'Nguyễn Văn Quản Lý',
          email: 'admin@petrovn.vn',
          employee_code: 'NV-0001',
          role_code: 'MANAGER',
          role_name: 'Quản lý',
          status: 'active',
          must_change_password: false,
          branch_ids: ['b-1', 'b-2'],
          permissions: ['dispense.session:view', 'master.vehicle:view', 'master.driver:view'],
        }),
      });
    });

    // Mock Branches
    await page.route('**/iam/branches*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockBranches),
      });
    });
    await page.route('**/branches*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockBranches),
      });
    });

    // Mock Dispense Summary
    await page.route('**/dispense/summary*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockSummary),
      });
    });

    // Mock Single Session Detail
    await page.route('**/dispense/sessions/*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockSessionDetail),
      });
    });

    // Mock Dispense Sessions List
    await page.route(/\/dispense\/sessions(\?.*)?$/, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          items: mockSessions,
          total: mockSessions.length,
          page: 1,
          page_size: 15,
          total_pages: 1,
        }),
      });
    });

    // Mock Access Events List
    await page.route('**/dispense/access-events*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          items: mockAccessEvents,
          total: mockAccessEvents.length,
          page: 1,
          page_size: 15,
          total_pages: 1,
        }),
      });
    });
  });

  test('Hiển thị giao diện danh sách phiên đổ và các thẻ thống kê KPI', async ({ page }) => {
    await page.goto('/dispense-sessions');

    // Kiểm tra tiêu đề trang

    // Kiểm tra các thẻ KPI
    await expect(page.getByText('Tổng phiên')).toBeVisible();
    await expect(page.getByText('Hoàn thành').first()).toBeVisible();
    await expect(page.getByText('Đã hủy / Lỗi')).toBeVisible();
    await expect(page.getByText('Tổng thể tích cấp')).toBeVisible();
    await expect(page.getByText('Bị từ chối', { exact: true })).toBeVisible();

    // Kiểm tra dữ liệu phiên đổ trong bảng
    await expect(page.getByText('SS-20261120-0001')).toBeVisible();
    await expect(page.getByText('29A-88888')).toBeVisible();
    await expect(page.getByText('Nguyễn Văn Tài')).toBeVisible();
    await expect(page.getByText('125,50 L')).toBeVisible();

    await expect(page.getByText('SS-20261120-0002')).toBeVisible();
    await expect(page.getByText('29C-99999')).toBeVisible();
    await expect(page.getByText('Lỗi bơm')).toBeVisible();
  });

  test('Xem chi tiết một phiên đổ trong Modal', async ({ page }) => {
    await page.goto('/dispense-sessions');

    // Click xem chi tiết phiên đầu tiên
    const firstRow = page.locator('tr', { hasText: 'SS-20261120-0001' });
    await firstRow.getByRole('button', { name: 'Xem chi tiết' }).click();

    // Dialog mở ra
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('heading', { name: 'SS-20261120-0001' })).toBeVisible();

    // Kiểm tra các thông số định lượng (Lít, không tiền)
    await expect(dialog.getByText('125,50 L')).toBeVisible();
    await expect(dialog.getByText('150,00 L')).toBeVisible();

    // Kiểm tra thông tin xe & tài xế
    await expect(dialog.getByText('29A-88888')).toBeVisible();
    await expect(dialog.getByText('Nguyễn Văn Tài').first()).toBeVisible();

    // Kiểm tra Trụ bơm & Bể
    await expect(dialog.getByText('Trụ bơm 01')).toBeVisible();
    await expect(dialog.getByText('Bể xăng 01')).toBeVisible();

    // Kiểm tra Tiến trình sự kiện (Timeline)
    await expect(dialog.getByText('Dòng thời gian phiên bơm')).toBeVisible();
    await expect(dialog.getByText('Bơm hoàn tất (Completed)')).toBeVisible();

    // Kiểm tra Raw HEX
    await expect(dialog.getByText('Khung gói tin thô (Raw HEX):')).toBeVisible();
    await expect(dialog.getByText('02 01 04 29 41 38 38 38 38 38 03 4B')).toBeVisible();

    // Đóng dialog
    await dialog.getByRole('button', { name: 'Đóng' }).click();
    await expect(dialog).not.toBeVisible();
  });

  test('Chuyển sang Tab Lượt bị từ chối & Xác thực', async ({ page }) => {
    await page.goto('/dispense-sessions');

    // Chuyển tab sang Lượt bị từ chối & Xác thực
    await page.getByRole('tab', { name: /Lượt bị từ chối/i }).click();

    // Kiểm tra bảng sự kiện truy cập
    await expect(page.getByRole('columnheader', { name: 'Mã định danh / Thẻ' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Đối tượng nhận diện' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Lý do từ chối / Ghi chú' })).toBeVisible();

    // Dữ liệu dòng từ chối
    await expect(page.getByText('CARD-99999')).toBeVisible();
    await expect(page.getByText('Mã thẻ lạ chưa được khai báo')).toBeVisible();

    await expect(page.getByText('CARD-BLOCKED')).toBeVisible();
    await expect(page.getByText('Thẻ/Đối tượng bị khóa')).toBeVisible();
  });
});
