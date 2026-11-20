-- 000008_seed_initial_tenant.down.sql
DELETE FROM station.tenant WHERE code = 'CTY-01';
