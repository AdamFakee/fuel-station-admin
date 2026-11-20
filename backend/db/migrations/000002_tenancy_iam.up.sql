-- 000002_tenancy_iam.up.sql
-- Nền tảng: hàm dùng chung, tenant (công ty), branch (nhà máy/chi nhánh/trạm), tài khoản, vai trò, quyền, phiên đăng nhập, audit log.
--
-- Quy ước toàn schema `station`:
--   * id UUID (gen_random_uuid) là khóa kỹ thuật; code là mã người dùng đọc được, duy nhất TRONG tenant.
--   * Mọi bảng dữ liệu tenant có tenant_id; bảng cha có UNIQUE (tenant_id, id) để bảng con dùng FK ghép
--     (tenant_id, x_id): dữ liệu của hai tenant không thể tham chiếu chéo nhau ở tầng DB.
--   * Thời gian là timestamptz (UTC). Không có cột tiền: hệ thống nội bộ, chỉ theo dõi LÍT.
--   * Thể tích lưu bằng mililít (BIGINT, hậu tố _ml) cho khớp với Edge Agent.

-- ---------------------------------------------------------------------------------------------------
-- Hàm dùng chung
-- ---------------------------------------------------------------------------------------------------

-- Ghi lại thời điểm sửa.
CREATE FUNCTION station.set_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at := now();
    RETURN NEW;
END;
$$;

-- Tăng version mỗi lần sửa (Edge Agent dùng version để biết bản nào mới hơn) và ghi thời điểm sửa.
CREATE FUNCTION station.bump_version() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    NEW.version := OLD.version + 1;
    NEW.updated_at := now();
    RETURN NEW;
END;
$$;

-- Sinh mã chứng từ dạng PN-2026-0001 (kind = tiền tố). Gọi trong cùng giao dịch với việc tạo bản ghi.
CREATE TABLE station.code_sequence (
    tenant_id  UUID    NOT NULL,
    kind       TEXT    NOT NULL,
    year       INTEGER NOT NULL,
    last_value BIGINT  NOT NULL DEFAULT 0,
    PRIMARY KEY (tenant_id, kind, year)
);

CREATE FUNCTION station.next_code(p_tenant UUID, p_kind TEXT) RETURNS TEXT LANGUAGE plpgsql AS $$
DECLARE
    v_year  INTEGER := EXTRACT(YEAR FROM (now() AT TIME ZONE 'Asia/Ho_Chi_Minh'))::INTEGER;
    v_value BIGINT;
BEGIN
    INSERT INTO station.code_sequence AS s (tenant_id, kind, year, last_value)
    VALUES (p_tenant, p_kind, v_year, 1)
    ON CONFLICT (tenant_id, kind, year) DO UPDATE SET last_value = s.last_value + 1
    RETURNING last_value INTO v_value;
    RETURN p_kind || '-' || v_year || '-' || lpad(v_value::TEXT, 4, '0');
END;
$$;

-- ---------------------------------------------------------------------------------------------------
-- Tenant và Branch
-- ---------------------------------------------------------------------------------------------------

CREATE TABLE station.tenant (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code       TEXT        NOT NULL UNIQUE CHECK (code ~ '^[A-Za-z0-9_-]{2,32}$'),
    name       TEXT        NOT NULL,
    status     TEXT        NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TRIGGER trg_tenant_updated BEFORE UPDATE ON station.tenant FOR EACH ROW EXECUTE FUNCTION station.set_updated_at();

-- Thiết lập theo tenant (một dòng mỗi tenant).
CREATE TABLE station.tenant_setting (
    tenant_id            UUID PRIMARY KEY REFERENCES station.tenant (id),
    -- Cho phép người lập phiếu tự duyệt phiếu của mình (trạm nhỏ chỉ có một quản lý). Mặc định: bắt buộc người khác duyệt.
    allow_self_approval  BOOLEAN     NOT NULL DEFAULT FALSE,
    -- Thời gian chờ tự khóa cột bơm khi đã mở khóa mà chưa bơm (BRD: 30 đến 60 giây).
    ready_timeout_seconds INTEGER    NOT NULL DEFAULT 60 CHECK (ready_timeout_seconds BETWEEN 10 AND 600),
    -- Số lần đăng nhập sai tối đa trước khi khóa tạm, và thời gian khóa.
    max_failed_logins    INTEGER     NOT NULL DEFAULT 5 CHECK (max_failed_logins BETWEEN 3 AND 20),
    lockout_minutes      INTEGER     NOT NULL DEFAULT 15 CHECK (lockout_minutes BETWEEN 1 AND 1440),
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Nhà máy / chi nhánh / trạm. Một chi nhánh là một phạm vi dữ liệu.
CREATE TABLE station.branch (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id  UUID        NOT NULL REFERENCES station.tenant (id),
    code       TEXT        NOT NULL CHECK (code ~ '^[A-Za-z0-9_-]{1,32}$'),
    name       TEXT        NOT NULL,
    address    TEXT,
    manager_name TEXT,
    phone      TEXT,
    status     TEXT        NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (tenant_id, id),
    UNIQUE (tenant_id, code)
);
CREATE TRIGGER trg_branch_updated BEFORE UPDATE ON station.branch FOR EACH ROW EXECUTE FUNCTION station.set_updated_at();

-- ---------------------------------------------------------------------------------------------------
-- IAM: quyền, vai trò, tài khoản
-- ---------------------------------------------------------------------------------------------------

-- Danh mục quyền (do code định nghĩa, seed ở migration 000007): module + hành động.
CREATE TABLE station.permission (
    code        TEXT PRIMARY KEY,                 -- ví dụ 'inventory.receipt:approve'
    module      TEXT NOT NULL,
    action      TEXT NOT NULL CHECK (action IN ('view', 'create', 'update', 'delete', 'approve', 'export')),
    description TEXT NOT NULL,
    UNIQUE (module, action)
);

CREATE TABLE station.role (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id   UUID        NOT NULL REFERENCES station.tenant (id),
    code        TEXT        NOT NULL CHECK (code ~ '^[A-Za-z0-9_-]{2,32}$'),
    name        TEXT        NOT NULL,
    description TEXT,
    -- Vai trò hệ thống (3 actor: MANAGER, ACCOUNTANT, IT): không xóa, không đổi mã.
    is_system   BOOLEAN     NOT NULL DEFAULT FALSE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (tenant_id, id),
    UNIQUE (tenant_id, code)
);
CREATE TRIGGER trg_role_updated BEFORE UPDATE ON station.role FOR EACH ROW EXECUTE FUNCTION station.set_updated_at();

CREATE TABLE station.role_permission (
    role_id         UUID NOT NULL REFERENCES station.role (id) ON DELETE CASCADE,
    permission_code TEXT NOT NULL REFERENCES station.permission (code),
    PRIMARY KEY (role_id, permission_code)
);

CREATE TABLE station.app_user (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id          UUID        NOT NULL REFERENCES station.tenant (id),
    employee_code      TEXT        NOT NULL CHECK (employee_code ~ '^[A-Za-z0-9_-]{1,32}$'),
    full_name          TEXT        NOT NULL,
    email              TEXT        NOT NULL,
    phone              TEXT,
    username           TEXT        NOT NULL CHECK (username ~ '^[A-Za-z0-9._@-]{3,64}$'),
    password_hash      TEXT        NOT NULL,           -- Argon2id hoặc Bcrypt, không bao giờ lưu mật khẩu thường
    role_id            UUID        NOT NULL,
    status             TEXT        NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'locked')),
    must_change_password BOOLEAN   NOT NULL DEFAULT TRUE,
    failed_login_count INTEGER     NOT NULL DEFAULT 0,
    locked_until       TIMESTAMPTZ,                    -- khóa tạm do nhập sai quá số lần
    last_login_at      TIMESTAMPTZ,
    last_login_ip      INET,
    deleted_at         TIMESTAMPTZ,                    -- xóa mềm
    created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (tenant_id, id),
    FOREIGN KEY (tenant_id, role_id) REFERENCES station.role (tenant_id, id)
);
-- Tên đăng nhập, email, mã nhân viên duy nhất trong tenant, chỉ tính tài khoản chưa xóa.
CREATE UNIQUE INDEX ux_app_user_username ON station.app_user (tenant_id, lower(username)) WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX ux_app_user_email    ON station.app_user (tenant_id, lower(email))    WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX ux_app_user_code     ON station.app_user (tenant_id, employee_code)   WHERE deleted_at IS NULL;
CREATE INDEX ix_app_user_role ON station.app_user (tenant_id, role_id);
CREATE TRIGGER trg_app_user_updated BEFORE UPDATE ON station.app_user FOR EACH ROW EXECUTE FUNCTION station.set_updated_at();

-- Phạm vi dữ liệu: người dùng chỉ thấy và thao tác dữ liệu của các chi nhánh được gán.
CREATE TABLE station.user_branch (
    tenant_id UUID NOT NULL,
    user_id   UUID NOT NULL,
    branch_id UUID NOT NULL,
    PRIMARY KEY (user_id, branch_id),
    FOREIGN KEY (tenant_id, user_id)   REFERENCES station.app_user (tenant_id, id) ON DELETE CASCADE,
    FOREIGN KEY (tenant_id, branch_id) REFERENCES station.branch (tenant_id, id)
);

-- Phiên đăng nhập (refresh token). Chỉ lưu băm của token.
CREATE TABLE station.auth_session (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id   UUID        NOT NULL,
    user_id     UUID        NOT NULL,
    token_hash  TEXT        NOT NULL UNIQUE,
    remember_me BOOLEAN     NOT NULL DEFAULT FALSE,
    user_agent  TEXT,
    ip          INET,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at  TIMESTAMPTZ NOT NULL,
    revoked_at  TIMESTAMPTZ,
    FOREIGN KEY (tenant_id, user_id) REFERENCES station.app_user (tenant_id, id) ON DELETE CASCADE
);
CREATE INDEX ix_auth_session_user ON station.auth_session (user_id) WHERE revoked_at IS NULL;

-- Yêu cầu đặt lại mật khẩu (OTP hoặc link qua email). Chỉ lưu băm.
CREATE TABLE station.password_reset (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id  UUID        NOT NULL,
    user_id    UUID        NOT NULL,
    token_hash TEXT        NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at TIMESTAMPTZ NOT NULL,
    used_at    TIMESTAMPTZ,
    FOREIGN KEY (tenant_id, user_id) REFERENCES station.app_user (tenant_id, id) ON DELETE CASCADE
);

-- ---------------------------------------------------------------------------------------------------
-- Audit log: chỉ thêm, không sửa, không xóa (kể cả bởi ứng dụng)
-- ---------------------------------------------------------------------------------------------------

CREATE TABLE station.audit_log (
    id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    tenant_id    UUID        NOT NULL,
    occurred_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    actor_user_id UUID,                                -- NULL nếu hệ thống tự làm (ví dụ job, Edge Agent)
    actor_name   TEXT        NOT NULL,                 -- ảnh chụp tên lúc đó
    action       TEXT        NOT NULL CHECK (action IN ('create', 'update', 'delete', 'approve', 'reject', 'login', 'lock', 'unlock', 'export')),
    entity_type  TEXT        NOT NULL,                 -- ví dụ 'vehicle', 'stock_receipt'
    entity_id    UUID,
    entity_code  TEXT,
    old_data     JSONB,
    new_data     JSONB,
    ip           INET,
    request_id   TEXT
);
CREATE INDEX ix_audit_log_time   ON station.audit_log (tenant_id, occurred_at DESC);
CREATE INDEX ix_audit_log_entity ON station.audit_log (tenant_id, entity_type, entity_id);
CREATE INDEX ix_audit_log_actor  ON station.audit_log (tenant_id, actor_user_id, occurred_at DESC);

CREATE FUNCTION station.forbid_change() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    RAISE EXCEPTION 'bảng % chỉ được thêm, không được sửa hoặc xóa', TG_TABLE_NAME USING ERRCODE = 'restrict_violation';
END;
$$;
CREATE TRIGGER trg_audit_log_immutable BEFORE UPDATE OR DELETE ON station.audit_log FOR EACH ROW EXECUTE FUNCTION station.forbid_change();
CREATE TRIGGER trg_audit_log_no_truncate BEFORE TRUNCATE ON station.audit_log FOR EACH STATEMENT EXECUTE FUNCTION station.forbid_change();
