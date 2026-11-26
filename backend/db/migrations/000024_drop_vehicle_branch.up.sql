-- 000024_drop_vehicle_branch.up.sql
-- Bỏ khái niệm "xe được phép đổ ở những trạm xăng nào": xe là dữ liệu cấp công ty, đổ được ở MỌI trạm (như tài xế).
-- Xóa trigger, hàm và bảng `vehicle_branch` (tạo ở 000011).
DROP TRIGGER IF EXISTS trg_vehicle_branch_touch ON station.vehicle_branch;
DROP FUNCTION IF EXISTS station.touch_vehicle_on_scope_change();
DROP TABLE IF EXISTS station.vehicle_branch;
