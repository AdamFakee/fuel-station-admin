-- 000004_edge_sync.up.sql
-- Trạm (Edge Agent) và đồng bộ: danh mục xuống trạm theo cursor, giao dịch và trạng thái từ trạm lên.

-- Trạm Edge Agent: mỗi chi nhánh có tối đa một Mini PC chạy Edge Agent.
CREATE TABLE station.edge_station (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id     UUID        NOT NULL,
    branch_id     UUID        NOT NULL UNIQUE,
    code          TEXT        NOT NULL CHECK (code ~ '^[A-Za-z0-9_-]{1,32}$'),   -- mã trạm trong edge.conf (station_id)
    name          TEXT        NOT NULL,
    -- Băm của khóa API do Edge Agent gửi kèm. Đặt lúc triển khai (CLI hoặc seed), KHÔNG có màn hình cấp hay thu hồi trong admin.
    api_key_hash  TEXT        UNIQUE,
    status        TEXT        NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    -- Do Edge Agent báo mỗi lần heartbeat hoặc đồng bộ.
    last_seen_at  TIMESTAMPTZ,
    last_sync_at  TIMESTAMPTZ,
    pending_queue INTEGER     NOT NULL DEFAULT 0 CHECK (pending_queue >= 0),    -- số bản ghi trạm còn chờ đẩy lên
    agent_version TEXT,
    last_error    TEXT,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (tenant_id, id),
    UNIQUE (tenant_id, code),
    FOREIGN KEY (tenant_id, branch_id) REFERENCES station.branch (tenant_id, id)
);
CREATE TRIGGER trg_edge_station_updated BEFORE UPDATE ON station.edge_station FOR EACH ROW EXECUTE FUNCTION station.set_updated_at();

-- Nhật ký thay đổi danh mục. `seq` tăng đơn điệu toàn cục: cursor của Edge Agent là seq lớn nhất đã nhận.
-- Trạm kéo: `WHERE seq > $cursor`, rồi lọc các thực thể thuộc chi nhánh của trạm.
CREATE TABLE station.sync_change_log (
    seq         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    tenant_id   UUID        NOT NULL,
    entity_type TEXT        NOT NULL CHECK (entity_type IN ('pump', 'pump_sensor', 'access_terminal', 'vehicle', 'driver', 'credential')),
    entity_id   UUID        NOT NULL,
    version     BIGINT      NOT NULL,
    deleted     BOOLEAN     NOT NULL DEFAULT FALSE,
    changed_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ix_sync_change_log_tenant ON station.sync_change_log (tenant_id, seq);
CREATE INDEX ix_sync_change_log_entity ON station.sync_change_log (entity_type, entity_id);

-- Ghi một dòng vào nhật ký mỗi khi thực thể đồng bộ thay đổi. Xóa mềm (deleted_at) hoặc xóa cứng đều thành deleted = true.
CREATE FUNCTION station.log_sync_change() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
    r        JSONB;
    v_deleted BOOLEAN;
BEGIN
    IF TG_OP = 'DELETE' THEN
        r := to_jsonb(OLD);
        v_deleted := TRUE;
    ELSE
        r := to_jsonb(NEW);
        v_deleted := (r ->> 'deleted_at') IS NOT NULL;
    END IF;
    INSERT INTO station.sync_change_log (tenant_id, entity_type, entity_id, version, deleted)
    VALUES ((r ->> 'tenant_id')::UUID, TG_ARGV[0], (r ->> 'id')::UUID, COALESCE((r ->> 'version')::BIGINT, 0), v_deleted);
    RETURN NULL;
END;
$$;

CREATE TRIGGER trg_sync_pump            AFTER INSERT OR UPDATE OR DELETE ON station.pump            FOR EACH ROW EXECUTE FUNCTION station.log_sync_change('pump');
CREATE TRIGGER trg_sync_pump_sensor     AFTER INSERT OR UPDATE OR DELETE ON station.pump_sensor     FOR EACH ROW EXECUTE FUNCTION station.log_sync_change('pump_sensor');
CREATE TRIGGER trg_sync_access_terminal AFTER INSERT OR UPDATE OR DELETE ON station.access_terminal FOR EACH ROW EXECUTE FUNCTION station.log_sync_change('access_terminal');
CREATE TRIGGER trg_sync_vehicle         AFTER INSERT OR UPDATE OR DELETE ON station.vehicle         FOR EACH ROW EXECUTE FUNCTION station.log_sync_change('vehicle');
CREATE TRIGGER trg_sync_driver          AFTER INSERT OR UPDATE OR DELETE ON station.driver          FOR EACH ROW EXECUTE FUNCTION station.log_sync_change('driver');
CREATE TRIGGER trg_sync_credential      AFTER INSERT OR UPDATE OR DELETE ON station.credential      FOR EACH ROW EXECUTE FUNCTION station.log_sync_change('credential');

-- Trụ thuộc trạm Edge nào: suy ra từ chi nhánh của trụ (pump.branch_id = edge_station.branch_id), không cần cột riêng.
