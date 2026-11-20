import { test, expect } from '@playwright/test';

test.describe('Module M10 - Nhập bể (Stock Receipts) & Kiểm soát Sức chứa E2E Tests', () => {

  // Mock dữ liệu mặc định dùng chung cho các test case
  test.beforeEach(async ({ page }) => {
    // 1. Mock Quản lý (MANAGER)
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
            'inventory.receipt:view',
            'inventory.receipt:create',
            'inventory.receipt:update',
            'inventory.receipt:delete',
            'inventory.receipt:approve',
          ],
        }),
      });
    });

    // 2. Mock danh sách chi nhánh
    await page.route('**/assets/branches*', async (route) => {
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
              status: 'active',
            },
          ],
          total: 1,
        }),
      });
    });

    // 3. Mock danh sách bể chứa
    await page.route('**/assets/tanks*', async (route) => {
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
              current_stock_ml: 10000000, // 10,000 L, còn trống 14,000 L
              status: 'active',
            },
            {
              id: 'tk-02',
              tenant_id: 't-01',
              branch_id: 'b-01',
              branch_name: 'Trạm Xăng Dầu Số 1',
              code: 'TK-A95-01',
              name: 'Bể Xăng A95 Số 1',
              fuel_type_id: 'ft-02',
              fuel_type_name: 'Xăng RON 95-III',
              design_capacity_ml: 20000000,
              max_usable_capacity_ml: 19000000,
              current_stock_ml: 18000000, // 18,000 L, còn trống chỉ 1,000 L
              status: 'active',
            },
          ],
          total: 2,
        }),
      });
    });

    // 4. Mock danh sách nhà cung cấp
    await page.route('**/inventory/suppliers*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: 'sup-01',
            tenant_id: 't-01',
            code: 'PETROLIMEX',
            name: 'Tập đoàn Xăng dầu Petrolimex',
            phone: '0241234567',
            address: 'Hà Nội',
            active: true,
          },
          {
            id: 'sup-02',
            tenant_id: 't-01',
            code: 'PVOIL',
            name: 'Tổng công ty Dầu Việt Nam PVOIL',
            phone: '0289876543',
            address: 'TP. Hồ Chí Minh',
            active: true,
          },
        ]),
      });
    });

    // 5. Mock API kiểm tra dung tích bể
    await page.route('**/v1/inventory/receipts/check-capacity*', async (route) => {
      const body = route.request().postDataJSON();
      const tankId = body?.tank_id;
      const incomingVolumeML = body?.incoming_volume_ml || 0;

      // tk-01: max 24,000,000 ml, current 10,000,000 ml -> room = 14,000,000 ml
      // tk-02: max 19,000,000 ml, current 18,000,000 ml -> room = 1,000,000 ml
      const isTank2 = tankId === 'tk-02';
      const availableRoomML = isTank2 ? 1000000 : 14000000;
      const exceeds = incomingVolumeML > availableRoomML;

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          tank_id: tankId,
          tank_name: isTank2 ? 'Bể Xăng A95 Số 1' : 'Bể Dầu DO Số 1',
          current_stock_ml: isTank2 ? 18000000 : 10000000,
          max_usable_capacity_ml: isTank2 ? 19000000 : 24000000,
          available_room_ml: availableRoomML,
          incoming_volume_ml: incomingVolumeML,
          exceeds_capacity: exceeds,
        }),
      });
    });
  });

  // ----------------------------------------------------------------------------------------------
  // Test 1: Danh sách phiếu nhập bể
  // ----------------------------------------------------------------------------------------------
  test('TC-M10-01: Hiển thị danh sách phiếu nhập bể với các cột dữ liệu và định dạng Lít', async ({ page }) => {
    // Mock danh sách phiếu nhập
    await page.route('**/v1/inventory/receipts*', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            data: [
              {
                id: 'rc-01',
                tenant_id: 't-01',
                branch_id: 'b-01',
                branch_name: 'Trạm Xăng Dầu Số 1',
                code: 'PN-2026-0001',
                received_at: '2026-11-20T08:30:00Z',
                supplier_id: 'sup-01',
                supplier_name: 'Tập đoàn Xăng dầu Petrolimex',
                tanker_plate: '29C-888.88',
                document_no: 'HĐ-89012',
                status: 'draft',
                total_volume_ml: 12000000, // 12,000 L
                created_by: 'u-operator',
                created_by_name: 'Nguyễn Văn Vận Hành',
                lines: [
                  {
                    id: 'rcl-01',
                    receipt_id: 'rc-01',
                    tank_id: 'tk-01',
                    tank_code: 'TK-DO-01',
                    tank_name: 'Bể Dầu DO Số 1',
                    fuel_type_id: 'ft-01',
                    fuel_type_name: 'Dầu DO 0.05S',
                    document_volume_ml: 12000000,
                    actual_volume_ml: 12000000,
                    variance_ml: 0,
                  },
                ],
                created_at: '2026-11-20T08:30:00Z',
                updated_at: '2026-11-20T08:30:00Z',
              },
              {
                id: 'rc-02',
                tenant_id: 't-01',
                branch_id: 'b-01',
                branch_name: 'Trạm Xăng Dầu Số 1',
                code: 'PN-2026-0002',
                received_at: '2026-11-19T14:15:00Z',
                supplier_id: 'sup-02',
                supplier_name: 'Tổng công ty Dầu Việt Nam PVOIL',
                tanker_plate: '51D-999.99',
                document_no: 'PXK-5544',
                status: 'approved',
                total_volume_ml: 8000000, // 8,000 L
                created_by: 'u-operator',
                created_by_name: 'Nguyễn Văn Vận Hành',
                decided_by: 'u-manager',
                decided_by_name: 'Nguyễn Văn Quản Lý',
                decided_at: '2026-11-19T15:00:00Z',
                lines: [
                  {
                    id: 'rcl-02',
                    receipt_id: 'rc-02',
                    tank_id: 'tk-02',
                    tank_code: 'TK-A95-01',
                    tank_name: 'Bể Xăng A95 Số 1',
                    fuel_type_id: 'ft-02',
                    fuel_type_name: 'Xăng RON 95-III',
                    document_volume_ml: 8000000,
                    actual_volume_ml: 8000000,
                    variance_ml: 0,
                  },
                ],
                created_at: '2026-11-19T14:15:00Z',
                updated_at: '2026-11-19T15:00:00Z',
              },
            ],
            total: 2,
            page: 1,
            page_size: 20,
          }),
        });
      }
    });

    await page.goto('/inventory/receipts');

    // Kiểm tra tiêu đề trang
    await expect(page.getByRole('heading', { name: 'Phiếu nhập bể' })).toBeVisible();

    // Kiểm tra các dòng phiếu nhập
    await expect(page.getByText('PN-2026-0001')).toBeVisible();
    await expect(page.getByText('29C-888.88')).toBeVisible();
    await expect(page.getByText('12.000')).toBeVisible(); // 12,000 L formatted VN
    await expect(page.getByRole('table').getByText('Bản nháp')).toBeVisible();

    await expect(page.getByText('PN-2026-0002')).toBeVisible();
    await expect(page.getByText('51D-999.99')).toBeVisible();
    await expect(page.getByText('8.000')).toBeVisible(); // 8,000 L
    await expect(page.getByRole('table').getByText('Đã duyệt')).toBeVisible();
  });

  // ----------------------------------------------------------------------------------------------
  // Test 2: Lập phiếu nhập bể mới
  // ----------------------------------------------------------------------------------------------
  test('TC-M10-02: Lập phiếu nhập bể mới, thêm dòng bể và kiểm tra tính toán thể tích Lít', async ({ page }) => {
    // Mock danh sách ban đầu rỗng
    await page.route('**/v1/inventory/receipts*', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ data: [], total: 0 }),
        });
      } else if (route.request().method() === 'POST') {
        const body = route.request().postDataJSON();
        // Kiểm tra đúng định dạng converted ml
        expect(body.branch_id).toBe('b-01');
        expect(body.lines).toHaveLength(1);
        expect(body.lines[0].document_volume_ml).toBe(5000000); // 5000 L * 1000
        expect(body.lines[0].actual_volume_ml).toBe(5000000);

        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({
            id: 'rc-new',
            code: 'PN-2026-0003',
            status: 'draft',
            total_volume_ml: 5000000,
            lines: [],
          }),
        });
      }
    });

    await page.goto('/inventory/receipts');

    // Nhấn nút Lập phiếu nhập
    await page.getByRole('button', { name: 'Lập phiếu nhập' }).click();

    // Modal xuất hiện
    await expect(page.getByRole('heading', { name: 'Lập phiếu nhập bể' })).toBeVisible();

    // Điền thông tin chung
    await page.locator('#tanker_plate').fill('29B-123.45');
    await page.locator('#document_no').fill('HD-TEST-001');

    // Thêm dòng bể
    await page.getByRole('button', { name: 'Thêm dòng bể' }).click();
    await expect(page.getByText('Dòng #1')).toBeVisible();

    // Nhập thể tích chứng từ và thực tế (5000 Lít)
    const docInputs = page.locator('input[type="number"]');
    await docInputs.nth(0).fill('5000');
    await docInputs.nth(1).fill('5000');

    // Kiểm tra tổng cộng đợt nhập cập nhật 5.000 L
    await expect(page.getByText('5.000 L').first()).toBeVisible();

    // Bấm nút Lưu/Tạo phiếu nhập
    await page.getByRole('button', { name: 'Tạo phiếu nhập' }).click();

    // Kiểm tra toast thành công
    await expect(page.getByText('Đã tạo phiếu nhập PN-2026-0003')).toBeVisible();
  });

  // ----------------------------------------------------------------------------------------------
  // Test 3: Cảnh báo vượt sức chứa khả dụng (Capacity Pre-Check)
  // ----------------------------------------------------------------------------------------------
  test('TC-M10-03: Cảnh báo vượt sức chứa khả dụng khi số lượng nhập lớn hơn dung tích bể', async ({ page }) => {
    await page.route('**/v1/inventory/receipts*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: [], total: 0 }),
      });
    });

    await page.goto('/inventory/receipts');
    await page.getByRole('button', { name: 'Lập phiếu nhập' }).click();

    // Thêm dòng bể
    await page.getByRole('button', { name: 'Thêm dòng bể' }).click();

    // Chọn Bể TK-A95-01 (Bể này chỉ còn trống 1,000 L trong mock check-capacity)
    const tankSelect = page.getByTestId('line-tank-select');
    await tankSelect.selectOption('tk-02');

    // Nhập chứng từ 5,000 Lít và thực tế 5,000 Lít (vượt quá 1,000 Lít còn trống)
    const numberInputs = page.locator('input[type="number"]');
    await numberInputs.nth(0).fill('5000');
    await numberInputs.nth(1).fill('5000');

    // Chờ phản hồi check capacity và kiểm tra nhãn cảnh báo đỏ
    await expect(page.getByText('Vượt sức chứa khả dụng!')).toBeVisible();

    // Bấm Tạo phiếu nhập -> Hệ thống phải chặn và báo lỗi toast
    await page.getByRole('button', { name: 'Tạo phiếu nhập' }).click();
    await expect(page.getByText('vượt quá dung tích khả dụng còn lại của bể!')).toBeVisible();
  });

  // ----------------------------------------------------------------------------------------------
  // Test 4: Phê duyệt hai người (Two-Person Rule) & Duyệt phiếu nhập
  // ----------------------------------------------------------------------------------------------
  test('TC-M10-04: Mở modal phê duyệt phiếu nhập với cảnh báo kiểm soát kép Two-Person Rule và duyệt thành công', async ({ page }) => {
    // Mock phiếu ở trạng thái pending do 'Nguyễn Văn Lập Phiếu' tạo
    await page.route('**/v1/inventory/receipts*', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            data: [
              {
                id: 'rc-pending',
                tenant_id: 't-01',
                branch_id: 'b-01',
                branch_name: 'Trạm Xăng Dầu Số 1',
                code: 'PN-2026-0099',
                received_at: '2026-11-20T09:00:00Z',
                status: 'pending',
                total_volume_ml: 10000000, // 10,000 L
                created_by: 'u-operator-99',
                created_by_name: 'Nguyễn Văn Lập Phiếu',
                lines: [
                  {
                    id: 'rcl-99',
                    tank_id: 'tk-01',
                    tank_code: 'TK-DO-01',
                    tank_name: 'Bể Dầu DO Số 1',
                    fuel_type_id: 'ft-01',
                    fuel_type_name: 'Dầu DO 0.05S',
                    document_volume_ml: 10000000,
                    actual_volume_ml: 10000000,
                    variance_ml: 0,
                  },
                ],
                created_at: '2026-11-20T09:00:00Z',
                updated_at: '2026-11-20T09:00:00Z',
              },
            ],
            total: 1,
          }),
        });
      }
    });

    // Mock API duyệt phiếu
    await page.route('**/v1/inventory/receipts/rc-pending/approve*', async (route) => {
      const body = route.request().postDataJSON();
      expect(body.approved).toBe(true);

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'rc-pending',
          code: 'PN-2026-0099',
          status: 'approved',
          decided_by: 'u-manager',
          decided_by_name: 'Nguyễn Văn Quản Lý',
        }),
      });
    });

    await page.goto('/inventory/receipts');

    // Kiểm tra hàng có nút Duyệt (CheckCircleIcon)
    const approveBtn = page.locator('button[title="Phê duyệt / Từ chối"]');
    await expect(approveBtn).toBeVisible();
    await approveBtn.click();

    // Kiểm tra Modal phê duyệt hiển thị
    await expect(page.getByRole('heading', { name: 'Phê duyệt phiếu nhập bể PN-2026-0099' })).toBeVisible();

    // Kiểm tra cảnh báo Two-Person Rule
    await expect(page.getByText('Kiểm soát kép (Two-Person Rule)')).toBeVisible();
    await expect(page.getByText('Nguyễn Văn Lập Phiếu', { exact: true })).toBeVisible();

    // Bấm Xác nhận duyệt
    await page.getByRole('button', { name: 'Xác nhận duyệt' }).click();

    // Kiểm tra toast thành công
    await expect(page.getByText('Đã duyệt thành công phiếu nhập PN-2026-0099')).toBeVisible();
  });

  // ----------------------------------------------------------------------------------------------
  // Test 5: Phân quyền RBAC Kế toán (ACCOUNTANT) - Chế độ chỉ xem (View-Only)
  // ----------------------------------------------------------------------------------------------
  test('TC-M10-05: Người dùng vai trò Kế toán (ACCOUNTANT) chỉ có quyền xem, không hiển thị nút Lập phiếu hay Duyệt phiếu', async ({ page }) => {
    // Override user profile với role Kế toán
    await page.route('**/auth/me', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'u-accountant',
          tenant_id: 't-01',
          username: 'ketoan',
          full_name: 'Trần Thị Kế Toán',
          role_code: 'ACCOUNTANT',
          role_name: 'Kế toán',
          permissions: ['dashboard:view', 'inventory.receipt:view'],
        }),
      });
    });

    await page.route('**/v1/inventory/receipts*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: [
            {
              id: 'rc-view',
              tenant_id: 't-01',
              branch_name: 'Trạm Xăng Dầu Số 1',
              code: 'PN-2026-0001',
              received_at: '2026-11-20T08:30:00Z',
              status: 'pending',
              total_volume_ml: 12000000,
              created_by: 'u-operator',
              created_by_name: 'Nguyễn Văn Vận Hành',
              lines: [],
            },
          ],
          total: 1,
        }),
      });
    });

    await page.goto('/inventory/receipts');

    // Kiểm tra Kế toán vẫn thấy danh sách phiếu
    await expect(page.getByText('PN-2026-0001')).toBeVisible();

    // Nút Lập phiếu nhập KHÔNG hiển thị đối với ACCOUNTANT
    await expect(page.getByRole('button', { name: 'Lập phiếu nhập' })).not.toBeVisible();

    // Nút Phê duyệt / Từ chối KHÔNG hiển thị
    await expect(page.locator('button[title="Phê duyệt / Từ chối"]')).not.toBeVisible();

    // Nút Xem chi tiết vẫn hiển thị
    await expect(page.locator('button[title="Xem chi tiết"]')).toBeVisible();
  });
});
