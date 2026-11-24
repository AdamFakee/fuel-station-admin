-- 000021_edge_key_hint.down.sql
ALTER TABLE station.edge_station DROP COLUMN IF EXISTS api_key_hint;
