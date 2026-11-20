.PHONY: run test lint build db-test

run:
	go run ./cmd/api

test:
	go test -v ./...

lint:
	golangci-lint run

build:
	go build -o bin/api ./cmd/api

# Kiểm tra hành vi schema trên một DB tạm: dựng DB trống, áp mọi migration, chạy db/tests/schema_behaviour.sql, rồi xóa DB.
# Cần psql và Postgres chạy sẵn. Đổi kết nối bằng PGHOST, PGPORT, PGUSER, PGPASSWORD.
db-test:
	./db/tests/run.sh
