-- 000020_edge_key_permission.up.sql
-- Quyền cấp, cấp lại và thu hồi khóa API của trạm Edge (mỗi trạm xăng một khóa) từ trang Trạng thái trạm.
-- Khóa cho phép một mini server đẩy dữ liệu lên server nên chỉ ADMIN được giữ quyền này.
INSERT INTO station.permission (code, module, action, description)
VALUES ('sync.monitor:update', 'sync.monitor', 'update', 'Cấp, cấp lại và thu hồi khóa API của trạm Edge')
ON CONFLICT (code) DO NOTHING;

INSERT INTO station.role_permission (role_id, permission_code)
SELECT r.id, 'sync.monitor:update'
  FROM station.role r
 WHERE r.is_system AND r.code = 'ADMIN'
ON CONFLICT DO NOTHING;

-- Tenant tạo sau này: Quản lý không có quyền mới này.
CREATE OR REPLACE FUNCTION station.seed_tenant_defaults(p_tenant UUID) RETURNS VOID LANGUAGE plpgsql AS $$
DECLARE
    v_admin      UUID;
    v_manager    UUID;
    v_accountant UUID;
    v_it         UUID;
BEGIN
    INSERT INTO station.tenant_setting (tenant_id) VALUES (p_tenant) ON CONFLICT DO NOTHING;

    INSERT INTO station.role (tenant_id, code, name, description, is_system)
    VALUES (p_tenant, 'ADMIN', 'Quản trị hệ thống', 'Cao nhất: toàn quyền, kể cả duyệt phiếu xuất và quản lý tài khoản Quản lý; dành cho bên triển khai', TRUE)
    RETURNING id INTO v_admin;
    INSERT INTO station.role (tenant_id, code, name, description, is_system)
    VALUES (p_tenant, 'MANAGER', 'Quản lý', 'Quản lý đội xe, quản lý trạm và vận hành trạm: toàn quyền quản trị', TRUE)
    RETURNING id INTO v_manager;
    INSERT INTO station.role (tenant_id, code, name, description, is_system)
    VALUES (p_tenant, 'ACCOUNTANT', 'Kế toán', 'Kiểm soát số lít: duyệt xuất điều chỉnh, báo cáo Nhập – Xuất – Tồn', TRUE)
    RETURNING id INTO v_accountant;
    INSERT INTO station.role (tenant_id, code, name, description, is_system)
    VALUES (p_tenant, 'IT', 'IT kỹ thuật', 'Giám sát: chỉ xem audit, đồng bộ, dashboard, phiên đổ và danh mục', TRUE)
    RETURNING id INTO v_it;

    -- Quản trị hệ thống: mọi quyền.
    INSERT INTO station.role_permission (role_id, permission_code)
    SELECT v_admin, code FROM station.permission;

    -- Quản lý: mọi quyền, trừ duyệt phiếu xuất điều chỉnh (việc của Kế toán) và cấp khóa API trạm Edge (việc của Quản trị).
    INSERT INTO station.role_permission (role_id, permission_code)
    SELECT v_manager, code FROM station.permission WHERE code NOT IN ('inventory.issue:approve', 'sync.monitor:update');

    -- Kế toán: xem các danh mục và kho, duyệt phiếu xuất, báo cáo, gửi góp ý.
    INSERT INTO station.role_permission (role_id, permission_code)
    SELECT v_accountant, code FROM station.permission
     WHERE (action = 'view' AND module NOT IN ('iam.user', 'iam.role', 'sync.monitor', 'feedback.item'))
        OR code IN ('inventory.issue:approve', 'report:export', 'feedback.item:create');

    -- IT: chỉ xem, được gửi và xem góp ý.
    INSERT INTO station.role_permission (role_id, permission_code)
    SELECT v_it, code FROM station.permission
     WHERE (action = 'view'
            AND module IN ('audit.log', 'sync.monitor', 'org.branch', 'asset.tank', 'asset.pump', 'asset.device',
                           'master.vehicle', 'master.driver', 'master.catalog',
                           'inventory.receipt', 'dispense.session', 'dashboard', 'feedback.item'))
        OR code = 'feedback.item:create';
END;
$$;
