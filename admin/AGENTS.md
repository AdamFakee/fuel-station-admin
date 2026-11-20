# QUY TẮC KIẾN TRÚC & QUY CHUẨN FRONTEND ADMIN (FRONTEND AGENT RULES)

> **Dành cho Agent/Developer**: Tài liệu hướng dẫn độc lập cho dự án **Next.js Admin Frontend (`admin`)**.

---

## 0. QUẢN LÝ CONTEXT & TRA CỨU NHANH (ON-DEMAND ROUTER)

| Nhiệm vụ / Tình huống | File Cần Đọc (`view_file`) | Mục đích & Nội dung chính |
|---|---|---|
| 🏗️ **Tổng quan Kiến trúc Admin UI** | `README.md` | Phân tầng `src/app`, `src/features`, `src/components`, `src/lib` |
| 🔌 **Chuẩn 1 File = 1 API Endpoint** | `src/features/` | Quy chuẩn viết Zod Schema, Fetcher, QueryKey & Hook |
| 📊 **Admin Table Format** | `../.agents/skills/admin-table-format/SKILL.md` | Hướng dẫn định dạng & layout Bảng dữ liệu Admin |
| 📄 **Thiết Kế Trang Detail** | `../.agents/skills/fe-detail-page/SKILL.md` | Hướng dẫn xây dựng màn hình chi tiết (Detail Page) |
| 📝 **Thiết Kế Dialog Form** | `../.agents/skills/fe-dialog-form/SKILL.md` | Hướng dẫn thiết kế Form dạng Modal Dialog |
| ❓ **Hộp Thoại Xóa & Confirm** | `../.agents/skills/confirm-dialog/SKILL.md` | Hướng dẫn tạo Confirm Dialog chuẩn UX |
| 🚀 **Vercel React Best Practices** | `../.agents/skills/vercel-react-best-practices/SKILL.md` | Tối ưu hiệu năng React & Next.js App Router |
| 🎨 **Design System & Utilities** | `src/lib/utils.ts` | Helper `cn(...)` (clsx + tailwind-merge) |

---

## 1. NGUYÊN LÝ CỐT LÕI (NON-NEGOTIABLE CONVENTIONS)

### 🔴 1. Tách Biệt Ranh Giới (Feature-Driven Architecture)
* **`src/app/`**: Chỉ bọc Page/Layout & Providers. **KHÔNG** chứa business logic hay API fetcher rải rác.
* **`src/features/<feature>/`**: Chứa toàn bộ UI Components, Containers & API modules của miền nghiệp vụ đó:
  - `api/`: các endpoint gọi backend (1 file = 1 endpoint)
  - `components/`: table, dialog form, detail drawer
  - `types/`: interfaces & schema
* **`src/components/ui/`**: Toàn bộ UI primitives (Button, Card, Input, Sheet, Dialog, Table, Popover, ...).

### ⚡ 2. Chuẩn 1 File = 1 API Endpoint
Mọi kết nối API với Golang Backend được đóng gói độc lập trong 1 file duy nhất (Ví dụ: `src/features/<feature>/api/get-items.ts`):
1. **Schema (Zod)**: Type validation cho Request/Response.
2. **QueryKey**: Function tạo QueryKey độc lập (ví dụ `itemKeys.list(params)`).
3. **Fetcher**: Hàm gọi `apiClient` từ `src/lib/axios`.
4. **Custom Hook**: `useQuery` / `useMutation` (TanStack Query v5).

### 🎨 3. Design System & Theme
* **Màu sắc chuẩn**: Bảng màu brand xanh xám định nghĩa trong `src/app/globals.css`.
* Dùng utility classes chuẩn: `bg-primary`, `text-primary-foreground`, `border-border`, `bg-card`.
* Không hardcode mã màu hex rải rác trong code component.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
