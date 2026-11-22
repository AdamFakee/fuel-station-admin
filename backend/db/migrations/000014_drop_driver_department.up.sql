-- 000014_drop_driver_department.up.sql
-- Bỏ "phòng ban / đội xe" của tài xế: không dùng ở đâu (edge không nhận, báo cáo không lọc theo nó).
ALTER TABLE station.driver DROP COLUMN IF EXISTS department;
