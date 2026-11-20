import { test, expect } from '@playwright/test';

test.describe('Module M2 - Quản lý Tài khoản, Vai trò & Phân quyền (IAM)', () => {
  const mockBranches = [
    { id: 'b-1', code: 'BR-01', name: 'Trạm Xăng Cầu Giấy', address: '123 Cầu Giấy, Hà Nội' },
    { id: 'b-2', code: 'BR-02', name: 'Kho Nhiên Liệu Hải Phòng', address: '456 Cảng Đình Vũ, Hải Phòng' },
  ];

  const mockRoles = [
    {
      id: 'r-manager',
      code: 'MANAGER',
      name: 'Quản lý',
      description: 'Toàn quyền quản trị hệ thống',
      is_system: true,
      user_count: 1,
      permission_count: 59,
      created_at: '2026-11-20T10:00:00Z',
      updated_at: '2026-11-20T10:00:00Z',
    },
    {
      id: 'r-accountant',
      code: 'ACCOUNTANT',
      name: 'Kế toán',
      description: 'Kiểm soát số lít và duyệt kiểm kê',
      is_system: true,
      user_count: 1,
      permission_count: 18,
      created_at: '2026-11-20T10:00:00Z',
      updated_at: '2026-11-20T10:00:00Z',
    },
    {
      id: 'r-it',
      code: 'IT',
      name: 'IT Kỹ thuật',
      description: 'Giám sát hệ thống',
      is_system: true,
      user_count: 1,
      permission_count: 13,
      created_at: '2026-11-20T10:00:00Z',
      updated_at: '2026-11-20T10:00:00Z',
    },
  ];

  const mockUsers = [
    {
      id: 'u-admin',
      employee_code: 'NV-0001',
      full_name: 'Nguyễn Văn Quản Lý',
      email: 'admin@petrovn.vn',
      phone: '0901234567',
      username: 'admin',
      role_id: 'r-manager',
      role_code: 'MANAGER',
      role_name: 'Quản lý',
      status: 'active',
      must_change_password: false,
      branch_ids: ['b-1', 'b-2'],
      branch_names: ['Trạm Xăng Cầu Giấy', 'Kho Nhiên Liệu Hải Phòng'],
      last_login_at: '2026-11-20T15:30:00Z',
      created_at: '2026-11-20T10:00:00Z',
      updated_at: '2026-11-20T10:00:00Z',
    },
    {
      id: 'u-acc',
      employee_code: 'NV-0002',
      full_name: 'Trần Thị Kế Toán',
      email: 'ketoan@petrovn.vn',
      phone: '0912345678',
      username: 'ketoan',
      role_id: 'r-accountant',
      role_code: 'ACCOUNTANT',
      role_name: 'Kế toán',
      status: 'active',
      must_change_password: false,
      branch_ids: ['b-1'],
      branch_names: ['Trạm Xăng Cầu Giấy'],
      last_login_at: '2026-11-20T14:20:00Z',
      created_at: '2026-11-20T10:00:00Z',
      updated_at: '2026-11-20T10:00:00Z',
    },
    {
      id: 'u-locked',
      employee_code: 'NV-0003',
      full_name: 'Vũ Văn Khóa',
      email: 'locked@petrovn.vn',
      phone: '0988776655',
      username: 'vukhoa',
      role_id: 'r-it',
      role_code: 'IT',
      role_name: 'IT Kỹ thuật',
      status: 'locked',
      must_change_password: true,
      branch_ids: ['b-2'],
      branch_names: ['Kho Nhiên Liệu Hải Phòng'],
      last_login_at: null,
      created_at: '2026-11-20T11:00:00Z',
      updated_at: '2026-11-20T11:00:00Z',
    },
  ];

  const mockPermissions = [
    { code: 'iam.user:view', module: 'iam.user', action: 'view', description: 'Xem tài khoản người dùng' },
    { code: 'iam.user:create', module: 'iam.user', action: 'create', description: 'Tạo tài khoản' },
    { code: 'iam.user:update', module: 'iam.user', action: 'update', description: 'Sửa tài khoản' },
    { code: 'iam.user:delete', module: 'iam.user', action: 'delete', description: 'Xóa mềm tài khoản' },
    { code: 'iam.role:view', module: 'iam.role', action: 'view', description: 'Xem vai trò và ma trận quyền' },
    { code: 'iam.role:create', module: 'iam.role', action: 'create', description: 'Tạo vai trò' },
    { code: 'iam.role:update', module: 'iam.role', action: 'update', description: 'Sửa ma trận quyền' },
    { code: 'iam.role:delete', module: 'iam.role', action: 'delete', description: 'Xóa vai trò' },
    { code: 'master.vehicle:view', module: 'master.vehicle', action: 'view', description: 'Xem xe' },
    { code: 'master.driver:view', module: 'master.driver', action: 'view', description: 'Xem tài xế' },
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
          permissions: ['iam.user:view', 'iam.user:create', 'iam.user:update', 'iam.user:delete', 'iam.role:view', 'iam.role:create', 'iam.role:update', 'iam.role:delete'],
        }),
      });
    });

    // Mock IAM endpoints
    await page.route('**/iam/users*', async (route) => {
      const url = new URL(route.request().url());
      if (route.request().method() === 'GET' && !url.pathname.includes('/iam/users/')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            items: mockUsers,
            total: mockUsers.length,
            page: 1,
            page_size: 15,
            total_pages: 1,
          }),
        });
      } else {
        await route.continue();
      }
    });

    await page.route('**/iam/roles*', async (route) => {
      const url = new URL(route.request().url());
      if (route.request().method() === 'GET' && !url.pathname.includes('/iam/roles/')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(mockRoles),
        });
      } else {
        await route.continue();
      }
    });

    await page.route('**/iam/branches', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockBranches),
      });
    });

    await page.route('**/iam/permissions', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockPermissions),
      });
    });
  });

  test('1. Màn hình danh sách tài khoản (/users) hiển thị chuẩn giao diện & format dữ liệu', async ({ page }) => {
    await page.goto('/users');

    await expect(page.getByText('Quản lý Tài khoản & Nhân sự')).toBeVisible();
    await expect(page.getByText('3 tài khoản')).toBeVisible();
    await expect(page.getByRole('button', { name: /Thêm tài khoản/i })).toBeVisible();

    // Kiểm tra các cột bảng chuẩn admin-table-format
    await expect(page.getByRole('columnheader', { name: 'Mã NV' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Họ và tên' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Tên đăng nhập / Email' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Vai trò' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Chi nhánh' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Trạng thái' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Đăng nhập cuối' })).toBeVisible();

    // Kiểm tra dữ liệu hiển thị
    await expect(page.getByText('NV-0001')).toBeVisible();
    await expect(page.getByRole('table').getByText('Nguyễn Văn Quản Lý')).toBeVisible();
    await expect(page.getByText('admin@petrovn.vn')).toBeVisible();
    await expect(page.getByText('NV-0002')).toBeVisible();
    await expect(page.getByText('Trần Thị Kế Toán')).toBeVisible();

    // Kiểm tra badge trạng thái
    await expect(page.getByText('Hoạt động').first()).toBeVisible();
    await expect(page.getByText('Bị khóa')).toBeVisible();
  });

  test('2. Tìm kiếm và lọc danh sách tài khoản', async ({ page }) => {
    await page.goto('/users');

    const searchInput = page.getByPlaceholder('Tìm theo mã NV, tên, username, email...');
    await expect(searchInput).toBeVisible();

    await searchInput.fill('NV-0002');
    await expect(searchInput).toHaveValue('NV-0002');

    // Kiểm tra dropdown lọc vai trò và trạng thái
    const roleSelect = page.getByText('Tất cả vai trò');
    await expect(roleSelect).toBeVisible();

    const statusSelect = page.getByText('Tất cả trạng thái');
    await expect(statusSelect).toBeVisible();
  });

  test('3. Modal Thêm tài khoản chuẩn fe-dialog-form & validation', async ({ page }) => {
    await page.goto('/users');

    await page.getByRole('button', { name: /Thêm tài khoản/i }).click();

    // Kiểm tra dialog shell
    await expect(page.getByRole('heading', { name: 'Thêm tài khoản mới' })).toBeVisible();
    await expect(page.getByText('Tạo tài khoản quản trị/vận hành và thiết lập quyền truy cập cho nhân sự')).toBeVisible();

    // Các trường form
    await expect(page.locator('#employee_code')).toBeVisible();
    await expect(page.locator('#full_name')).toBeVisible();
    await expect(page.locator('#username')).toBeVisible();
    await expect(page.locator('#password')).toBeVisible();
    await expect(page.locator('#email')).toBeVisible();
    await expect(page.locator('#phone')).toBeVisible();
    await expect(page.locator('#role_id')).toBeVisible();

    // Danh sách chi nhánh phân bổ bên trong form
    await expect(page.locator('#user-form').getByText('Trạm Xăng Cầu Giấy')).toBeVisible();
    await expect(page.locator('#user-form').getByText('Kho Nhiên Liệu Hải Phòng')).toBeVisible();

    // Nút submit & hủy
    await expect(page.getByRole('button', { name: 'Hủy' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Tạo tài khoản' })).toBeVisible();

    // Đóng dialog bằng nút Hủy
    await page.getByRole('button', { name: 'Hủy' }).click();
    await expect(page.getByRole('heading', { name: 'Thêm tài khoản mới' })).not.toBeVisible();
  });

  test('4. Hộp thoại Đặt lại mật khẩu', async ({ page }) => {
    await page.goto('/users');

    // Click menu thao tác dòng thứ 2 (Trần Thị Kế Toán)
    const actionBtns = page.getByRole('button', { name: 'Tùy chọn' });
    await actionBtns.nth(1).click();

    const resetMenu = page.getByText('Đặt lại mật khẩu');
    await expect(resetMenu).toBeVisible();
    await resetMenu.click();

    // Kiểm tra Reset Password Dialog
    await expect(page.getByText('Đặt lại mật khẩu cho tài khoản Trần Thị Kế Toán')).toBeVisible();
    await expect(page.locator('#new-password')).toBeVisible();
    await expect(page.locator('#confirm-password')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Xác nhận đặt lại' })).toBeVisible();

    await page.getByRole('button', { name: 'Hủy' }).click();
    await expect(page.getByText('Đặt lại mật khẩu cho tài khoản Trần Thị Kế Toán')).not.toBeVisible();
  });

  test('5. Hộp thoại Khóa tài khoản kích hoạt ConfirmDialog mức security (bắt buộc gõ OK)', async ({ page }) => {
    await page.goto('/users');

    // Click menu thao tác dòng thứ 2 (Trần Thị Kế Toán - đang hoạt động)
    const actionBtns = page.getByRole('button', { name: 'Tùy chọn' });
    await actionBtns.nth(1).click();

    const lockMenu = page.getByText('Khóa tài khoản');
    await expect(lockMenu).toBeVisible();
    await lockMenu.click();

    // Kiểm tra ConfirmDialog level="security"
    await expect(page.getByText('Khóa tài khoản người dùng?')).toBeVisible();
    await expect(page.getByText('Hậu quả có thể xảy ra:')).toBeVisible();
    await expect(page.getByText('Toàn bộ phiên đăng nhập đang hoạt động của người dùng sẽ bị thu hồi ngay lập tức.')).toBeVisible();

    // Kiểm tra ô gõ xác nhận OK
    const typedInput = page.locator('#confirm-typed');
    await expect(typedInput).toBeVisible();

    const confirmBtn = page.getByRole('button', { name: 'Khóa tài khoản' });
    await expect(confirmBtn).toBeDisabled();

    // Gõ OK để kích hoạt nút
    await typedInput.fill('OK');
    await expect(confirmBtn).toBeEnabled();

    // Hủy
    await page.getByRole('button', { name: 'Hủy' }).click();
    await expect(page.getByText('Khóa tài khoản người dùng?')).not.toBeVisible();
  });

  test('6. Màn hình Vai trò & Ma trận quyền (/roles) hiển thị 3 vai trò hệ thống', async ({ page }) => {
    await page.goto('/roles');

    await expect(page.getByText('Vai trò & Ma trận Phân quyền')).toBeVisible();
    await expect(page.getByText('3 vai trò')).toBeVisible();
    await expect(page.getByRole('button', { name: /Tạo vai trò mới/i })).toBeVisible();

    // Kiểm tra 3 vai trò hệ thống
    await expect(page.getByText('MANAGER')).toBeVisible();
    await expect(page.getByText('ACCOUNTANT')).toBeVisible();
    await expect(page.getByText('IT', { exact: true })).toBeVisible();

    // Kiểm tra badge Hệ thống
    const systemBadges = page.getByText('Hệ thống', { exact: true });
    await expect(systemBadges.first()).toBeVisible();

    // Kiểm tra số lượng quyền và số tài khoản dạng tabular-nums
    await expect(page.getByText('59', { exact: true })).toBeVisible();
    await expect(page.getByText('18', { exact: true })).toBeVisible();
  });

  test('7. Modal Tạo vai trò mới hiển thị đầy đủ Ma trận phân quyền nhóm theo Phân hệ', async ({ page }) => {
    await page.goto('/roles');

    await page.getByRole('button', { name: /Tạo vai trò mới/i }).click();

    await expect(page.getByRole('heading', { name: 'Tạo vai trò mới' })).toBeVisible();
    await expect(page.locator('#role_code')).toBeVisible();
    await expect(page.locator('#role_name')).toBeVisible();
    await expect(page.locator('#role_desc')).toBeVisible();

    // Kiểm tra Ma trận phân quyền
    await expect(page.getByText(/Ma trận quyền truy cập/)).toBeVisible();
    await expect(page.getByText('Xem tài khoản người dùng')).toBeVisible();
    await expect(page.getByText('(master.vehicle)')).toBeVisible();

    // Nút chọn tất cả / bỏ chọn
    await expect(page.getByRole('button', { name: 'Chọn tất cả', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Bỏ chọn tất cả' })).toBeVisible();

    // Thử chọn tất cả
    await page.getByRole('button', { name: 'Chọn tất cả', exact: true }).click();
    await expect(page.getByText(/Ma trận quyền truy cập \(10\/10\)/)).toBeVisible();

    // Đóng
    await page.getByRole('button', { name: 'Hủy' }).click();
    await expect(page.getByRole('heading', { name: 'Tạo vai trò mới' })).not.toBeVisible();
  });
});
