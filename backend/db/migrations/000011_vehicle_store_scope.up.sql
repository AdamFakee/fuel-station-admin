-- 000011_vehicle_store_scope.up.sql
-- Phạm vi cửa hàng theo XE (không theo tài xế):
--   * Xe nhiều-nhiều cửa hàng được phép (`vehicle_branch`): được đổ ở cửa hàng A, không được ở B. Không có dòng nào thì xe không được đổ ở đâu cả.
--   * Bỏ `vehicle.branch_id` ("đơn vị quản lý"): cửa hàng của xe chính là danh sách được phép.
--   * Tài xế là dữ liệu cấp công ty, lái được mọi xe: bỏ `driver.branch_id` và `driver.position` (không còn nhân viên vận hành, bảo vệ).
--   * Mỗi trụ một cổng COM: cổng COM duy nhất trong một cửa hàng. Serial KHÔNG cần duy nhất (là địa chỉ trong khung RS-485 của từng bộ số,
--     mỗi bộ số trên một cổng riêng nên có thể cùng là 1234). Bộ số có thêm tên để người dùng dễ phân biệt.
--   * Một lần bơm được nhận diện theo (trụ, số thứ tự lần bơm) thay vì (serial, số thứ tự), vì serial có thể trùng giữa các trụ.

-- ---------------------------------------------------------------------------------------------------
-- 1. Xe và cửa hàng được phép
-- ---------------------------------------------------------------------------------------------------
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

-- Dữ liệu cũ: mỗi xe được phép ở chi nhánh mà nó đang thuộc về.
INSERT INTO station.vehicle_branch (tenant_id, vehicle_id, branch_id)
SELECT tenant_id, id, branch_id FROM station.vehicle;

-- Đổi danh sách cửa hàng của xe cũng là một thay đổi của xe: tăng `version` và ghi nhật ký đồng bộ để Edge Agent kéo lại
-- (cờ "được phép ở cửa hàng này" của xe đổi theo).
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

ALTER TABLE station.vehicle DROP COLUMN branch_id;

-- ---------------------------------------------------------------------------------------------------
-- 2. Tài xế: cấp công ty, không vị trí
-- ---------------------------------------------------------------------------------------------------
ALTER TABLE station.driver DROP COLUMN branch_id;
ALTER TABLE station.driver DROP COLUMN position;

-- ---------------------------------------------------------------------------------------------------
-- 3. Bộ số: tên, cổng COM duy nhất trong cửa hàng
-- ---------------------------------------------------------------------------------------------------
ALTER TABLE station.pump ADD CONSTRAINT uq_pump_tenant_id_branch UNIQUE (tenant_id, id, branch_id);

ALTER TABLE station.pump_sensor ADD COLUMN branch_id UUID;
ALTER TABLE station.pump_sensor ADD COLUMN name TEXT;
UPDATE station.pump_sensor s SET branch_id = p.branch_id, name = 'BS-' || p.code
  FROM station.pump p WHERE p.id = s.pump_id AND p.tenant_id = s.tenant_id;
ALTER TABLE station.pump_sensor ALTER COLUMN branch_id SET NOT NULL;
ALTER TABLE station.pump_sensor ALTER COLUMN name SET NOT NULL;
ALTER TABLE station.pump_sensor ADD CONSTRAINT ck_pump_sensor_name CHECK (length(btrim(name)) > 0);
-- Bộ số luôn thuộc đúng cửa hàng của trụ (FK ghép).
ALTER TABLE station.pump_sensor
    ADD CONSTRAINT fk_pump_sensor_pump_branch FOREIGN KEY (tenant_id, pump_id, branch_id)
    REFERENCES station.pump (tenant_id, id, branch_id) ON DELETE CASCADE;

DO $$
DECLARE
    v_dup TEXT;
BEGIN
    SELECT string_agg(branch_id::TEXT || ' ' || com, '; ') INTO v_dup FROM (
        SELECT branch_id, upper(com_port) AS com FROM station.pump_sensor
         GROUP BY branch_id, upper(com_port) HAVING count(*) > 1
    ) d;
    IF v_dup IS NOT NULL THEN
        RAISE EXCEPTION 'Có trụ dùng chung một cổng COM trong cùng cửa hàng (mỗi trụ phải một cổng riêng). Sửa trước rồi chạy lại: %', v_dup
            USING ERRCODE = 'unique_violation';
    END IF;
END;
$$;
CREATE UNIQUE INDEX ux_pump_sensor_com ON station.pump_sensor (branch_id, upper(com_port));

-- ---------------------------------------------------------------------------------------------------
-- 4. Một lần bơm nhận diện theo (trụ, số thứ tự), không theo serial
-- ---------------------------------------------------------------------------------------------------
DROP INDEX station.ux_dispense_sale;
CREATE UNIQUE INDEX ux_dispense_sale ON station.dispense_session (edge_station_id, pump_id, sale_seq) WHERE sale_seq IS NOT NULL;
