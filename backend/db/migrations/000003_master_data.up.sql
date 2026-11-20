-- 000003_master_data.up.sql
-- Danh mục: file đính kèm, loại nhiên liệu, bể chứa, trụ bơm và thiết bị, xe, tài xế, thẻ/mặt/vân tay, định mức.
--
-- Các bảng mà Edge Agent đồng bộ xuống trạm (pump, pump_sensor, access_terminal, vehicle, driver, credential) có
-- cột `version` tự tăng mỗi lần sửa và được ghi vào station.sync_change_log (migration 000004).

-- ---------------------------------------------------------------------------------------------------
-- File đính kèm (ảnh mặt, ảnh phiếu giao hàng, PDF). Nội dung nằm ở kho file; DB chỉ giữ tham chiếu.
-- ---------------------------------------------------------------------------------------------------
CREATE TABLE station.stored_file (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id    UUID        NOT NULL REFERENCES station.tenant (id),
    storage_key  TEXT        NOT NULL,                 -- đường dẫn trong kho file
    file_name    TEXT        NOT NULL,
    content_type TEXT        NOT NULL,
    size_bytes   BIGINT      NOT NULL CHECK (size_bytes >= 0),
    sha256       TEXT,
    created_by   UUID,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (tenant_id, id),
    UNIQUE (tenant_id, storage_key)
);

-- ---------------------------------------------------------------------------------------------------
-- Loại nhiên liệu, loại xe, nhóm xe, tuyến đường
-- ---------------------------------------------------------------------------------------------------
CREATE TABLE station.fuel_type (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id  UUID        NOT NULL REFERENCES station.tenant (id),
    code       TEXT        NOT NULL CHECK (code ~ '^[A-Za-z0-9_-]{1,32}$'),   -- ví dụ DO, A95
    name       TEXT        NOT NULL,                                          -- ví dụ Dầu DO, Xăng A95
    active     BOOLEAN     NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (tenant_id, id),
    UNIQUE (tenant_id, code)
);
CREATE TRIGGER trg_fuel_type_updated BEFORE UPDATE ON station.fuel_type FOR EACH ROW EXECUTE FUNCTION station.set_updated_at();

CREATE TABLE station.vehicle_type (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id  UUID        NOT NULL REFERENCES station.tenant (id),
    code       TEXT        NOT NULL CHECK (code ~ '^[A-Za-z0-9_-]{1,32}$'),
    name       TEXT        NOT NULL,                                          -- Xe tải, xe nâng, xe con...
    active     BOOLEAN     NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (tenant_id, id),
    UNIQUE (tenant_id, code)
);
CREATE TRIGGER trg_vehicle_type_updated BEFORE UPDATE ON station.vehicle_type FOR EACH ROW EXECUTE FUNCTION station.set_updated_at();

CREATE TABLE station.vehicle_group (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id  UUID        NOT NULL REFERENCES station.tenant (id),
    code       TEXT        NOT NULL CHECK (code ~ '^[A-Za-z0-9_-]{1,32}$'),
    name       TEXT        NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (tenant_id, id),
    UNIQUE (tenant_id, code)
);
CREATE TRIGGER trg_vehicle_group_updated BEFORE UPDATE ON station.vehicle_group FOR EACH ROW EXECUTE FUNCTION station.set_updated_at();

CREATE TABLE station.route (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id  UUID        NOT NULL REFERENCES station.tenant (id),
    code       TEXT        NOT NULL CHECK (code ~ '^[A-Za-z0-9_-]{1,32}$'),
    name       TEXT        NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (tenant_id, id),
    UNIQUE (tenant_id, code)
);
CREATE TRIGGER trg_route_updated BEFORE UPDATE ON station.route FOR EACH ROW EXECUTE FUNCTION station.set_updated_at();

-- ---------------------------------------------------------------------------------------------------
-- Bể chứa. Tồn kho KHÔNG lưu ở đây: tồn = số dư dòng mới nhất trong station.stock_ledger (migration 000006).
-- ---------------------------------------------------------------------------------------------------
CREATE TABLE station.tank (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id             UUID        NOT NULL,
    branch_id             UUID        NOT NULL,
    code                  TEXT        NOT NULL CHECK (code ~ '^[A-Za-z0-9_-]{1,32}$'),
    name                  TEXT        NOT NULL,
    fuel_type_id          UUID        NOT NULL,
    design_capacity_ml    BIGINT      NOT NULL CHECK (design_capacity_ml > 0),           -- dung tích thiết kế
    max_usable_capacity_ml BIGINT     NOT NULL CHECK (max_usable_capacity_ml > 0),       -- dung tích khả dụng tối đa
    low_stock_threshold_ml BIGINT     NOT NULL DEFAULT 0 CHECK (low_stock_threshold_ml >= 0),
    loss_tolerance_pct    NUMERIC(5,2) NOT NULL DEFAULT 0.5 CHECK (loss_tolerance_pct >= 0 AND loss_tolerance_pct <= 100),
    status                TEXT        NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (tenant_id, id),
    UNIQUE (tenant_id, code),
    CHECK (max_usable_capacity_ml <= design_capacity_ml),
    CHECK (low_stock_threshold_ml <= max_usable_capacity_ml),
    FOREIGN KEY (tenant_id, branch_id)    REFERENCES station.branch (tenant_id, id),
    FOREIGN KEY (tenant_id, fuel_type_id) REFERENCES station.fuel_type (tenant_id, id)
);
CREATE INDEX ix_tank_branch ON station.tank (tenant_id, branch_id);
CREATE TRIGGER trg_tank_updated BEFORE UPDATE ON station.tank FOR EACH ROW EXECUTE FUNCTION station.set_updated_at();

-- ---------------------------------------------------------------------------------------------------
-- Trụ bơm và thiết bị (khớp mô hình của Edge Agent: mỗi trụ có đúng một bộ số Montech và một máy chấm công)
-- ---------------------------------------------------------------------------------------------------
CREATE TABLE station.pump (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id  UUID        NOT NULL,
    branch_id  UUID        NOT NULL,
    code       TEXT        NOT NULL CHECK (code ~ '^[A-Za-z0-9_-]{1,32}$'),
    -- Mã số nguyên mà Edge Agent dùng (pump.id trong DB của trạm). Duy nhất trong chi nhánh, do server cấp.
    edge_pump_id BIGINT    NOT NULL CHECK (edge_pump_id > 0),
    name       TEXT        NOT NULL,
    note       TEXT,
    enabled    BOOLEAN     NOT NULL DEFAULT TRUE,
    version    BIGINT      NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (tenant_id, id),
    UNIQUE (tenant_id, code),
    UNIQUE (tenant_id, branch_id, edge_pump_id),
    FOREIGN KEY (tenant_id, branch_id) REFERENCES station.branch (tenant_id, id)
);
CREATE TRIGGER trg_pump_version BEFORE UPDATE ON station.pump FOR EACH ROW EXECUTE FUNCTION station.bump_version();

-- Vòi bơm: mỗi vòi xuất từ một bể. (Trụ hiện có một vòi; bảng cho phép nhiều vòi, mỗi vòi một bể.)
CREATE TABLE station.nozzle (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id  UUID        NOT NULL,
    pump_id    UUID        NOT NULL,
    nozzle_no  INTEGER     NOT NULL CHECK (nozzle_no > 0),
    tank_id    UUID        NOT NULL,
    status     TEXT        NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (tenant_id, id),
    UNIQUE (pump_id, nozzle_no),
    FOREIGN KEY (tenant_id, pump_id) REFERENCES station.pump (tenant_id, id) ON DELETE CASCADE,
    FOREIGN KEY (tenant_id, tank_id) REFERENCES station.tank (tenant_id, id)
);
CREATE INDEX ix_nozzle_tank ON station.nozzle (tenant_id, tank_id);
CREATE TRIGGER trg_nozzle_updated BEFORE UPDATE ON station.nozzle FOR EACH ROW EXECUTE FUNCTION station.set_updated_at();

-- Bộ số Montech của trụ (RS-485).
CREATE TABLE station.pump_sensor (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id  UUID        NOT NULL,
    pump_id    UUID        NOT NULL UNIQUE,            -- một trụ một bộ số
    serial     BIGINT      NOT NULL CHECK (serial BETWEEN 0 AND 4294967295),   -- serial 4 byte của bộ số (mặc định xuất xưởng 1234)
    com_port   TEXT        NOT NULL,                   -- cổng COM trên Mini PC, ví dụ COM7; mỗi trụ một cổng riêng
    baud       INTEGER     NOT NULL DEFAULT 9600 CHECK (baud > 0),
    version    BIGINT      NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (tenant_id, id),
    FOREIGN KEY (tenant_id, pump_id) REFERENCES station.pump (tenant_id, id) ON DELETE CASCADE
);
CREATE TRIGGER trg_pump_sensor_version BEFORE UPDATE ON station.pump_sensor FOR EACH ROW EXECUTE FUNCTION station.bump_version();

-- Máy chấm công Hikvision của trụ (ISAPI).
CREATE TABLE station.access_terminal (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id    UUID        NOT NULL,
    pump_id      UUID        NOT NULL UNIQUE,          -- một trụ một máy chấm công
    terminal_code TEXT       NOT NULL CHECK (terminal_code ~ '^[A-Za-z0-9_-]{1,32}$'),   -- mã máy, ví dụ T1
    host         TEXT        NOT NULL,                 -- IP hoặc tên máy
    port         INTEGER     NOT NULL DEFAULT 80 CHECK (port BETWEEN 1 AND 65535),
    https        BOOLEAN     NOT NULL DEFAULT FALSE,
    username     TEXT        NOT NULL,
    -- Mật khẩu máy được mã hóa ở tầng ứng dụng (AES-GCM, khóa từ biến môi trường); DB không bao giờ thấy mật khẩu thường.
    password_enc BYTEA       NOT NULL,
    version      BIGINT      NOT NULL DEFAULT 1,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (tenant_id, id),
    UNIQUE (tenant_id, terminal_code),
    FOREIGN KEY (tenant_id, pump_id) REFERENCES station.pump (tenant_id, id) ON DELETE CASCADE
);
CREATE TRIGGER trg_access_terminal_version BEFORE UPDATE ON station.access_terminal FOR EACH ROW EXECUTE FUNCTION station.bump_version();

-- ---------------------------------------------------------------------------------------------------
-- Xe
-- ---------------------------------------------------------------------------------------------------
CREATE TABLE station.vehicle (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id        UUID        NOT NULL,
    branch_id        UUID        NOT NULL,             -- đơn vị/nhà máy quản lý
    -- Mã xe: chính là employeeNo của "người giả" trên máy chấm công (chữ và số, tối đa 32 ký tự).
    code             TEXT        NOT NULL CHECK (code ~ '^[A-Za-z0-9]{1,32}$'),
    plate            TEXT        NOT NULL,             -- biển số
    vehicle_type_id  UUID,
    fuel_type_id     UUID        NOT NULL,
    route_id         UUID,
    tank_capacity_ml BIGINT      CHECK (tank_capacity_ml > 0),   -- dung tích bình chứa của xe
    status           TEXT        NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'banned')),
    note             TEXT,
    version          BIGINT      NOT NULL DEFAULT 1,
    deleted_at       TIMESTAMPTZ,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (tenant_id, id),
    FOREIGN KEY (tenant_id, branch_id)       REFERENCES station.branch (tenant_id, id),
    FOREIGN KEY (tenant_id, vehicle_type_id) REFERENCES station.vehicle_type (tenant_id, id),
    FOREIGN KEY (tenant_id, fuel_type_id)    REFERENCES station.fuel_type (tenant_id, id),
    FOREIGN KEY (tenant_id, route_id)        REFERENCES station.route (tenant_id, id)
);
CREATE UNIQUE INDEX ux_vehicle_code  ON station.vehicle (tenant_id, code)          WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX ux_vehicle_plate ON station.vehicle (tenant_id, upper(plate)) WHERE deleted_at IS NULL;
CREATE INDEX ix_vehicle_branch ON station.vehicle (tenant_id, branch_id) WHERE deleted_at IS NULL;
CREATE TRIGGER trg_vehicle_version BEFORE UPDATE ON station.vehicle FOR EACH ROW EXECUTE FUNCTION station.bump_version();

CREATE TABLE station.vehicle_group_member (
    tenant_id  UUID NOT NULL,
    group_id   UUID NOT NULL,
    vehicle_id UUID NOT NULL,
    PRIMARY KEY (group_id, vehicle_id),
    FOREIGN KEY (tenant_id, group_id)   REFERENCES station.vehicle_group (tenant_id, id) ON DELETE CASCADE,
    FOREIGN KEY (tenant_id, vehicle_id) REFERENCES station.vehicle (tenant_id, id) ON DELETE CASCADE
);

-- ---------------------------------------------------------------------------------------------------
-- Tài xế và nhân sự xác nhận
-- ---------------------------------------------------------------------------------------------------
CREATE TABLE station.driver (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id   UUID        NOT NULL,
    branch_id   UUID        NOT NULL,
    code        TEXT        NOT NULL CHECK (code ~ '^[A-Za-z0-9]{1,32}$'),   -- mã nhân viên = employeeNo trên máy chấm công
    full_name   TEXT        NOT NULL,
    phone       TEXT,
    department  TEXT,                                   -- bộ phận / đơn vị trực thuộc
    position    TEXT        NOT NULL DEFAULT 'driver' CHECK (position IN ('driver', 'guard', 'operator')),
    -- Khớp trạng thái của Edge Agent: active (đang làm việc), blocked (tạm khóa), inactive (nghỉ việc).
    status      TEXT        NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'blocked', 'inactive')),
    valid_from  TIMESTAMPTZ,
    valid_to    TIMESTAMPTZ,
    note        TEXT,
    version     BIGINT      NOT NULL DEFAULT 1,
    deleted_at  TIMESTAMPTZ,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (tenant_id, id),
    CHECK (valid_from IS NULL OR valid_to IS NULL OR valid_from < valid_to),
    FOREIGN KEY (tenant_id, branch_id) REFERENCES station.branch (tenant_id, id)
);
CREATE UNIQUE INDEX ux_driver_code ON station.driver (tenant_id, code) WHERE deleted_at IS NULL;
CREATE INDEX ix_driver_branch ON station.driver (tenant_id, branch_id) WHERE deleted_at IS NULL;
CREATE TRIGGER trg_driver_version BEFORE UPDATE ON station.driver FOR EACH ROW EXECUTE FUNCTION station.bump_version();

-- ---------------------------------------------------------------------------------------------------
-- Phương tiện xác thực: thẻ NFC (xe hoặc người), khuôn mặt, vân tay. Khớp bảng credential của Edge Agent.
-- ---------------------------------------------------------------------------------------------------
CREATE TABLE station.credential (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id    UUID        NOT NULL,
    vehicle_id   UUID,
    driver_id    UUID,
    method       TEXT        NOT NULL CHECK (method IN ('card', 'face', 'fingerprint')),
    -- card: số thẻ đúng dạng máy chấm công báo `cardNo` (thập phân, byte đầu là byte thấp: UID 79:7F:3B:E6 thành 3862658937).
    -- face, fingerprint: mã nhân viên của tài xế (driver.code).
    external_id  TEXT        NOT NULL,
    status       TEXT        NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'revoked')),
    face_file_id UUID,                                  -- ảnh mặt (chỉ method = 'face')
    biometric_template_id TEXT,                         -- mã mẫu sinh trắc học trên thiết bị (vân tay)
    version      BIGINT      NOT NULL DEFAULT 1,
    revoked_at   TIMESTAMPTZ,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (tenant_id, id),
    -- Đúng một chủ: xe hoặc tài xế.
    CHECK ((vehicle_id IS NOT NULL)::INT + (driver_id IS NOT NULL)::INT = 1),
    -- Nghiệp vụ: xe chỉ có thẻ NFC; tài xế có cả ba.
    CHECK (vehicle_id IS NULL OR method = 'card'),
    CHECK (face_file_id IS NULL OR method = 'face'),
    CHECK ((status = 'revoked') = (revoked_at IS NOT NULL)),
    FOREIGN KEY (tenant_id, vehicle_id)   REFERENCES station.vehicle (tenant_id, id),
    FOREIGN KEY (tenant_id, driver_id)    REFERENCES station.driver (tenant_id, id),
    FOREIGN KEY (tenant_id, face_file_id) REFERENCES station.stored_file (tenant_id, id)
);
-- Một mã số chỉ thuộc về một chủ đang hiệu lực.
CREATE UNIQUE INDEX ux_credential_active ON station.credential (tenant_id, method, external_id) WHERE status = 'active';
CREATE INDEX ix_credential_vehicle ON station.credential (tenant_id, vehicle_id) WHERE vehicle_id IS NOT NULL;
CREATE INDEX ix_credential_driver  ON station.credential (tenant_id, driver_id)  WHERE driver_id IS NOT NULL;
CREATE TRIGGER trg_credential_version BEFORE UPDATE ON station.credential FOR EACH ROW EXECUTE FUNCTION station.bump_version();

-- ---------------------------------------------------------------------------------------------------
-- Định mức nhiên liệu (theo LÍT; không có tiền)
-- ---------------------------------------------------------------------------------------------------
CREATE TABLE station.quota_rule (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id            UUID        NOT NULL,
    code                 TEXT        NOT NULL CHECK (code ~ '^[A-Za-z0-9_-]{1,32}$'),
    -- Đối tượng áp dụng: đúng một trong xe, nhóm xe, tuyến đường.
    vehicle_id           UUID,
    vehicle_group_id     UUID,
    route_id             UUID,
    period               TEXT        NOT NULL CHECK (period IN ('per_dispense', 'day', 'week', 'month')),
    max_volume_ml        BIGINT      NOT NULL CHECK (max_volume_ml > 0),
    min_interval_minutes INTEGER     NOT NULL DEFAULT 0 CHECK (min_interval_minutes >= 0),   -- giãn cách tối thiểu giữa hai lần bơm
    effective_from       DATE        NOT NULL,
    effective_to         DATE,
    status               TEXT        NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'cancelled')),
    created_by           UUID,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (tenant_id, id),
    UNIQUE (tenant_id, code),
    CHECK ((vehicle_id IS NOT NULL)::INT + (vehicle_group_id IS NOT NULL)::INT + (route_id IS NOT NULL)::INT = 1),
    CHECK (effective_to IS NULL OR effective_from <= effective_to),
    FOREIGN KEY (tenant_id, vehicle_id)       REFERENCES station.vehicle (tenant_id, id),
    FOREIGN KEY (tenant_id, vehicle_group_id) REFERENCES station.vehicle_group (tenant_id, id),
    FOREIGN KEY (tenant_id, route_id)         REFERENCES station.route (tenant_id, id)
);
CREATE INDEX ix_quota_vehicle ON station.quota_rule (tenant_id, vehicle_id) WHERE vehicle_id IS NOT NULL;
CREATE TRIGGER trg_quota_rule_updated BEFORE UPDATE ON station.quota_rule FOR EACH ROW EXECUTE FUNCTION station.set_updated_at();

-- Cấp bổ sung hạn mức đột xuất cho một xe trong một khoảng thời gian.
CREATE TABLE station.quota_extra (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id     UUID        NOT NULL,
    vehicle_id    UUID        NOT NULL,
    extra_volume_ml BIGINT    NOT NULL CHECK (extra_volume_ml > 0),
    valid_from    TIMESTAMPTZ NOT NULL,
    valid_to      TIMESTAMPTZ NOT NULL,
    reason        TEXT        NOT NULL,
    granted_by    UUID        NOT NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (valid_from < valid_to),
    FOREIGN KEY (tenant_id, vehicle_id) REFERENCES station.vehicle (tenant_id, id),
    FOREIGN KEY (tenant_id, granted_by) REFERENCES station.app_user (tenant_id, id)
);
CREATE INDEX ix_quota_extra_vehicle ON station.quota_extra (tenant_id, vehicle_id, valid_to);
