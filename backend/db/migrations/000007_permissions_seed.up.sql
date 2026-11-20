-- 000007_permissions_seed.up.sql
-- Danh mục quyền (module + hành động) và hàm dựng 3 vai trò mặc định cho một tenant.
--
-- 3 actor: MANAGER (Quản lý), ACCOUNTANT (Kế toán), IT (IT kỹ thuật).
--   * Quản lý giữ toàn bộ quyền quản trị: tài khoản, vai trò, phân quyền, cấu hình trụ, bể, thiết bị.
--   * IT chỉ có quyền XEM (audit, đồng bộ, dashboard, phiên đổ, danh mục): không tạo hay sửa gì.
--   * Kế toán kiểm soát SỐ LÍT: duyệt phiếu xuất điều chỉnh, xác nhận chênh lệch kiểm kê, báo cáo Nhập – Xuất – Tồn.
--   * Không có quyền cấp hay thu hồi khóa API của Edge Agent (khóa đặt lúc triển khai).

INSERT INTO station.permission (code, module, action, description) VALUES
    -- Tài khoản, vai trò
    ('iam.user:view',            'iam.user',            'view',    'Xem tài khoản người dùng'),
    ('iam.user:create',          'iam.user',            'create',  'Tạo tài khoản'),
    ('iam.user:update',          'iam.user',            'update',  'Sửa tài khoản, khóa hoặc mở khóa, đặt lại mật khẩu'),
    ('iam.user:delete',          'iam.user',            'delete',  'Xóa mềm tài khoản'),
    ('iam.role:view',            'iam.role',            'view',    'Xem vai trò và ma trận quyền'),
    ('iam.role:create',          'iam.role',            'create',  'Tạo vai trò'),
    ('iam.role:update',          'iam.role',            'update',  'Sửa ma trận quyền'),
    ('iam.role:delete',          'iam.role',            'delete',  'Xóa vai trò (chưa gán cho ai)'),
    -- Giám sát hệ thống
    ('audit.log:view',           'audit.log',           'view',    'Xem nhật ký thao tác'),
    ('audit.log:export',         'audit.log',           'export',  'Xuất nhật ký thao tác'),
    ('sync.monitor:view',        'sync.monitor',        'view',    'Xem trạng thái trạm và đồng bộ'),
    -- Tổ chức
    ('org.branch:view',          'org.branch',          'view',    'Xem nhà máy/chi nhánh'),
    ('org.branch:create',        'org.branch',          'create',  'Thêm nhà máy/chi nhánh'),
    ('org.branch:update',        'org.branch',          'update',  'Sửa nhà máy/chi nhánh'),
    ('org.branch:delete',        'org.branch',          'delete',  'Ngừng hoạt động nhà máy/chi nhánh'),
    -- Tài sản: bể, trụ bơm, thiết bị
    ('asset.tank:view',          'asset.tank',          'view',    'Xem bể chứa'),
    ('asset.tank:create',        'asset.tank',          'create',  'Khai báo bể chứa'),
    ('asset.tank:update',        'asset.tank',          'update',  'Sửa bể chứa'),
    ('asset.tank:delete',        'asset.tank',          'delete',  'Ngừng vận hành bể'),
    ('asset.pump:view',          'asset.pump',          'view',    'Xem trụ và vòi bơm'),
    ('asset.pump:create',        'asset.pump',          'create',  'Khai báo trụ, vòi bơm'),
    ('asset.pump:update',        'asset.pump',          'update',  'Sửa trụ, vòi bơm'),
    ('asset.pump:delete',        'asset.pump',          'delete',  'Ngừng vận hành trụ, vòi bơm'),
    ('asset.device:view',        'asset.device',        'view',    'Xem thiết bị (bộ số, máy chấm công)'),
    ('asset.device:create',      'asset.device',        'create',  'Khai báo thiết bị'),
    ('asset.device:update',      'asset.device',        'update',  'Sửa thiết bị'),
    ('asset.device:delete',      'asset.device',        'delete',  'Gỡ thiết bị'),
    -- Danh mục
    ('master.vehicle:view',      'master.vehicle',      'view',    'Xem xe'),
    ('master.vehicle:create',    'master.vehicle',      'create',  'Thêm xe'),
    ('master.vehicle:update',    'master.vehicle',      'update',  'Sửa xe, đổi thẻ NFC, khóa quyền đổ'),
    ('master.vehicle:delete',    'master.vehicle',      'delete',  'Xóa mềm xe'),
    ('master.driver:view',       'master.driver',       'view',    'Xem tài xế và nhân sự xác nhận'),
    ('master.driver:create',     'master.driver',       'create',  'Thêm tài xế'),
    ('master.driver:update',     'master.driver',       'update',  'Sửa tài xế, thẻ, mặt, vân tay, khóa hoặc mở khóa'),
    ('master.driver:delete',     'master.driver',       'delete',  'Xóa mềm tài xế'),
    ('master.quota:view',        'master.quota',        'view',    'Xem định mức'),
    ('master.quota:create',      'master.quota',        'create',  'Tạo định mức, cấp bổ sung hạn mức'),
    ('master.quota:update',      'master.quota',        'update',  'Điều chỉnh định mức'),
    ('master.quota:delete',      'master.quota',        'delete',  'Hủy hiệu lực định mức'),
    ('master.catalog:view',      'master.catalog',      'view',    'Xem loại nhiên liệu, loại xe, nhóm xe, tuyến, nhà cung cấp'),
    ('master.catalog:create',    'master.catalog',      'create',  'Thêm loại nhiên liệu, loại xe, nhóm xe, tuyến, nhà cung cấp'),
    ('master.catalog:update',    'master.catalog',      'update',  'Sửa các danh mục trên'),
    ('master.catalog:delete',    'master.catalog',      'delete',  'Ngừng dùng các danh mục trên'),
    -- Kho
    ('inventory.receipt:view',   'inventory.receipt',   'view',    'Xem phiếu nhập bể'),
    ('inventory.receipt:create', 'inventory.receipt',   'create',  'Lập phiếu nhập bể'),
    ('inventory.receipt:update', 'inventory.receipt',   'update',  'Sửa phiếu nhập (nháp, chờ duyệt)'),
    ('inventory.receipt:delete', 'inventory.receipt',   'delete',  'Xóa phiếu nhập (nháp, chờ duyệt)'),
    ('inventory.receipt:approve','inventory.receipt',   'approve', 'Duyệt hoặc từ chối phiếu nhập bể'),
    ('inventory.issue:view',     'inventory.issue',     'view',    'Xem phiếu xuất điều chỉnh, hao hụt'),
    ('inventory.issue:create',   'inventory.issue',     'create',  'Lập phiếu xuất điều chỉnh, hao hụt'),
    ('inventory.issue:update',   'inventory.issue',     'update',  'Sửa phiếu xuất (nháp, chờ duyệt)'),
    ('inventory.issue:delete',   'inventory.issue',     'delete',  'Xóa phiếu xuất (nháp, chờ duyệt)'),
    ('inventory.issue:approve',  'inventory.issue',     'approve', 'Duyệt hoặc từ chối phiếu xuất'),
    ('inventory.stocktake:view', 'inventory.stocktake', 'view',    'Xem kiểm kê và đối chiếu'),
    ('inventory.stocktake:create','inventory.stocktake','create',  'Lập kỳ đối chiếu'),
    ('inventory.stocktake:update','inventory.stocktake','update',  'Nhập số đo thực tế tại bể'),
    ('inventory.stocktake:approve','inventory.stocktake','approve','Xác nhận chênh lệch kiểm kê'),
    -- Giám sát và báo cáo
    ('dispense.session:view',    'dispense.session',    'view',    'Xem phiên đổ và chi tiết'),
    ('dashboard:view',           'dashboard',           'view',    'Xem dashboard'),
    ('report:view',              'report',              'view',    'Xem báo cáo'),
    ('report:export',            'report',              'export',  'Xuất báo cáo Excel hoặc PDF');

-- Dựng cấu hình mặc định cho một tenant mới: thiết lập, 3 vai trò hệ thống và quyền của từng vai trò. Gọi khi tạo tenant.
CREATE FUNCTION station.seed_tenant_defaults(p_tenant UUID) RETURNS VOID LANGUAGE plpgsql AS $$
DECLARE
    v_manager    UUID;
    v_accountant UUID;
    v_it         UUID;
BEGIN
    INSERT INTO station.tenant_setting (tenant_id) VALUES (p_tenant) ON CONFLICT DO NOTHING;

    INSERT INTO station.role (tenant_id, code, name, description, is_system)
    VALUES (p_tenant, 'MANAGER', 'Quản lý', 'Quản lý đội xe, quản lý trạm và vận hành trạm: toàn quyền quản trị', TRUE)
    RETURNING id INTO v_manager;
    INSERT INTO station.role (tenant_id, code, name, description, is_system)
    VALUES (p_tenant, 'ACCOUNTANT', 'Kế toán', 'Kiểm soát số lít: duyệt xuất điều chỉnh, xác nhận kiểm kê, báo cáo Nhập – Xuất – Tồn', TRUE)
    RETURNING id INTO v_accountant;
    INSERT INTO station.role (tenant_id, code, name, description, is_system)
    VALUES (p_tenant, 'IT', 'IT kỹ thuật', 'Giám sát: chỉ xem audit, đồng bộ, dashboard, phiên đổ và danh mục', TRUE)
    RETURNING id INTO v_it;

    -- Quản lý: mọi quyền, trừ duyệt phiếu xuất điều chỉnh và xác nhận kiểm kê (việc của Kế toán).
    INSERT INTO station.role_permission (role_id, permission_code)
    SELECT v_manager, code FROM station.permission WHERE code NOT IN ('inventory.issue:approve', 'inventory.stocktake:approve');

    -- Kế toán: xem các danh mục và kho, duyệt phiếu xuất, xác nhận kiểm kê, báo cáo.
    INSERT INTO station.role_permission (role_id, permission_code)
    SELECT v_accountant, code FROM station.permission
     WHERE (action = 'view' AND module NOT IN ('iam.user', 'iam.role', 'sync.monitor'))
        OR code IN ('inventory.issue:approve', 'inventory.stocktake:approve', 'report:export');

    -- IT: chỉ xem.
    INSERT INTO station.role_permission (role_id, permission_code)
    SELECT v_it, code FROM station.permission
     WHERE action = 'view'
       AND module IN ('audit.log', 'sync.monitor', 'org.branch', 'asset.tank', 'asset.pump', 'asset.device',
                      'master.vehicle', 'master.driver', 'master.quota', 'master.catalog',
                      'inventory.receipt', 'dispense.session', 'dashboard');
END;
$$;
