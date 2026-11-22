-- 000015_drop_quota.up.sql
-- Bỏ tính năng định mức nhiên liệu: mọi tài xế và xe đều đổ không giới hạn.
-- Xóa bảng định mức và quyền `master.quota:*` (kể cả khỏi các vai trò đã gán).
DELETE FROM station.role_permission WHERE permission_code LIKE 'master.quota:%';
DELETE FROM station.permission WHERE code LIKE 'master.quota:%';
DROP TABLE IF EXISTS station.quota_extra;
DROP TABLE IF EXISTS station.quota_rule;
