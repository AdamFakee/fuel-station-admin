-- 000009_seed_master_m5.down.sql
DELETE FROM station.credential WHERE external_id IN ('1001234567', '1001234568', '2001234567', '2001234568');
DELETE FROM station.vehicle WHERE code IN ('XE001', 'XE002');
DELETE FROM station.driver WHERE code IN ('TX001', 'TX002');
