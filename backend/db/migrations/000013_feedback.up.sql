-- Góp ý của người dùng: cải thiện tính năng, giao diện / trải nghiệm, lỗi, nghiệp vụ.
-- Người góp ý có thể chọn một phần tử trên màn hình; thông tin phần tử đó được lưu kèm để người xử lý nhìn là biết ngay chỗ nào.

CREATE TABLE station.feedback (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id        UUID        NOT NULL REFERENCES station.tenant (id),
    code             TEXT        NOT NULL,                       -- GY-2026-0001 (station.next_code)
    kind             TEXT        NOT NULL CHECK (kind IN ('improvement', 'ui_ux', 'bug', 'business')),
    title            TEXT        NOT NULL CHECK (char_length(btrim(title)) BETWEEN 1 AND 200),
    description      TEXT        NOT NULL CHECK (char_length(btrim(description)) BETWEEN 1 AND 5000),
    status           TEXT        NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'reviewing', 'planned', 'done', 'rejected')),
    resolution_note  TEXT,                                       -- ghi chú của người xử lý (lý do từ chối, kế hoạch...)
    page_url         TEXT,
    page_title       TEXT,
    element          JSONB,                                      -- phần tử đã chọn: selector, thẻ, nội dung, thành phần React, kích thước
    viewport         JSONB,                                      -- kích thước cửa sổ lúc góp ý
    user_agent       TEXT,
    created_by       UUID        NOT NULL,
    created_by_name  TEXT        NOT NULL,                       -- ảnh chụp tên và vai trò lúc góp ý
    created_by_role  TEXT        NOT NULL,
    updated_by       UUID,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (tenant_id, id),
    UNIQUE (tenant_id, code),
    FOREIGN KEY (tenant_id, created_by) REFERENCES station.app_user (tenant_id, id)
);
CREATE INDEX ix_feedback_list ON station.feedback (tenant_id, status, created_at DESC);

INSERT INTO station.permission (code, module, action, description) VALUES
    ('feedback.item:create', 'feedback.item', 'create', 'Gửi góp ý (cải thiện, giao diện, lỗi, nghiệp vụ)'),
    ('feedback.item:view',   'feedback.item', 'view',   'Xem danh sách góp ý của mọi người'),
    ('feedback.item:update', 'feedback.item', 'update', 'Đổi trạng thái và ghi chú xử lý góp ý'),
    ('feedback.item:delete', 'feedback.item', 'delete', 'Xóa góp ý');

-- Vai trò hệ thống đã có: Quản lý đủ 4 quyền, Kế toán chỉ gửi, IT gửi và xem.
INSERT INTO station.role_permission (role_id, permission_code)
SELECT r.id, p.code FROM station.role r JOIN station.permission p ON p.module = 'feedback.item'
 WHERE r.is_system AND r.code = 'MANAGER';
INSERT INTO station.role_permission (role_id, permission_code)
SELECT r.id, 'feedback.item:create' FROM station.role r WHERE r.is_system AND r.code IN ('ACCOUNTANT', 'IT');
INSERT INTO station.role_permission (role_id, permission_code)
SELECT r.id, 'feedback.item:view' FROM station.role r WHERE r.is_system AND r.code = 'IT';

-- Tenant tạo sau này cũng nhận đúng các quyền trên.
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
    VALUES (p_tenant, 'ACCOUNTANT', 'Kế toán', 'Kiểm soát số lít: duyệt xuất điều chỉnh, xác nhận kiểm kê, báo cáo Nhập – Xuất – Tồn', TRUE)
    RETURNING id INTO v_accountant;
    INSERT INTO station.role (tenant_id, code, name, description, is_system)
    VALUES (p_tenant, 'IT', 'IT kỹ thuật', 'Giám sát: chỉ xem audit, đồng bộ, dashboard, phiên đổ và danh mục', TRUE)
    RETURNING id INTO v_it;

    -- Quản lý: mọi quyền, trừ duyệt phiếu xuất điều chỉnh và xác nhận kiểm kê (việc của Kế toán).
    INSERT INTO station.role_permission (role_id, permission_code)
    SELECT v_manager, code FROM station.permission WHERE code NOT IN ('inventory.issue:approve', 'inventory.stocktake:approve');

    -- Kế toán: xem các danh mục và kho, duyệt phiếu xuất, xác nhận kiểm kê, báo cáo, gửi góp ý.
    INSERT INTO station.role_permission (role_id, permission_code)
    SELECT v_accountant, code FROM station.permission
     WHERE (action = 'view' AND module NOT IN ('iam.user', 'iam.role', 'sync.monitor', 'feedback.item'))
        OR code IN ('inventory.issue:approve', 'inventory.stocktake:approve', 'report:export', 'feedback.item:create');

    -- IT: chỉ xem, được gửi và xem góp ý.
    INSERT INTO station.role_permission (role_id, permission_code)
    SELECT v_it, code FROM station.permission
     WHERE (action = 'view'
            AND module IN ('audit.log', 'sync.monitor', 'org.branch', 'asset.tank', 'asset.pump', 'asset.device',
                           'master.vehicle', 'master.driver', 'master.quota', 'master.catalog',
                           'inventory.receipt', 'dispense.session', 'dashboard', 'feedback.item'))
        OR code = 'feedback.item:create';
END;
$$;
