#!/usr/bin/env bash
# Dựng DB tạm, áp mọi migration *.up.sql theo thứ tự, chạy kiểm tra hành vi, rồi xóa DB tạm.
set -euo pipefail
cd "$(dirname "$0")/.."

export PGHOST="${PGHOST:-localhost}" PGPORT="${PGPORT:-5432}" PGUSER="${PGUSER:-postgres}" PGPASSWORD="${PGPASSWORD:-postgres}"
DB="fuel_schema_test_$$"

cleanup() { psql -d postgres -qc "DROP DATABASE IF EXISTS ${DB}" >/dev/null 2>&1 || true; }
trap cleanup EXIT

psql -d postgres -qc "CREATE DATABASE ${DB}"
for f in migrations/*.up.sql; do
    echo "== ${f}"
    psql -d "${DB}" -v ON_ERROR_STOP=1 -q -f "${f}"
done
psql -d "${DB}" -v ON_ERROR_STOP=1 -qt -f tests/schema_behaviour.sql 2>&1 | grep -E "NOTICE|ERROR|FAIL" | sed 's/^psql:[^ ]* //'

# Thử luôn chiều đi xuống rồi đi lên lại, để migration down không hỏng.
for f in $(ls migrations/*.down.sql | sort -r | grep -v 000001); do psql -d "${DB}" -v ON_ERROR_STOP=1 -q -f "${f}"; done
for f in $(ls migrations/*.up.sql | grep -v 000001); do psql -d "${DB}" -v ON_ERROR_STOP=1 -q -f "${f}"; done
echo "== down rồi up lại: đạt"
