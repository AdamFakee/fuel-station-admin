import { test, expect } from '@playwright/test';

test.describe('Module M4 - Tổ chức, Bể chứa, Trụ bơm & Thiết bị ngoại vi E2E Tests', () => {

  // Mock dữ liệu mặc định dùng chung cho các màn hình M4
  test.beforeEach(async ({ page }) => {
    // Mock user profile Quản lý (MANAGER) mặc định
    await page.route('**/auth/me', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'u-manager',
          tenant_id: 't-01',
          tenant_code: 'CTY-01',
          tenant_name: 'Tổng Công ty Xăng Dầu Petromex',
          username: 'quanly',
          full_name: 'Nguyễn Văn Quản Lý',
          email: 'quanly@petromex.vn',
          employee_code: 'NV-001',
          role_code: 'MANAGER',
          role_name: 'Quản lý',
          status: 'active',
          must_change_password: false,
          branch_ids: ['b-01'],
          permissions: [
            'dashboard:view',
            'org.branch:view', 'org.branch:create', 'org.branch:update', 'org.branch:delete',
            'asset.tank:view', 'asset.tank:create', 'asset.tank:update', 'asset.tank:delete',
            'asset.pump:view', 'asset.pump:create', 'asset.pump:update', 'asset.pump:delete',
            'asset.device:view', 'asset.device:create', 'asset.device:update', 'asset.device:delete',
            'master.catalog:view', 'master.catalog:create',
          ],
        }),
      });
    });

    // Mock danh sách chi nhánh
    await page.route('**/assets/branches*', async (route) => {
      if (route.request().method() === 'GET') {
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
                manager_name: 'Nguyễn Văn Quản Lý',
                phone: '0901234567',
                status: 'active',
                created_at: '2026-11-20T10:00:00Z',
                updated_at: '2026-11-20T10:00:00Z',
              },
            ],
            total: 1,
            page: 1,
            page_size: 20,
          }),
        });
      } else {
        await route.continue();
      }
    });

    // Mock danh sách loại nhiên liệu
    await page.route('**/assets/fuel-types*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          { id: 'ft-01', code: 'DO', name: 'Dầu DO 0.05S', active: true },
          { id: 'ft-02', code: 'A95', name: 'Xăng RON 95-III', active: true },
        ]),
      });
    });

    // Mock danh sách bể chứa
    await page.route('**/assets/tanks*', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            data: [
              {
                id: 'tk-01',
                tenant_id: 't-01',
                branch_id: 'b-01',
                branch_name: 'Trạm Xăng Dầu Số 1',
                code: 'TK-DO-01',
                name: 'Bể Dầu DO Số 1',
                fuel_type_id: 'ft-01',
                fuel_type_name: 'Dầu DO 0.05S',
                design_capacity_ml: 25000000,
                max_usable_capacity_ml: 24000000,
                low_stock_threshold_ml: 3000000,
                loss_tolerance_pct: 0.5,
                status: 'active',
                current_stock_ml: 18500000,
                created_at: '2026-11-20T10:00:00Z',
                updated_at: '2026-11-20T10:00:00Z',
              },
            ],
            total: 1,
            page: 1,
            page_size: 20,
          }),
        });
      } else {
        await route.continue();
      }
    });

    // Mock danh sách trụ bơm
    await page.route('**/assets/pumps*', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            data: [
              {
                id: 'p-01',
                tenant_id: 't-01',
                branch_id: 'b-01',
                branch_name: 'Trạm Xăng Dầu Số 1',
                code: 'TRU-01',
                edge_pump_id: 1,
                name: 'Trụ bơm Dầu DO 01',
                note: 'Cột bơm chính cổng số 1',
                enabled: true,
                version: 1,
                nozzles: [
                  {
                    id: 'nz-01',
                    pump_id: 'p-01',
                    nozzle_no: 1,
                    tank_id: 'tk-01',
                    tank_name: 'Bể Dầu DO Số 1',
                    status: 'active',
                  },
                ],
                sensor: {
                  id: 'sn-01',
                  pump_id: 'p-01',
                  serial: 1234,
                  com_port: 'COM7',
                  baud: 9600,
                  version: 1,
                },
                terminal: {
                  id: 'tm-01',
                  pump_id: 'p-01',
                  terminal_code: 'T1',
                  host: '192.168.1.150',
                  port: 80,
                  https: false,
                  username: 'admin',
                  has_password: true,
                  version: 1,
                },
                created_at: '2026-11-20T10:00:00Z',
                updated_at: '2026-11-20T10:00:00Z',
              },
            ],
            total: 1,
            page: 1,
            page_size: 20,
          }),
        });
      } else {
        await route.continue();
      }
    });

    // Mock danh sách thiết bị ngoại vi
    await page.route('**/assets/devices*', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([
            {
              pump_id: 'p-01',
              pump_code: 'TRU-01',
              pump_name: 'Trụ bơm Dầu DO 01',
              branch_id: 'b-01',
              branch_name: 'Trạm Xăng Dầu Số 1',
              sensor: {
                id: 'sn-01',
                pump_id: 'p-01',
                serial: 1234,
                com_port: 'COM7',
                baud: 9600,
                version: 1,
              },
              terminal: {
                id: 'tm-01',
                pump_id: 'p-01',
                terminal_code: 'T1',
                host: '192.168.1.150',
                port: 80,
                https: false,
                username: 'admin',
                has_password: true,
                version: 1,
              },
            },
          ]),
        });
      } else {
        await route.continue();
      }
    });
  });

  test('1. Màn hình Chi nhánh (/branches) hiển thị danh sách, tìm kiếm và mở modal tạo mới', async ({ page }) => {
    await page.goto('/branches');

    // Tiêu đề trang
    await expect(page.getByRole('heading', { name: 'Nhà máy & Chi nhánh' })).toBeVisible();

    // Dữ liệu bảng chi nhánh
    await expect(page.getByText('TRAM-01')).toBeVisible();
    await expect(page.getByText('Trạm Xăng Dầu Số 1')).toBeVisible();
    await expect(page.getByText('123 Đường Giải Phóng, Hà Nội')).toBeVisible();
    await expect(page.getByText('0901234567')).toBeVisible();
    await expect(page.getByText('Hoạt động')).toBeVisible();

    // Nút thêm chi nhánh cho Quản lý
    const createBtn = page.getByRole('button', { name: /Thêm chi nhánh/i });
    await expect(createBtn).toBeVisible();
    await createBtn.click();

    // Kiểm tra Dialog mở ra đúng tiêu chuẩn fe-dialog-form
    await expect(page.getByRole('heading', { name: 'Khai báo Nhà máy / Chi nhánh mới' })).toBeVisible();
    await expect(page.locator('input#code')).toBeVisible();
    await expect(page.locator('input#name')).toBeVisible();

    // Đóng dialog
    await page.getByRole('button', { name: 'Hủy' }).click();
    await expect(page.getByRole('heading', { name: 'Khai báo Nhà máy / Chi nhánh mới' })).not.toBeVisible();
  });

  test('2. Màn hình Bể chứa (/tanks) hiển thị số Lít tabular-nums, định mức dung tích và mở modal tạo mới', async ({ page }) => {
    await page.goto('/tanks');

    await expect(page.getByRole('heading', { name: 'Bể chứa nhiên liệu' })).toBeVisible();

    // Dữ liệu bảng bể chứa
    await expect(page.getByText('TK-DO-01')).toBeVisible();
    await expect(page.getByText('Bể Dầu DO Số 1')).toBeVisible();
    await expect(page.getByText('Dầu DO 0.05S')).toBeVisible();

    // Kiểm tra hiển thị số lít định dạng Việt Nam (dot grouping, không dùng tiền tệ)
    // 25.000 (thiết kế), 24.000 (khả dụng), 18.500 (tồn hiện tại)
    await expect(page.getByText('25.000')).toBeVisible();
    await expect(page.getByText('24.000')).toBeVisible();
    await expect(page.getByText('18.500')).toBeVisible();
    await expect(page.getByText('0.5%')).toBeVisible();

    // Nút khai báo bể mới
    const addTankBtn = page.getByRole('button', { name: /Khai báo bể mới/i });
    await expect(addTankBtn).toBeVisible();
    await addTankBtn.click();

    // Kiểm tra Dialog Bể chứa
    await expect(page.getByRole('heading', { name: 'Khai báo Bể Chứa Nhiên Liệu Mới' })).toBeVisible();
    await expect(page.getByText('Tồn đầu kỳ khởi tạo (Lít)')).toBeVisible();

    await page.getByRole('button', { name: 'Hủy' }).click();
  });

  test('3. Màn hình Trụ bơm (/pumps) hiển thị Edge Pump ID, vòi xuất liên kết bể và mở modal khai báo', async ({ page }) => {
    await page.goto('/pumps');

    await expect(page.getByRole('heading', { name: 'Trụ bơm & Vòi xuất' })).toBeVisible();

    // Thông tin trụ bơm
    await expect(page.getByText('TRU-01')).toBeVisible();
    await expect(page.getByText('Trụ bơm Dầu DO 01')).toBeVisible();
    await expect(page.getByText('Vòi 1: Bể Dầu DO Số 1')).toBeVisible();
    await expect(page.getByText('COM7 (Serial: 1234)')).toBeVisible();
    await expect(page.getByText('192.168.1.150:80')).toBeVisible();
    await expect(page.getByText('Sẵn sàng')).toBeVisible();

    // Mở modal tạo mới trụ bơm
    const addPumpBtn = page.getByRole('button', { name: /Khai báo trụ mới/i });
    await expect(addPumpBtn).toBeVisible();
    await addPumpBtn.click();

    await expect(page.getByRole('heading', { name: 'Khai báo Trụ Bơm & Thiết bị Ngoại vi' })).toBeVisible();
    await expect(page.getByText('Cấu hình Thiết bị Ngoại vi (Bộ số & Máy chấm công)')).toBeVisible();

    await page.getByRole('button', { name: 'Hủy' }).click();
  });

  test('4. Màn hình Thiết bị (/devices) hiển thị Montech RS-485, Hikvision ISAPI và bảo mật AES-GCM', async ({ page }) => {
    await page.goto('/devices');

    await expect(page.getByRole('heading', { name: 'Thiết bị & Máy chấm công' })).toBeVisible();

    // Hiển thị thông số kết nối
    await expect(page.getByText('TRU-01')).toBeVisible();
    await expect(page.getByText('COM7')).toBeVisible();
    await expect(page.getByText('1234')).toBeVisible();
    await expect(page.getByText('9600')).toBeVisible();
    await expect(page.getByText('192.168.1.150 (T1)')).toBeVisible();
    await expect(page.getByText('AES-GCM', { exact: true })).toBeVisible();

    // Nút chỉnh sửa bộ số
    const editSensorBtn = page.getByRole('button', { name: /Bộ số/i });
    await expect(editSensorBtn).toBeVisible();
    await editSensorBtn.click();

    await expect(page.getByRole('heading', { name: 'Cấu hình Bộ Số Montech RS-485' })).toBeVisible();
    await page.getByRole('button', { name: 'Hủy' }).click();

    // Nút chỉnh sửa máy chấm công
    const editTerminalBtn = page.getByRole('button', { name: /MCC/i });
    await expect(editTerminalBtn).toBeVisible();
    await editTerminalBtn.click();

    await expect(page.getByRole('heading', { name: 'Cấu hình Máy Chấm Công Hikvision (ISAPI)' })).toBeVisible();
    await expect(page.getByText('Mật khẩu máy chấm công được mã hóa tự động bằng thuật toán AES-GCM')).toBeVisible();
    await page.getByRole('button', { name: 'Hủy' }).click();
  });

  test('5. RBAC Ma trận M4: Kế toán & IT chỉ xem (View-only), ẩn hoàn toàn các nút thao tác tạo/sửa/xóa', async ({ page }) => {
    // Mock user profile Kế toán (ACCOUNTANT)
    await page.route('**/auth/me', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'u-accountant',
          tenant_id: 't-01',
          tenant_code: 'CTY-01',
          tenant_name: 'Tổng Công ty Xăng Dầu Petromex',
          username: 'ketoan',
          full_name: 'Trần Thị Kế Toán',
          email: 'ketoan@petromex.vn',
          employee_code: 'NV-002',
          role_code: 'ACCOUNTANT',
          role_name: 'Kế toán',
          status: 'active',
          must_change_password: false,
          branch_ids: ['b-01'],
          permissions: [
            'dashboard:view',
            'org.branch:view',
            'asset.tank:view',
            'asset.pump:view',
            'asset.device:view',
            'report:view',
          ],
        }),
      });
    });

    // Truy cập /tanks: Thấy số lít nhưng KHÔNG thấy nút tạo mới hay thao tác
    await page.goto('/tanks');
    await expect(page.getByRole('heading', { name: 'Bể chứa nhiên liệu' })).toBeVisible();
    await expect(page.getByText('TK-DO-01')).toBeVisible();
    await expect(page.getByText('18.500')).toBeVisible();

    // Chặn quyền Quản trị: Không có nút khai báo bể mới hay cột thao tác
    await expect(page.getByRole('button', { name: /Khai báo bể mới/i })).not.toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Thao tác' })).not.toBeVisible();

    // Truy cập /pumps: Không có nút khai báo trụ mới
    await page.goto('/pumps');
    await expect(page.getByRole('heading', { name: 'Trụ bơm & Vòi xuất' })).toBeVisible();
    await expect(page.getByRole('button', { name: /Khai báo trụ mới/i })).not.toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Thao tác' })).not.toBeVisible();

    // Truy cập /devices: Không có nút chỉnh sửa cấu hình thiết bị
    await page.goto('/devices');
    await expect(page.getByRole('heading', { name: 'Thiết bị & Máy chấm công' })).toBeVisible();
    await expect(page.getByRole('button', { name: /Bộ số/i })).not.toBeVisible();
    await expect(page.getByRole('button', { name: /MCC/i })).not.toBeVisible();
  });

});
