import { test, expect } from '@playwright/test';
import ExcelJS from 'exceljs';

/** Dựng file .xlsx đúng định dạng mẫu: tiêu đề ở dòng 1, dữ liệu từ dòng 2. */
async function buildWorkbook(rows: string[][]): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Dữ liệu');
  sheet.addRow(['Họ và tên *', 'Số điện thoại', 'Số thẻ NFC', 'Hiệu lực từ', 'Hiệu lực đến', 'Ghi chú']);
  for (const row of rows) sheet.addRow(row);
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

test.describe('Nhập tài xế từ Excel', () => {
  test.beforeEach(async ({ page }) => {
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
          permissions: ['dashboard:view', 'master.driver:view', 'master.driver:create'],
        }),
      });
    });
    await page.route('**/master/catalogs/summary', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ branches: [], fuel_types: [], vehicle_types: [] }),
      });
    });
    await page.route('**/master/drivers?*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ items: [], total: 0, page: 1, page_size: 15 }),
      });
    });
  });

  test('dòng thiếu dữ liệu hiện đúng người và cho điền bổ sung ngay rồi mới nhập', async ({ page }) => {
    let importPayload: { rows: Record<string, string>[] } | null = null;
    await page.route('**/master/drivers/import', async (route) => {
      importPayload = JSON.parse(route.request().postData() || '{}');
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ created: importPayload!.rows.length, failed: [] }),
      });
    });

    await page.goto('/drivers');
    await page.getByTestId('btn-import-drivers').click();

    const file = await buildWorkbook([
      ['Nguyễn Văn A', '0911111111', '3000000001', '', '', ''],
      ['', '0922222222', '', '', '', ''], // thiếu họ tên
      ['Lê Văn C', '', '12AB', '', '', ''], // số thẻ không phải số
    ]);
    await page.getByTestId('input-import-file').setInputFiles({
      name: 'tai-xe.xlsx',
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      buffer: file,
    });

    // Chỉ rõ từng người đang thiếu gì, không báo lỗi chung chung
    const missingName = page.getByTestId('import-row-3');
    await expect(missingName).toContainText('Dòng 3');
    await expect(missingName).toContainText('Chưa có tên');
    await expect(missingName).toContainText('Chưa nhập (bắt buộc)');

    const badValues = page.getByTestId('import-row-4');
    await expect(badValues).toContainText('Lê Văn C');
    await expect(badValues).toContainText('Số thẻ phải là chuỗi chữ số thập phân');

    // Điền tiếp phần thiếu: dòng chuyển sang "sẵn sàng" ngay
    await page.locator('#import-3-full_name').fill('Trần Văn B');
    await expect(page.getByTestId('import-row-3')).toHaveCount(0);
    await page.locator('#import-4-card_number').fill('3000000003');
    await expect(page.getByTestId('import-incomplete-rows')).toHaveCount(0);

    await page.getByTestId('btn-confirm-import').click();
    await expect.poll(() => importPayload?.rows.length).toBe(3);
    expect(importPayload!.rows.map((r) => r.full_name)).toEqual(['Nguyễn Văn A', 'Trần Văn B', 'Lê Văn C']);
  });

  test('file thiếu cột bắt buộc báo rõ cột nào thiếu', async ({ page }) => {
    await page.goto('/drivers');
    await page.getByTestId('btn-import-drivers').click();

    const workbook = new ExcelJS.Workbook();
    workbook.addWorksheet('Dữ liệu').addRow(['Số điện thoại', 'Ghi chú']);
    await page.getByTestId('input-import-file').setInputFiles({
      name: 'sai.xlsx',
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      buffer: Buffer.from(await workbook.xlsx.writeBuffer()),
    });

    await expect(page.getByText('File thiếu cột: Họ và tên')).toBeVisible();
  });
});
