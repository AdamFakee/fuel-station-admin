-- 000011_vehicle_store_scope.down.sql
-- Đảo ngược tốt nhất có thể: xe lấy lại một cửa hàng được phép làm chi nhánh; tài xế được gán chi nhánh đầu tiên của công ty và vị trí `driver`.

DROP INDEX IF EXISTS station.ux_dispense_sale;
CREATE UNIQUE INDEX ux_dispense_sale ON station.dispense_session (edge_station_id, sensor_serial, sale_seq) WHERE sale_seq IS NOT NULL;

DROP INDEX IF EXISTS station.ux_pump_sensor_com;
ALTER TABLE station.pump_sensor DROP CONSTRAINT IF EXISTS fk_pump_sensor_pump_branch;
ALTER TABLE station.pump_sensor DROP CONSTRAINT IF EXISTS ck_pump_sensor_name;
ALTER TABLE station.pump_sensor DROP COLUMN IF EXISTS name;
ALTER TABLE station.pump_sensor DROP COLUMN IF EXISTS branch_id;
ALTER TABLE station.pump DROP CONSTRAINT IF EXISTS uq_pump_tenant_id_branch;

ALTER TABLE station.driver ADD COLUMN position TEXT NOT NULL DEFAULT 'driver' CHECK (position IN ('driver', 'guard', 'operator'));
ALTER TABLE station.driver ADD COLUMN branch_id UUID;
UPDATE station.driver d SET branch_id = (
    SELECT b.id FROM station.branch b WHERE b.tenant_id = d.tenant_id ORDER BY b.created_at LIMIT 1
);
ALTER TABLE station.driver ALTER COLUMN branch_id SET NOT NULL;
ALTER TABLE station.driver ADD FOREIGN KEY (tenant_id, branch_id) REFERENCES station.branch (tenant_id, id);
CREATE INDEX ix_driver_branch ON station.driver (tenant_id, branch_id) WHERE deleted_at IS NULL;

ALTER TABLE station.vehicle ADD COLUMN branch_id UUID;
UPDATE station.vehicle v SET branch_id = (
    SELECT vb.branch_id FROM station.vehicle_branch vb WHERE vb.vehicle_id = v.id ORDER BY vb.created_at LIMIT 1
);
UPDATE station.vehicle v SET branch_id = (
    SELECT b.id FROM station.branch b WHERE b.tenant_id = v.tenant_id ORDER BY b.created_at LIMIT 1
) WHERE branch_id IS NULL;
ALTER TABLE station.vehicle ALTER COLUMN branch_id SET NOT NULL;
ALTER TABLE station.vehicle ADD FOREIGN KEY (tenant_id, branch_id) REFERENCES station.branch (tenant_id, id);
CREATE INDEX ix_vehicle_branch ON station.vehicle (tenant_id, branch_id) WHERE deleted_at IS NULL;

DROP TRIGGER IF EXISTS trg_vehicle_branch_touch ON station.vehicle_branch;
DROP FUNCTION IF EXISTS station.touch_vehicle_on_scope_change();
DROP TABLE IF EXISTS station.vehicle_branch;
