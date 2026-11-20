# Backend Golang - Modular Monolith Base

Dịch vụ Backend viết bằng **Golang**, tuân thủ kiến trúc **Modular Monolith**, hiệu năng cao với **Chi router**, **pgxpool (PostgreSQL)**, **slog (Structured Logging)** và **golang-migrate**.

## 🏗️ Cấu trúc thư mục chuẩn

```text
backend/
├── cmd/
│   └── api/
│       └── main.go         # Entry point, đọc config & lắng nghe graceful shutdown
├── db/
│   └── migrations/         # SQL Migrations tự động chạy khi khởi động (embed.go)
├── internal/
│   ├── app/
│   │   └── app.go          # Composition Root: Dependency Injection, Router, Middleware
│   ├── config/             # Config loader đọc từ Environment Variables (fail-fast)
│   ├── modules/            # Các module nghiệp vụ phân rã độc lập (Domain Modules)
│   ├── platform/
│   │   ├── logger/         # Structured logger JSON (prod) / Text (dev)
│   │   └── postgres/       # pgxpool connection pool, migrator & Transaction Manager
│   └── shared/
│       ├── apperr/         # Sentinel domain errors (ErrNotFound, ErrInvalidInput, ...)
│       ├── authz/          # Principal & permission checks
│       ├── httpx/          # JSON helpers & HTTP error mapping
│       ├── middleware/     # CORS, RequestID, Logger, Panic Recovery, Multi-tenant
│       └── tx/             # Transaction Manager thống nhất
```

## 🚀 Khởi chạy Backend

```bash
# Cài đặt / cập nhật dependencies
go mod tidy

# Chạy trực tiếp
go run ./cmd/api

# Hoặc dùng Makefile
make run
```
Mặc định lắng nghe tại: [http://localhost:8080](http://localhost:8080)
- Liveness probe: `GET /healthz`
- Readiness probe: `GET /readyz`
- Ping test: `GET /v1/ping`
