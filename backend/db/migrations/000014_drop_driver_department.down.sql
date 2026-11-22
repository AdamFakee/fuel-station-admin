-- 000014_drop_driver_department.down.sql
-- Dựng lại cột (rỗng). Dữ liệu phòng ban đã xóa không khôi phục được.
ALTER TABLE station.driver ADD COLUMN IF NOT EXISTS department TEXT;
