-- 000024_drop_vehicle_branch.down.sql
-- Tạo lại bảng, index, hàm và trigger như 000011. Dữ liệu cũ không khôi phục được: mỗi xe được phép ở MỌI trạm hiện có của công ty
-- (đúng hành vi sau khi bỏ tính năng).
CREATE TABLE station.vehicle_branch (
    tenant_id  UUID        NOT NULL,
    vehicle_id UUID        NOT NULL,
    branch_id  UUID        NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (vehicle_id, branch_id),
    FOREIGN KEY (tenant_id, vehicle_id) REFERENCES station.vehicle (tenant_id, id) ON DELETE CASCADE,
    FOREIGN KEY (tenant_id, branch_id)  REFERENCES station.branch (tenant_id, id)
);
CREATE INDEX ix_vehicle_branch_branch ON station.vehicle_branch (tenant_id, branch_id);

INSERT INTO station.vehicle_branch (tenant_id, vehicle_id, branch_id)
SELECT v.tenant_id, v.id, b.id
  FROM station.vehicle v
  JOIN station.branch b ON b.tenant_id = v.tenant_id;

CREATE FUNCTION station.touch_vehicle_on_scope_change() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    UPDATE station.vehicle
       SET updated_at = now()
     WHERE id = COALESCE(NEW.vehicle_id, OLD.vehicle_id)
       AND tenant_id = COALESCE(NEW.tenant_id, OLD.tenant_id);
    RETURN NULL;
END;
$$;
CREATE TRIGGER trg_vehicle_branch_touch AFTER INSERT OR DELETE ON station.vehicle_branch
    FOR EACH ROW EXECUTE FUNCTION station.touch_vehicle_on_scope_change();
