-- 000010_seed_demo_m15.down.sql
DELETE FROM station.quota_rule WHERE code IN ('QR-DOI1-WEEK', 'QR-ROUTE1-DAY');
DELETE FROM station.access_terminal WHERE terminal_code IN ('T1', 'T2');
DELETE FROM station.pump_sensor WHERE com_port IN ('COM7', 'COM8');
DELETE FROM station.nozzle WHERE pump_id IN (SELECT id FROM station.pump WHERE code IN ('PUMP-01', 'PUMP-02'));
DELETE FROM station.pump WHERE code IN ('PUMP-01', 'PUMP-02');
DELETE FROM station.stock_ledger WHERE tank_id IN (SELECT id FROM station.tank WHERE code IN ('TK-DO-01', 'TK-DO-02', 'TK-A95-01'));
DELETE FROM station.tank WHERE code IN ('TK-DO-01', 'TK-DO-02', 'TK-A95-01');
DELETE FROM station.supplier WHERE code IN ('PETROLIMEX', 'PVOIL');
