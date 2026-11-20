-- 000008_seed_initial_tenant.up.sql
-- Seed dữ liệu khởi tạo cho môi trường phát triển và vận hành ban đầu:
-- Tenant mặc định 'CTY-01', chi nhánh 'TRAM-01' và 3 actor: Quản lý (quanly), Kế toán (ketoan), IT (itadmin).
-- Mật khẩu mặc định: Admin@123456 (Argon2id, yêu cầu đổi mật khẩu lần đầu).

DO $$
DECLARE
    v_tenant_id UUID;
    v_branch_id UUID;
    v_manager_role_id UUID;
    v_accountant_role_id UUID;
    v_it_role_id UUID;
    v_password_hash TEXT := '$argon2id$v=19$m=65536,t=3,p=2$A44NHK3fzR233jgHQs+1cg$haJwgSqhrLvwO8cNdAyLru3c6ulUC+Ir0XusPKGc/sM';
    v_u_manager UUID;
    v_u_accountant UUID;
    v_u_it UUID;
BEGIN
    -- Chỉ tạo nếu chưa có tenant CTY-01
    IF NOT EXISTS (SELECT 1 FROM station.tenant WHERE code = 'CTY-01') THEN
        INSERT INTO station.tenant (code, name, status)
        VALUES ('CTY-01', 'Tổng Công ty Xăng Dầu Petromex', 'active')
        RETURNING id INTO v_tenant_id;

        -- Khởi tạo thiết lập và 3 vai trò hệ thống
        PERFORM station.seed_tenant_defaults(v_tenant_id);

        -- Chi nhánh mặc định
        INSERT INTO station.branch (tenant_id, code, name, address, manager_name, phone, status)
        VALUES (v_tenant_id, 'TRAM-01', 'Trạm Xăng Dầu Số 1', '123 Đường Giải Phóng, Hà Nội', 'Nguyễn Văn Quản Lý', '0901234567', 'active')
        RETURNING id INTO v_branch_id;

        SELECT id INTO v_manager_role_id FROM station.role WHERE tenant_id = v_tenant_id AND code = 'MANAGER';
        SELECT id INTO v_accountant_role_id FROM station.role WHERE tenant_id = v_tenant_id AND code = 'ACCOUNTANT';
        SELECT id INTO v_it_role_id FROM station.role WHERE tenant_id = v_tenant_id AND code = 'IT';

        -- 1. Quản lý
        INSERT INTO station.app_user (
            tenant_id, employee_code, full_name, email, username,
            password_hash, role_id, status, must_change_password
        ) VALUES (
            v_tenant_id, 'NV-001', 'Nguyễn Văn Quản Lý', 'quanly@petromex.vn', 'quanly',
            v_password_hash, v_manager_role_id, 'active', TRUE
        ) RETURNING id INTO v_u_manager;

        -- 2. Kế toán
        INSERT INTO station.app_user (
            tenant_id, employee_code, full_name, email, username,
            password_hash, role_id, status, must_change_password
        ) VALUES (
            v_tenant_id, 'NV-002', 'Trần Thị Kế Toán', 'ketoan@petromex.vn', 'ketoan',
            v_password_hash, v_accountant_role_id, 'active', TRUE
        ) RETURNING id INTO v_u_accountant;

        -- 3. IT kỹ thuật
        INSERT INTO station.app_user (
            tenant_id, employee_code, full_name, email, username,
            password_hash, role_id, status, must_change_password
        ) VALUES (
            v_tenant_id, 'NV-003', 'Lê Kỹ Thuật IT', 'it@petromex.vn', 'itadmin',
            v_password_hash, v_it_role_id, 'active', TRUE
        ) RETURNING id INTO v_u_it;

        -- Gán chi nhánh TRAM-01 cho cả 3 user
        INSERT INTO station.user_branch (tenant_id, user_id, branch_id) VALUES
            (v_tenant_id, v_u_manager, v_branch_id),
            (v_tenant_id, v_u_accountant, v_branch_id),
            (v_tenant_id, v_u_it, v_branch_id);

        -- Khởi tạo trạm Edge Agent cho TRAM-01 (API Key: edge_key_tram01)
        INSERT INTO station.edge_station (
            tenant_id, branch_id, code, name, api_key_hash, status, agent_version, last_seen_at
        ) VALUES (
            v_tenant_id, v_branch_id, 'EDGE-TRAM-01', 'Edge Agent Trạm 1',
            'fb5a4b6610d5fdb0d172a2b83c0bf649b24073f8ea03a5e9fa41f46d64f02e71',
            'active', '1.0.0', now()
        );
    END IF;
END;
$$;
