-- 000018_admin_role.down.sql
-- Gỡ vai trò ADMIN (chỉ gỡ được khi chưa có tài khoản nào dùng).
DELETE FROM station.role_permission WHERE role_id IN (SELECT id FROM station.role WHERE is_system AND code = 'ADMIN');
DELETE FROM station.role WHERE is_system AND code = 'ADMIN';
