-- 000005_dispense.up.sql
-- Phiên đổ nhiên liệu và sự kiện xác thực do Edge Agent đẩy lên. Chỉ có LÍT, không có tiền.
--
-- Edge Agent gửi mỗi phiên với một khóa idempotency (edge_ref): gửi lại cùng edge_ref thì server nhận lại không tạo bản ghi mới.
-- Khi một phiên `completed` được nhận, ứng dụng ghi dòng xuất kho vào station.stock_ledger (migration 000006) CÙNG giao dịch.

CREATE TABLE station.dispense_session (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id      UUID        NOT NULL,
    branch_id      UUID        NOT NULL,
    edge_station_id UUID       NOT NULL,
    code           TEXT        NOT NULL,                -- mã giao dịch GD-2026-0001 (station.next_code)
    edge_ref       TEXT        NOT NULL,                -- khóa idempotency do trạm đặt
    pump_id        UUID        NOT NULL,
    nozzle_id      UUID,
    tank_id        UUID,                                -- bể xuất (suy từ vòi)
    fuel_type_id   UUID,
    vehicle_id     UUID,
    driver_id      UUID,
    -- Ảnh chụp lúc đổ: tên và biển số có thể đổi sau này nhưng giao dịch phải giữ nguyên.
    pump_name      TEXT        NOT NULL,
    vehicle_code   TEXT,
    vehicle_plate  TEXT,
    driver_code    TEXT,
    driver_name    TEXT,
    limit_ml       BIGINT      CHECK (limit_ml > 0),    -- hạn mức tối đa đã cấp phép lượt này
    paired_at      TIMESTAMPTZ,
    unlocked_at    TIMESTAMPTZ,
    started_at     TIMESTAMPTZ,
    finished_at    TIMESTAMPTZ,
    dispensed_ml   BIGINT      NOT NULL DEFAULT 0 CHECK (dispensed_ml >= 0),
    pump_total_ml  BIGINT      CHECK (pump_total_ml >= 0),   -- tổng tích lũy trên đồng hồ cột bơm sau lượt này (đối chiếu kiểm kê)
    sensor_serial  BIGINT,
    sale_seq       BIGINT,                              -- số thứ tự lần bơm do bộ số đánh
    raw_hex        TEXT,                                -- khung gốc của bộ số, để đối soát
    edge_state     TEXT        NOT NULL CHECK (edge_state IN ('completed', 'enable_failed', 'timed_out', 'aborted', 'cancelled')),
    -- Trạng thái nghiệp vụ của BRD: completed (Hoàn thành), cancelled (Đã hủy: timeout hoặc hủy), failed (Lỗi: mở khóa thất bại hoặc đứt giữa chừng).
    status         TEXT        NOT NULL CHECK (status IN ('completed', 'cancelled', 'failed')),
    received_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (tenant_id, id),
    UNIQUE (tenant_id, code),
    UNIQUE (edge_station_id, edge_ref),
    CHECK (status <> 'cancelled' OR dispensed_ml = 0),
    FOREIGN KEY (tenant_id, branch_id)       REFERENCES station.branch (tenant_id, id),
    FOREIGN KEY (tenant_id, edge_station_id) REFERENCES station.edge_station (tenant_id, id),
    FOREIGN KEY (tenant_id, pump_id)         REFERENCES station.pump (tenant_id, id),
    FOREIGN KEY (tenant_id, nozzle_id)       REFERENCES station.nozzle (tenant_id, id),
    FOREIGN KEY (tenant_id, tank_id)         REFERENCES station.tank (tenant_id, id),
    FOREIGN KEY (tenant_id, fuel_type_id)    REFERENCES station.fuel_type (tenant_id, id),
    FOREIGN KEY (tenant_id, vehicle_id)      REFERENCES station.vehicle (tenant_id, id),
    FOREIGN KEY (tenant_id, driver_id)       REFERENCES station.driver (tenant_id, id)
);
-- Một lần bơm của một bộ số chỉ được ghi một lần.
CREATE UNIQUE INDEX ux_dispense_sale ON station.dispense_session (edge_station_id, sensor_serial, sale_seq) WHERE sale_seq IS NOT NULL;
CREATE INDEX ix_dispense_time    ON station.dispense_session (tenant_id, branch_id, COALESCE(finished_at, received_at) DESC);
CREATE INDEX ix_dispense_vehicle ON station.dispense_session (tenant_id, vehicle_id, finished_at DESC) WHERE vehicle_id IS NOT NULL;
CREATE INDEX ix_dispense_driver  ON station.dispense_session (tenant_id, driver_id, finished_at DESC)  WHERE driver_id IS NOT NULL;
CREATE INDEX ix_dispense_tank    ON station.dispense_session (tenant_id, tank_id, finished_at DESC)    WHERE tank_id IS NOT NULL;

-- Dòng thời gian trạng thái của một phiên (paired, unlocking, ready, pumping, completed...).
CREATE TABLE station.dispense_session_event (
    id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    tenant_id   UUID        NOT NULL,
    session_id  UUID        NOT NULL,
    from_state  TEXT,
    to_state    TEXT        NOT NULL,
    occurred_at TIMESTAMPTZ NOT NULL,
    FOREIGN KEY (tenant_id, session_id) REFERENCES station.dispense_session (tenant_id, id) ON DELETE CASCADE
);
CREATE INDEX ix_dispense_session_event ON station.dispense_session_event (session_id, occurred_at);

-- Mọi lượt quẹt, kể cả bị từ chối (BRD: "Bị từ chối kèm mã lỗi và thời điểm"). Khớp auth_log của Edge Agent.
CREATE TABLE station.access_event (
    id             BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    tenant_id      UUID        NOT NULL,
    branch_id      UUID        NOT NULL,
    edge_station_id UUID       NOT NULL,
    edge_ref       TEXT        NOT NULL,                -- khóa idempotency do trạm đặt
    occurred_at    TIMESTAMPTZ NOT NULL,
    kind           TEXT        NOT NULL,                -- credential, pair_formed, pair_expired, unlock_requested, unlock_ok, unlock_failed...
    pump_id        UUID,
    method         TEXT        CHECK (method IN ('card', 'face', 'fingerprint')),
    external_id    TEXT,
    vehicle_id     UUID,
    driver_id      UUID,
    party_name     TEXT,
    decision       TEXT        CHECK (decision IN ('accept', 'reject')),
    reason         TEXT,                                -- Unknown, WrongKind, Blocked, Expired, ...
    session_id     UUID,
    detail         JSONB,
    received_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (edge_station_id, edge_ref),
    FOREIGN KEY (tenant_id, branch_id)       REFERENCES station.branch (tenant_id, id),
    FOREIGN KEY (tenant_id, edge_station_id) REFERENCES station.edge_station (tenant_id, id),
    FOREIGN KEY (tenant_id, pump_id)         REFERENCES station.pump (tenant_id, id),
    FOREIGN KEY (tenant_id, session_id)      REFERENCES station.dispense_session (tenant_id, id)
);
CREATE INDEX ix_access_event_time   ON station.access_event (tenant_id, branch_id, occurred_at DESC);
CREATE INDEX ix_access_event_reject ON station.access_event (tenant_id, occurred_at DESC) WHERE decision = 'reject';
