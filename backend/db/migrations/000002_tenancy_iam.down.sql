-- 000002_tenancy_iam.down.sql
DROP TABLE IF EXISTS station.audit_log CASCADE;
DROP FUNCTION IF EXISTS station.forbid_change();
DROP TABLE IF EXISTS station.password_reset CASCADE;
DROP TABLE IF EXISTS station.auth_session CASCADE;
DROP TABLE IF EXISTS station.user_branch CASCADE;
DROP TABLE IF EXISTS station.app_user CASCADE;
DROP TABLE IF EXISTS station.role_permission CASCADE;
DROP TABLE IF EXISTS station.role CASCADE;
DROP TABLE IF EXISTS station.permission CASCADE;
DROP TABLE IF EXISTS station.branch CASCADE;
DROP TABLE IF EXISTS station.tenant_setting CASCADE;
DROP TABLE IF EXISTS station.tenant CASCADE;
DROP FUNCTION IF EXISTS station.next_code(UUID, TEXT);
DROP TABLE IF EXISTS station.code_sequence CASCADE;
DROP FUNCTION IF EXISTS station.bump_version();
DROP FUNCTION IF EXISTS station.set_updated_at();
