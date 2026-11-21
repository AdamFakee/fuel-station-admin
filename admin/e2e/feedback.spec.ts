import { test, expect, Page } from '@playwright/test';

const FEEDBACK = {
  id: 'fb-1',
  code: 'GY-2026-0001',
  kind: 'ui_ux',
  title: 'Nút lọc quá nhỏ',
  description: 'Khó bấm trên màn hình cảm ứng',
  status: 'new',
  page_url: 'http://localhost:3000/pumps',
  page_title: 'Trụ bơm',
  element: {
    selector: 'main > div > button',
    tag: 'button',
    text: 'Khai báo trụ mới',
    html: '<button data-slot="button">Khai báo trụ mới</button>',
    component: 'Button < PumpTable',
    rect: { x: 10, y: 20, width: 120, height: 40 },
  },
  viewport: { width: 1280, height: 720 },
  created_by: 'u-1',
  created_by_name: 'Nguyễn Văn Quản Lý',
  created_by_role: 'MANAGER',
  created_at: '2026-11-21T07:30:00Z',
  updated_at: '2026-11-21T07:30:00Z',
};

async function mockUser(page: Page, permissions: string[]) {
  await page.route('**/auth/me', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ id: 'u-1', username: 'admin', full_name: 'Nguyễn Văn Quản Lý', role_code: 'MANAGER', permissions }),
    })
  );
}

test.describe('Góp ý & Phản hồi', () => {
  test('1. Người có quyền gửi thấy nút Góp ý, chọn phần tử và gửi được', async ({ page }) => {
    await mockUser(page, ['feedback.item:create', 'feedback.item:view']);
    let posted: Record<string, unknown> | null = null;
    await page.route('**/feedback', async (route) => {
      // Địa chỉ trang /feedback cũng khớp mẫu này: chỉ chặn lệnh gửi góp ý (POST), còn lại cho đi tiếp.
      if (route.request().method() !== 'POST') return route.fallback();
      posted = route.request().postDataJSON();
      await route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify(FEEDBACK) });
    });
    await page.route('**/feedback?**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: [], total: 0, page: 1, page_size: 15, status_counts: {} }),
      })
    );

    await page.goto('/feedback');
    await page.getByTestId('feedback-launcher').click();
    await expect(page.getByRole('heading', { name: 'Gửi góp ý' })).toBeVisible();

    await page.getByTestId('feedback-kind-bug').click();
    await page.getByTestId('feedback-title').fill('Nút lọc quá nhỏ');
    await page.getByTestId('feedback-description').fill('Khó bấm trên màn hình cảm ứng');

    // Chọn một phần tử: banner hướng dẫn hiện, bấm vào phần tử thì quay lại hộp thoại kèm thông tin phần tử
    await page.getByTestId('feedback-pick').click();
    await expect(page.getByText('Bấm vào phần tử cần góp ý')).toBeVisible();
    await page.waitForTimeout(300);
    await page.getByPlaceholder('Tìm theo mã, tiêu đề, nội dung, người góp ý...').click();
    await expect(page.getByRole('heading', { name: 'Gửi góp ý' })).toBeVisible();
    await expect(page.getByText('Chọn lại')).toBeVisible();

    await page.getByTestId('feedback-submit').click();
    await expect.poll(() => posted).not.toBeNull();
    expect(posted).toMatchObject({ kind: 'bug', title: 'Nút lọc quá nhỏ' });
    expect((posted as unknown as { element: { selector: string } }).element.selector).toBeTruthy();
  });

  test('2. Người không có quyền gửi góp ý không thấy nút Góp ý', async ({ page }) => {
    await mockUser(page, ['asset.pump:view']);
    await page.route('**/assets/pumps**', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: [], total: 0 }) })
    );
    await page.goto('/pumps');
    await expect(page.getByTestId('feedback-launcher')).toHaveCount(0);
  });

  test('3. Màn quản lý: xem danh sách, mở chi tiết và sao chép yêu cầu đầy đủ', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await mockUser(page, ['feedback.item:view', 'feedback.item:update', 'feedback.item:delete', 'feedback.item:create']);
    await page.route('**/feedback?**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: [FEEDBACK], total: 1, page: 1, page_size: 15, status_counts: { new: 1 } }),
      })
    );

    await page.goto('/feedback');
    await expect(page.getByTestId('feedback-row-GY-2026-0001')).toBeVisible();
    await expect(page.getByText('Nút lọc quá nhỏ').first()).toBeVisible();

    await page.getByTestId('feedback-row-GY-2026-0001').click();
    await expect(page.getByText('Button < PumpTable')).toBeVisible();
    await page.getByTestId('feedback-copy').click();

    const copied = await page.evaluate(() => navigator.clipboard.readText());
    expect(copied).toContain('# Yêu cầu xử lý góp ý GY-2026-0001');
    expect(copied).toContain('Giao diện / Trải nghiệm');
    expect(copied).toContain('Selector: main > div > button');
    expect(copied).toContain('```html');
  });

  test('4. Người chỉ được gửi (không có quyền xem) không thấy mục Góp ý trên menu', async ({ page }) => {
    await mockUser(page, ['feedback.item:create', 'asset.pump:view']);
    await page.route('**/assets/pumps**', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: [], total: 0 }) })
    );
    await page.goto('/pumps');
    await expect(page.getByRole('link', { name: 'Góp ý & Phản hồi' })).toHaveCount(0);
  });

  test('5. Tick đánh dấu đã xong và sao chép tất cả góp ý theo bộ lọc', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await mockUser(page, ['feedback.item:view', 'feedback.item:update']);
    const second = { ...FEEDBACK, id: 'fb-2', code: 'GY-2026-0002', title: 'Bảng thiếu cột ngày', kind: 'improvement' };
    await page.route('**/feedback?**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: [FEEDBACK, second], total: 2, page: 1, page_size: 100, status_counts: { new: 2 } }),
      })
    );
    let patched: Record<string, unknown> | null = null;
    await page.route('**/feedback/fb-1/status', async (route) => {
      patched = route.request().postDataJSON();
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ...FEEDBACK, status: 'done' }) });
    });

    await page.goto('/feedback');
    await page.getByTestId('feedback-tick-GY-2026-0001').click();
    await expect.poll(() => patched).toMatchObject({ status: 'done' });

    await page.getByTestId('feedback-copy-all').click();
    const copied = await page.evaluate(() => navigator.clipboard.readText());
    expect(copied).toContain('# Yêu cầu xử lý góp ý GY-2026-0001');
    expect(copied).toContain('# Yêu cầu xử lý góp ý GY-2026-0002');
    expect(copied).toContain('---');
  });
});
