import { test, expect } from '@playwright/test';

test.describe('Module M5 - Vehicles & Drivers E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Mock user profile Quản lý (MANAGER) với full quyền M5
    await page.route('**/auth/me', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'u-manager',
          tenant_id: 't-1',
          tenant_code: 'CTY-01',
          tenant_name: 'Công ty Petromex',
          username: 'quanly',
          full_name: 'Nguyễn Văn Quản Lý',
          email: 'quanly@petromex.vn',
          employee_code: 'NV-001',
          role_code: 'MANAGER',
          role_name: 'Quản lý',
          status: 'active',
          must_change_password: false,
          branch_ids: ['b-1'],
          permissions: [
            'dashboard:view',
            'master.catalog:view',
            'master.vehicle:view',
            'master.vehicle:create',
            'master.vehicle:update',
            'master.vehicle:delete',
            'master.driver:view',
            'master.driver:create',
            'master.driver:update',
            'master.driver:delete',
          ],
        }),
      });
    });

    // Mock catalogs summary
    await page.route('**/master/catalogs/summary', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          branches: [
            { id: 'b-1', code: 'TRAM-01', name: 'Trạm Xăng Dầu Số 1' },
            { id: 'b-2', code: 'KHO-02', name: 'Tổng Kho Hải Phòng' },
          ],
          fuel_types: [
            { id: 'f-1', code: 'DO', name: 'Dầu DO 0.05S-II', active: true, created_at: '2026-01-01T00:00:00Z' },
            { id: 'f-2', code: 'A95', name: 'Xăng RON 95-III', active: true, created_at: '2026-01-01T00:00:00Z' },
          ],
          vehicle_types: [
            { id: 'vt-1', code: 'TRUCK', name: 'Xe tải nặng', active: true, created_at: '2026-01-01T00:00:00Z' },
            { id: 'vt-2', code: 'VAN', name: 'Xe bán tải / Van', active: true, created_at: '2026-01-01T00:00:00Z' },
          ],
        }),
      });
    });
  });

  // ----------------------------------------------------------------------------------------------
  // 1. VEHICLES TESTS
  // ----------------------------------------------------------------------------------------------

  test('1. Trang danh mục Xe hiển thị đầy đủ tiêu đề, thanh công cụ lọc và bảng dữ liệu', async ({ page }) => {
    // Mock danh sách xe
    await page.route('**/master/vehicles*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          items: [
            {
              id: 'veh-1',
              branch_id: 'b-1',
              branch_name: 'Trạm Xăng Dầu Số 1',
              code: 'XE001',
              plate: '29C-88888',
              vehicle_type_id: 'vt-1',
              vehicle_type_name: 'Xe tải nặng',
              fuel_type_id: 'f-1',
              fuel_type_name: 'Dầu DO 0.05S-II',
              status: 'active',
              note: 'Xe đầu kéo Huyndai',
              card_number: '1001234567',
              version: 1,
              created_at: '2026-01-10T08:00:00Z',
              updated_at: '2026-01-10T08:00:00Z',
            },
          ],
          total: 1,
          page: 1,
          page_size: 15,
        }),
      });
    });

    await page.goto('/vehicles');

    // Tiêu đề & nhận diện
    await expect(page.getByText('Danh mục Xe & Phương tiện')).toBeVisible();
    await expect(page.getByTestId('btn-create-vehicle')).toBeVisible();

    // Thanh lọc
    await expect(page.getByTestId('input-search-vehicles')).toBeVisible();
    await expect(page.getByTestId('filter-branch')).toBeVisible();
    await expect(page.getByTestId('filter-fuel')).toBeVisible();
    await expect(page.getByTestId('filter-status')).toBeVisible();

    // Dữ liệu bảng
    await expect(page.getByText('XE001')).toBeVisible();
    await expect(page.getByText('29C-88888')).toBeVisible();
    await expect(page.getByText('1001234567')).toBeVisible();
    await expect(page.getByText('Hoạt động')).toBeVisible();
  });

  test('2. Form thêm xe validate các trường bắt buộc và định dạng mã xe', async ({ page }) => {
    await page.route('**/master/vehicles*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ items: [], total: 0, page: 1, page_size: 15 }),
      });
    });

    await page.goto('/vehicles');

    // Mở dialog thêm xe
    await page.getByTestId('btn-create-vehicle').click();
    await expect(page.getByText('Khai báo phương tiện mới')).toBeVisible();

    // Click submit rỗng
    await page.getByTestId('submit-vehicle-btn').click();

    // Kiểm tra validate bắt buộc
    await expect(page.getByText('Vui lòng nhập biển số xe')).toBeVisible();
    await expect(page.getByText('Vui lòng nhập số thẻ NFC')).toBeVisible();

    // Mã xe do hệ thống tự sinh nên không có ô nhập khi tạo mới
    await expect(page.getByTestId('input-vehicle-code')).toHaveCount(0);
  });

  test('3. Thêm mới xe thành công với thẻ NFC bắt buộc', async ({ page }) => {
    let createPayload: any = null;

    await page.route('**/master/vehicles*', async (route) => {
      if (route.request().method() === 'POST') {
        createPayload = JSON.parse(route.request().postData() || '{}');
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({
            id: 'veh-new',
            code: createPayload.code,
            plate: createPayload.plate,
            branch_id: createPayload.branch_id,
            branch_name: 'Trạm Xăng Dầu Số 1',
            fuel_type_id: createPayload.fuel_type_id,
            fuel_type_name: 'Dầu DO 0.05S-II',
            card_number: createPayload.card_number,
            status: 'active',
            version: 1,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }),
        });
      } else {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ items: [], total: 0, page: 1, page_size: 15 }),
        });
      }
    });

    await page.goto('/vehicles');
    await page.getByTestId('btn-create-vehicle').click();

    await page.getByTestId('input-vehicle-plate').fill('30A-99999');
    await page.getByTestId('input-vehicle-card').fill('1009998888');

    // Thiếu số thẻ NFC thì không được tạo
    await page.getByTestId('input-vehicle-card').fill('');
    await page.getByTestId('submit-vehicle-btn').click();
    await expect(page.getByText('Vui lòng nhập số thẻ NFC')).toBeVisible();
    expect(createPayload).toBeNull();

    await page.getByTestId('input-vehicle-card').fill('1009998888');
    await page.getByTestId('submit-vehicle-btn').click();

    // Verify modal đóng và payload đúng
    await expect(page.getByText('Khai báo phương tiện mới')).not.toBeVisible();
    expect(createPayload).not.toBeNull();
    expect(createPayload.code).toBeUndefined();
    expect(createPayload.plate).toBe('30A-99999');
    expect(createPayload.card_number).toBe('1009998888');
  });

  test('4. Modal gán / đổi thẻ NFC cho xe validate định dạng số thập phân', async ({ page }) => {
    await page.route('**/master/vehicles*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          items: [
            {
              id: 'veh-1',
              branch_id: 'b-1',
              branch_name: 'Trạm Xăng Dầu Số 1',
              code: 'XE001',
              plate: '29C-88888',
              fuel_type_id: 'f-1',
              fuel_type_name: 'Dầu DO',
              status: 'active',
              version: 1,
              created_at: '2026-01-10T08:00:00Z',
              updated_at: '2026-01-10T08:00:00Z',
            },
          ],
          total: 1,
          page: 1,
          page_size: 15,
        }),
      });
    });

    await page.goto('/vehicles');

    // Mở menu thao tác của XE001
    await page.getByTestId('vehicle-actions-XE001').click();
    await page.getByTestId('card-vehicle-XE001').click();

    await expect(page.getByText('Quản lý thẻ NFC xe: 29C-88888')).toBeVisible();

    // Nhập thẻ có ký tự chữ -> lỗi validate
    await page.getByTestId('input-card-number').fill('CARD-ABC');
    await page.getByTestId('submit-card-btn').click();
    await expect(page.getByText('Số thẻ NFC phải là chuỗi chữ số thập phân')).toBeVisible();
  });

  // ----------------------------------------------------------------------------------------------
  // 2. DRIVERS TESTS
  // ----------------------------------------------------------------------------------------------

  test('5. Trang danh mục Tài xế hiển thị danh sách, vai trò và tình trạng sinh trắc học', async ({ page }) => {
    await page.route('**/master/drivers*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          items: [
            {
              id: 'drv-1',
              branch_id: 'b-1',
              branch_name: 'Trạm Xăng Dầu Số 1',
              code: 'TX001',
              full_name: 'Trần Văn Lái',
              phone: '0911223344',
              department: 'Đội xe vận tải 1',
              position: 'driver',
              status: 'active',
              card_number: '2001234567',
              has_face: true,
              has_fingerprint: true,
              version: 1,
              created_at: '2026-01-10T08:00:00Z',
              updated_at: '2026-01-10T08:00:00Z',
            },
          ],
          total: 1,
          page: 1,
          page_size: 15,
        }),
      });
    });

    await page.goto('/drivers');

    // Header & buttons
    await expect(page.getByText('Danh mục Tài xế & Nhân sự')).toBeVisible();
    await expect(page.getByTestId('btn-create-driver')).toBeVisible();

    // Dữ liệu tài xế
    await expect(page.getByText('TX001')).toBeVisible();
    await expect(page.getByText('Trần Văn Lái')).toBeVisible();
    await expect(page.getByText('0911223344')).toBeVisible();
    const row = page.getByTestId('driver-row-TX001');
    await expect(row.getByText('2001234567')).toBeVisible();
    // Khuôn mặt và vân tay là hai cột riêng, mỗi cột báo "Đã đăng ký"
    await expect(row.getByText('Đã đăng ký')).toHaveCount(2);
    await expect(row.getByText('Đang làm việc', { exact: true })).toBeVisible();
  });

  test('6. Form thêm tài xế validate trường bắt buộc (Mã NV, Họ tên, Chi nhánh)', async ({ page }) => {
    await page.route('**/master/drivers*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ items: [], total: 0, page: 1, page_size: 15 }),
      });
    });

    await page.goto('/drivers');

    await page.getByTestId('btn-create-driver').click();
    await expect(page.getByText('Thêm tài xế / nhân viên mới')).toBeVisible();

    await page.getByTestId('submit-driver-btn').click();

    await expect(page.getByText('Vui lòng nhập mã nhân viên')).toBeVisible();
    await expect(page.getByText('Vui lòng nhập họ và tên')).toBeVisible();
  });

  test('7. Modal Quản lý định danh hỗ trợ các tab Thẻ NFC, Khuôn mặt, Vân tay và Danh sách', async ({ page }) => {
    await page.route('**/master/drivers*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          items: [
            {
              id: 'drv-1',
              branch_id: 'b-1',
              branch_name: 'Trạm Xăng Dầu Số 1',
              code: 'TX001',
              full_name: 'Trần Văn Lái',
              phone: '0911223344',
              position: 'driver',
              status: 'active',
              card_number: '2001234567',
              has_face: true,
              has_fingerprint: false,
              version: 1,
              created_at: '2026-01-10T08:00:00Z',
              updated_at: '2026-01-10T08:00:00Z',
            },
          ],
          total: 1,
          page: 1,
          page_size: 15,
        }),
      });
    });

    // Mock driver detail with credentials
    await page.route('**/master/drivers/drv-1', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'drv-1',
          branch_id: 'b-1',
          branch_name: 'Trạm Xăng Dầu Số 1',
          code: 'TX001',
          full_name: 'Trần Văn Lái',
          position: 'driver',
          status: 'active',
          credentials: [
            {
              id: 'c-1',
              method: 'card',
              external_id: '2001234567',
              status: 'active',
              version: 1,
              created_at: '2026-01-10T08:00:00Z',
            },
          ],
        }),
      });
    });

    await page.goto('/drivers');

    await page.getByTestId('driver-actions-TX001').click();
    await page.getByTestId('credentials-driver-TX001').click();

    await expect(page.getByText('Phương thức xác thực: Trần Văn Lái (TX001)')).toBeVisible();

    // Kiểm tra các tabs
    await expect(page.getByRole('tab', { name: /Thẻ từ NFC/i })).toBeVisible();
    await expect(page.getByRole('tab', { name: /Khuôn mặt/i })).toBeVisible();
    await expect(page.getByRole('tab', { name: /Vân tay/i })).toBeVisible();
    await expect(page.getByRole('tab', { name: /Danh sách/i })).toBeVisible();

    // Tab Khuôn mặt có lưu ý dung lượng < 200 KB
    await page.getByRole('tab', { name: /Khuôn mặt/i }).click();
    await expect(page.getByText('Ảnh khuôn mặt (Tối đa 200 KB)')).toBeVisible();

    // Tab Vân tay
    await page.getByRole('tab', { name: /Vân tay/i }).click();
    await expect(page.getByText('Mã mẫu vân tay (Biometric Template ID)')).toBeVisible();
  });

  test('8. Phân quyền RBAC: Actor IT Kỹ thuật (chỉ xem) bị ẩn nút Thêm xe, Thêm tài xế', async ({ page }) => {
    // Mock user profile IT (chỉ có quyền view)
    await page.route('**/auth/me', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'u-it',
          tenant_id: 't-1',
          tenant_code: 'CTY-01',
          tenant_name: 'Công ty Petromex',
          username: 'itadmin',
          full_name: 'Lê Kỹ Thuật IT',
          role_code: 'IT',
          role_name: 'IT Kỹ thuật',
          status: 'active',
          must_change_password: false,
          branch_ids: ['b-1'],
          permissions: [
            'dashboard:view',
            'master.vehicle:view', // chỉ xem
            'master.driver:view',  // chỉ xem
          ],
        }),
      });
    });

    await page.route('**/master/vehicles*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ items: [], total: 0, page: 1, page_size: 15 }),
      });
    });

    await page.route('**/master/drivers*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ items: [], total: 0, page: 1, page_size: 15 }),
      });
    });

    // Màn hình xe: Không có nút Thêm xe mới
    await page.goto('/vehicles');
    await expect(page.getByText('Danh mục Xe & Phương tiện')).toBeVisible();
    await expect(page.getByTestId('btn-create-vehicle')).not.toBeVisible();

    // Màn hình tài xế: Không có nút Thêm tài xế mới
    await page.goto('/drivers');
    await expect(page.getByText('Danh mục Tài xế & Nhân sự')).toBeVisible();
    await expect(page.getByTestId('btn-create-driver')).not.toBeVisible();
  });
});
