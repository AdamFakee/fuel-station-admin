-- 000012_simplify_vehicle.up.sql
-- Đơn giản hóa xe: bỏ tuyến đường, đội nhóm phương tiện và dung tích bình chứa.
--   * Định mức chỉ còn áp theo XE (không còn theo nhóm xe hay tuyến đường, vì không còn nhóm hay tuyến).
--   * Thẻ NFC của xe bắt buộc: kiểm tra ở API khi tạo xe (thẻ nằm ở bảng credential nên DB không ép được).
-- LƯU Ý: các quy tắc định mức đang áp theo nhóm xe hoặc tuyến đường bị XÓA (không còn đối tượng để áp).

DELETE FROM station.quota_rule WHERE vehicle_id IS NULL;

-- Ràng buộc "đúng một đối tượng" và khóa ngoại tới nhóm, tuyến tự bị gỡ cùng các cột.
ALTER TABLE station.quota_rule DROP COLUMN vehicle_group_id;
ALTER TABLE station.quota_rule DROP COLUMN route_id;
ALTER TABLE station.quota_rule ALTER COLUMN vehicle_id SET NOT NULL;
DROP INDEX IF EXISTS station.ix_quota_vehicle;
CREATE INDEX ix_quota_vehicle ON station.quota_rule (tenant_id, vehicle_id);

ALTER TABLE station.vehicle DROP COLUMN route_id;
ALTER TABLE station.vehicle DROP COLUMN tank_capacity_ml;

DROP TABLE station.vehicle_group_member;
DROP TABLE station.vehicle_group;
DROP TABLE station.route;
