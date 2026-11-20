# FUEL STATION ADMIN - STARTER BASE

> **Khung kiến trúc Base chuẩn hoá (Clean Starter Kit)** cho hệ thống Quản lý Trạm Xăng (Fuel Station Admin), kết hợp giữa **Golang Modular Monolith** và **Next.js 15 App Router**.

---

## 🏛️ Kiến Trúc Tổng Quan

Dự án được phân tách rõ ràng thành hai phần độc lập:

1. **`backend/` (Golang Core)**:
   - **Mô hình**: Modular Monolith phân tầng (Clean Architecture).
   - **Router**: `go-chi/chi/v5` nhẹ và hiệu năng cao.
   - **Data Access**: `jackc/pgx/v5` (`pgxpool`) kết hợp Transaction Manager an toàn (`tx`).
   - **Migration**: Tự động nhúng và thực thi qua `golang-migrate` (`db/migrations/embed.go`).
   - **Error Handling**: Sentinel Domain Errors (`apperr`) ánh xạ trực tiếp sang mã HTTP chuẩn (`httpx`).
   - **Logging**: Thư viện chuẩn `log/slog` (JSON cho Production, Text cho Development).
   - **Bảo mật P0**: Multi-Tenant Isolation bắt buộc, Định danh kép (UUID `id` vs Mã `code`), An toàn tiền tệ (`int64` / Decimal).

2. **`admin/` (Next.js 15 App Router)**:
   - **Giao diện**: Next.js 15, React 19, Tailwind CSS v4.
   - **Design System**: Bộ màu Brand xanh xám chuyên nghiệp định nghĩa tại `src/app/globals.css`.
   - **UI Primitives**: Đầy đủ 30+ components Radix UI / Shadcn UI trong `src/components/ui/`.
   - **Layout Shell**: `AdminShell` và `AppSidebar` chuẩn UX admin, collapsible sidebar, responsive.
   - **Data Fetching**: TanStack Query v5, Axios interceptor, hỗ trợ Server-side cookie session.
   - **Quy tắc 1 File = 1 API**: Đóng gói Zod Schema, Fetcher, QueryKey và Hook trong cùng 1 file.

3. **Rules & Skills (`.agents/skills/`, `AGENTS.md`)**:
   - Đồng bộ đầy đủ 10 skills nội bộ: `admin-table-format`, `architect`, `codebase-design`, `confirm-dialog`, `fe-detail-page`, `fe-dialog-form`, `search-api`, `vercel-react-best-practices`, ...

---

## 📂 Cấu Trúc Thư Mục

```text
fuel-statiton-admin/
├── .agents/                    # Bộ quy tắc và skills dành cho AI Agent
│   └── skills/
├── admin/                      # Frontend Next.js 15 App Router
│   ├── public/
│   ├── src/
│   │   ├── app/                # Root layout, globals.css (màu chuẩn), pages
│   │   ├── components/         # admin-shell, app-sidebar, paginator, select, ...
│   │   │   └── ui/             # 30+ UI primitives (button, card, dialog, sheet, ...)
│   │   ├── features/           # Feature-sliced modules (1 file = 1 api)
│   │   ├── hooks/              # use-debounce, use-mobile, use-virtual-table, ...
│   │   ├── lib/                # utils (cn), axios, format, unaccent, clipboard
│   │   ├── services/           # api helpers
│   │   └── types/              # common types
│   ├── AGENTS.md               # Quy tắc phát triển Frontend
│   └── package.json
├── backend/                    # Backend Golang Modular Monolith
│   ├── cmd/
│   │   └── api/                # Main entrypoint
│   ├── db/
│   │   └── migrations/         # SQL Migrations
│   ├── internal/
│   │   ├── app/                # Composition Root (Dependency Injection)
│   │   ├── config/             # Config loader (env)
│   │   ├── modules/            # Thư mục chứa các module nghiệp vụ
│   │   ├── platform/           # logger (slog), postgres (pgxpool, migrator)
│   │   └── shared/             # apperr, authz, httpx, middleware, tx
│   ├── AGENTS.md               # Quy tắc phát triển Backend
│   └── go.mod
├── AGENTS.md                   # Master Router toàn bộ Workspace
├── docker-compose.yml          # Triển khai trọn bộ Postgres + Backend + Frontend
└── README.md
```

---

## ⚡ Hướng Dẫn Bắt Đầu Nhanh

### 1. Chạy với Docker Compose
```bash
docker-compose up -d
```
- Frontend Admin: [http://localhost:3000](http://localhost:3000)
- Backend API: [http://localhost:8080](http://localhost:8080)
- Health Check: [http://localhost:8080/healthz](http://localhost:8080/healthz)
- API Ping: [http://localhost:8080/v1/ping](http://localhost:8080/v1/ping)

### 2. Chạy Cục Bộ (Local Development)

#### Backend:
```bash
cd backend
go mod tidy
go run ./cmd/api
```

#### Frontend:
```bash
cd admin
npm install
npm run dev
```

---

## 💡 Hướng Dẫn Tạo Module Mới

### Bước 1: Tạo Module Backend (`backend/internal/modules/<tên_module>`)
1. Tạo 4 file chuẩn:
   - `model.go`: Khai báo struct thực thể dữ liệu và DTO.
   - `repository.go`: Interface và triển khai SQL thuần với `pgxpool`.
   - `service.go`: Xử lý logic nghiệp vụ và validation.
   - `handler.go`: Định nghĩa route và xử lý HTTP request/response qua `httpx`.
2. Đăng ký module trong `backend/internal/app/app.go`.

### Bước 2: Tạo Feature Frontend (`admin/src/features/<tên_feature>`)
1. `api/`: Viết các file API theo chuẩn 1 file = 1 endpoint (Schema Zod + QueryKey + Fetcher + useQuery Hook).
2. `components/`: Xây dựng Bảng dữ liệu, Dialog tạo mới/chỉnh sửa, Sheet xem chi tiết dựa trên các UI primitives có sẵn trong `@/components/ui/`.
3. Khai báo route trong `admin/src/app/<tên_feature>/page.tsx`.
