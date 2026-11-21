-- Xóa toàn bộ dữ liệu của môi trường PHÁT TRIỂN (giữ danh mục quyền station.permission).
-- Sổ kho / nhật ký là bảng chỉ-thêm nên phải tắt trigger trong phiên này.
--   psql -h localhost -U postgres -d fuel_station_db -f backend/scripts/reset_dev_data.sql
-- Sau đó: go run ./cmd/seed  ->  khởi động backend  ->  python backend/scripts/seed_operational.py
BEGIN;
SET LOCAL session_replication_role = replica;
DO $$
DECLARE tbls text;
BEGIN
  SELECT string_agg(format('station.%I', t.table_name), ', ')
    INTO tbls
    FROM information_schema.tables t
   WHERE t.table_schema = 'station' AND t.table_type = 'BASE TABLE'
     AND t.table_name <> 'permission'
     AND (t.table_name IN ('tenant', 'role_permission')
          OR EXISTS (SELECT 1 FROM information_schema.columns c
                      WHERE c.table_schema = 'station' AND c.table_name = t.table_name AND c.column_name = 'tenant_id'));
  EXECUTE 'TRUNCATE ' || tbls || ' RESTART IDENTITY CASCADE';
END $$;
COMMIT;
