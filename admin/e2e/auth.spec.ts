import { test, expect } from '@playwright/test';

test.describe('Module M0 & M1 - Auth & Role RBAC E2E Tests', () => {
  // Trang chủ là dashboard: trả dữ liệu rỗng để không gọi API thật (401 sẽ chuyển về /login giữa chừng test).
  test.beforeEach(async ({ page }) => {
    await page.route('**/dashboard', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          kpi: {
            today_total_liters: 0,
            today_total_sessions: 0,
            today_completed_sessions: 0,
            today_failed_sessions: 0,
            active_pumps: 0,
            online_stations: 0,
            low_stock_tanks: 0,
          },
          tanks: [],
          pumps: [],
          recent_sessions: [],
          daily_dispense: [],
          generated_at: new Date().toISOString(),
        }),
      });
    });
  });

  test('1. Trang đăng nhập hiển thị đầy đủ thông tin nhận diện thương hiệu và form', async ({ page }) => {
    await page.goto('/login');

    // Kiểm tra tiêu đề trang và nhận diện
    await expect(page).toHaveTitle(/Đăng nhập - Fuel Station Admin/);
    await expect(page.getByAltText('BIWASE')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Quản lý trạm xăng' })).toBeVisible();

    // Kiểm tra phạm vi phi tiền tệ (Scope check P0)

    // Kiểm tra các trường form
    const usernameInput = page.locator('input#email');
    const passwordInput = page.locator('input#password');
    const rememberMeCheckbox = page.locator('button#rememberMe');
    const submitBtn = page.getByRole('button', { name: /Đăng nhập/i });

    await expect(usernameInput).toBeVisible();
    await expect(passwordInput).toBeVisible();
    await expect(rememberMeCheckbox).toBeVisible();
    await expect(submitBtn).toBeVisible();
  });

  test('2. Form đăng nhập validate trường bắt buộc khi submit rỗng', async ({ page }) => {
    await page.goto('/login');

    const submitBtn = page.getByRole('button', { name: /Đăng nhập/i });
    await submitBtn.click();

    // Kiểm tra hiển thị thông báo lỗi validation
    await expect(page.getByText('Vui lòng nhập email')).toBeVisible();
    await expect(page.getByText('Mật khẩu phải có ít nhất 6 ký tự')).toBeVisible();
  });

  test('3. Toggle ẩn/hiện mật khẩu hoạt động chuẩn UX', async ({ page }) => {
    await page.goto('/login');

    const passwordInput = page.locator('input#password');
    await passwordInput.fill('Secret123');

    await expect(passwordInput).toHaveAttribute('type', 'password');

    // Click toggle button
    const toggleBtn = page.locator('button:has(svg)').filter({ hasText: '' }).nth(0);
    await toggleBtn.click();
    await expect(passwordInput).toHaveAttribute('type', 'text');

    await toggleBtn.click();
    await expect(passwordInput).toHaveAttribute('type', 'password');
  });

  test('4. Actor Quản lý (MANAGER) thấy đầy đủ menu quản trị và badge Quản lý', async ({ page }) => {
    // Mock user profile Quản lý
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
          permissions: ['dashboard:view', 'asset.tank:view', 'iam.user:view', 'iam.role:view', 'inventory.receipt:view'],
        }),
      });
    });

    await page.goto('/');

    await expect(page.getByText('Fuel Station System')).toBeVisible();
    await expect(page.getByText('Dashboard', { exact: true })).toBeVisible();
    await expect(page.getByText('Bể chứa nhiên liệu')).toBeVisible();
    await expect(page.getByText('Tài khoản người dùng')).toBeVisible();
    await expect(page.getByText('Vai trò & Phân quyền')).toBeVisible();
    await expect(page.getByText('Quản lý', { exact: true })).toBeVisible();
  });

  test('5. Actor Kế toán (ACCOUNTANT) bị ẩn menu Quản trị tài khoản & Giám sát trạm', async ({ page }) => {
    // Mock user profile Kế toán
    await page.route('**/auth/me', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'u-accountant',
          tenant_id: 't-1',
          tenant_code: 'CTY-01',
          tenant_name: 'Công ty Petromex',
          username: 'ketoan',
          full_name: 'Trần Thị Kế Toán',
          email: 'ketoan@petromex.vn',
          employee_code: 'NV-002',
          role_code: 'ACCOUNTANT',
          role_name: 'Kế toán',
          status: 'active',
          must_change_password: false,
          permissions: ['dashboard:view', 'inventory.receipt:view', 'inventory.issue:approve', 'inventory.stocktake:approve', 'report:view'],
        }),
      });
    });

    await page.goto('/');

    // Thấy các mục được cấp
    await expect(page.getByText('Báo cáo Nhập - Xuất - Tồn')).toBeVisible();
    await expect(page.getByText('Kế toán', { exact: true })).toBeVisible();

    // KHÔNG thấy các mục quản trị người dùng, vai trò, trạm sync
    await expect(page.getByText('Tài khoản người dùng')).not.toBeVisible();
    await expect(page.getByText('Vai trò & Phân quyền')).not.toBeVisible();
    await expect(page.getByText('Trạng thái trạm & Đồng bộ')).not.toBeVisible();
  });

  test('6. Actor IT Kỹ thuật chỉ thấy menu giám sát & view-only', async ({ page }) => {
    // Mock user profile IT
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
          email: 'it@petromex.vn',
          employee_code: 'NV-003',
          role_code: 'IT',
          role_name: 'IT Kỹ thuật',
          status: 'active',
          must_change_password: false,
          permissions: ['dashboard:view', 'audit.log:view', 'sync.monitor:view', 'asset.tank:view'],
        }),
      });
    });

    await page.goto('/');

    // Thấy audit & sync
    await expect(page.getByText('Nhật ký thao tác (Audit)')).toBeVisible();
    await expect(page.getByText('Trạng thái trạm & Đồng bộ')).toBeVisible();
    await expect(page.getByText('IT Kỹ thuật', { exact: true })).toBeVisible();

    // KHÔNG thấy quyền quản trị user
    await expect(page.getByText('Tài khoản người dùng')).not.toBeVisible();
    await expect(page.getByText('Vai trò & Phân quyền')).not.toBeVisible();
  });
});
