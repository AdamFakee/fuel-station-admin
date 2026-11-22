-- 000017_role_descriptions.up.sql
-- Kiểm kê và định mức đã bị bỏ (000015, 000016): sửa mô tả vai trò Kế toán cho khỏi nhắc tới "kiểm kê",
-- và bỏ các quyền đã xóa khỏi hàm tạo vai trò mặc định cho tenant mới.
UPDATE station.role
   SET description = 'Kiểm soát số lít: duyệt xuất điều chỉnh, báo cáo Nhập – Xuất – Tồn'
 WHERE is_system AND code = 'ACCOUNTANT';

CREATE OR REPLACE FUNCTION station.seed_tenant_defaults(p_tenant UUID) RETURNS VOID LANGUAGE plpgsql AS $$
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
    VALUES (p_tenant, 'ACCOUNTANT', 'Kế toán', 'Kiểm soát số lít: duyệt xuất điều chỉnh, báo cáo Nhập – Xuất – Tồn', TRUE)
    RETURNING id INTO v_accountant;
    INSERT INTO station.role (tenant_id, code, name, description, is_system)
    VALUES (p_tenant, 'IT', 'IT kỹ thuật', 'Giám sát: chỉ xem audit, đồng bộ, dashboard, phiên đổ và danh mục', TRUE)
    RETURNING id INTO v_it;

    -- Quản lý: mọi quyền, trừ duyệt phiếu xuất điều chỉnh (việc của Kế toán).
    INSERT INTO station.role_permission (role_id, permission_code)
    SELECT v_manager, code FROM station.permission WHERE code <> 'inventory.issue:approve';

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
