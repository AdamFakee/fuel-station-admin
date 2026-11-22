-- 000019_drop_user_branch.up.sql
-- Bỏ phạm vi dữ liệu theo trạm xăng cho tài khoản: mọi tài khoản đều thấy và thao tác dữ liệu toàn công ty
-- (theo quyền của vai trò). Xóa bảng gán trạm xăng cho tài khoản.
DROP TABLE IF EXISTS station.user_branch;
