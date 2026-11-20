-- 000004_edge_sync.down.sql
DROP TRIGGER IF EXISTS trg_sync_pump            ON station.pump;
DROP TRIGGER IF EXISTS trg_sync_pump_sensor     ON station.pump_sensor;
DROP TRIGGER IF EXISTS trg_sync_access_terminal ON station.access_terminal;
DROP TRIGGER IF EXISTS trg_sync_vehicle         ON station.vehicle;
DROP TRIGGER IF EXISTS trg_sync_driver          ON station.driver;
DROP TRIGGER IF EXISTS trg_sync_credential      ON station.credential;
DROP FUNCTION IF EXISTS station.log_sync_change();
DROP TABLE IF EXISTS station.sync_change_log CASCADE;
DROP TABLE IF EXISTS station.edge_station CASCADE;
