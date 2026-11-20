-- 000006_inventory.down.sql
DROP TABLE IF EXISTS station.notification_outbox CASCADE;
DROP TABLE IF EXISTS station.alert CASCADE;
DROP TABLE IF EXISTS station.stock_reconciliation CASCADE;
DROP TABLE IF EXISTS station.stock_issue CASCADE;
DROP TABLE IF EXISTS station.stock_receipt_attachment CASCADE;
DROP TABLE IF EXISTS station.stock_receipt_line CASCADE;
DROP FUNCTION IF EXISTS station.check_receipt_line_fuel();
DROP TABLE IF EXISTS station.stock_receipt CASCADE;
DROP FUNCTION IF EXISTS station.guard_document();
DROP VIEW IF EXISTS station.tank_stock;
DROP TABLE IF EXISTS station.stock_ledger CASCADE;
DROP FUNCTION IF EXISTS station.stock_ledger_before_insert();
DROP TABLE IF EXISTS station.supplier CASCADE;
