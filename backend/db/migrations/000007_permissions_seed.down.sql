-- 000007_permissions_seed.down.sql
DROP FUNCTION IF EXISTS station.seed_tenant_defaults(UUID);
DELETE FROM station.role_permission;
DELETE FROM station.permission;
