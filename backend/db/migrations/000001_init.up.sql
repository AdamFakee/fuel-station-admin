-- 000001_init.up.sql
-- Base initialization: extensions & helper schema

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Tạo schema nghiệp vụ
CREATE SCHEMA IF NOT EXISTS station;
