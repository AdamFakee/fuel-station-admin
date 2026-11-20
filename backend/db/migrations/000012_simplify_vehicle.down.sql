-- 000012_simplify_vehicle.down.sql
-- Dựng lại cấu trúc (bảng rỗng). Dữ liệu đã xóa (nhóm, tuyến, quy tắc định mức theo nhóm hoặc tuyến, dung tích bình) không khôi phục được.

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

CREATE TABLE station.vehicle_group_member (
    tenant_id  UUID NOT NULL,
    group_id   UUID NOT NULL,
    vehicle_id UUID NOT NULL,
    PRIMARY KEY (group_id, vehicle_id),
    FOREIGN KEY (tenant_id, group_id)   REFERENCES station.vehicle_group (tenant_id, id) ON DELETE CASCADE,
    FOREIGN KEY (tenant_id, vehicle_id) REFERENCES station.vehicle (tenant_id, id) ON DELETE CASCADE
);

ALTER TABLE station.vehicle ADD COLUMN tank_capacity_ml BIGINT CHECK (tank_capacity_ml > 0);
ALTER TABLE station.vehicle ADD COLUMN route_id UUID;
ALTER TABLE station.vehicle ADD FOREIGN KEY (tenant_id, route_id) REFERENCES station.route (tenant_id, id);

DROP INDEX IF EXISTS station.ix_quota_vehicle;
ALTER TABLE station.quota_rule ALTER COLUMN vehicle_id DROP NOT NULL;
ALTER TABLE station.quota_rule ADD COLUMN vehicle_group_id UUID;
ALTER TABLE station.quota_rule ADD COLUMN route_id UUID;
ALTER TABLE station.quota_rule ADD FOREIGN KEY (tenant_id, vehicle_group_id) REFERENCES station.vehicle_group (tenant_id, id);
ALTER TABLE station.quota_rule ADD FOREIGN KEY (tenant_id, route_id) REFERENCES station.route (tenant_id, id);
ALTER TABLE station.quota_rule ADD CHECK ((vehicle_id IS NOT NULL)::INT + (vehicle_group_id IS NOT NULL)::INT + (route_id IS NOT NULL)::INT = 1);
CREATE INDEX ix_quota_vehicle ON station.quota_rule (tenant_id, vehicle_id) WHERE vehicle_id IS NOT NULL;
