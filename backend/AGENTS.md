# QUY TẮC KIẾN TRÚC & QUY CHUẨN BACKEND GOLANG (BACKEND AGENT RULES)

> **Dành cho Agent/Developer**: Tài liệu hướng dẫn độc lập cho dịch vụ **Backend Golang (`backend`)**.

---

## 0. QUẢN LÝ CONTEXT & TRA CỨU NHANH (ON-DEMAND ROUTER)

| Nhiệm vụ / Tình huống | File Cần Đọc (`view_file`) | Mục đích & Nội dung chính |
|---|---|---|
| 🏗️ **Tổng quan Kiến trúc Backend** | `README.md` | Phân tầng Modular Monolith, Composition Root, Server Timeouts |
| 🧩 **Thiết kế Module & Interface** | `../.agents/skills/codebase-design/SKILL.md` | Triết lý Deep Modules (Interface mỏng, Implementation sâu) |
| 🔍 **Thiết Kế API Search & Filter** | `../.agents/skills/search-api/SKILL.md` | Quy chuẩn API tìm kiếm, phân trang & query parameters |
| 🏛️ **Tra Cứu Kiến Trúc Hệ Thống** | `../.agents/skills/architect/SKILL.md` | Tra cứu các nguyên lý thiết kế và conventions |

---

## 1. NGUYÊN LÝ CỐT LÕI (NON-NEGOTIABLE CONVENTIONS)

### 🔴 1. Multi-Tenant Isolation (Security P0)
* Mọi truy vấn SQL dữ liệu tenant **BẮT BUỘC** có điều kiện `WHERE tenant_id = $1`.
* `tenant_id` lấy từ `context.Context` (do Auth/Tenant Middleware trích xuất). **TUYỆT ĐỐI KHÔNG** nhận `tenant_id` từ Client Request Body/Query.

### 🆔 2. Định Danh Kép (UUID `id` vs Mã `code`)
* `id` (Machine Key): `UUIDv4`, dùng cho PK, FK, URL route `/v1/items/{id}`.
* `code` (Human-Friendly Key): Chuỗi ký tự người dùng (`FS-2026-0001`, `PUMP-01`). Dùng cho quét mã, in ấn, tìm kiếm `q=`.
* Có `id` trong tay $\rightarrow$ Thao tác hoàn toàn bằng `id`. Không query ngược lại bằng `code`.

### ⚡ 3. SQL & Data Access (`pgxpool`)
* Nói KHÔNG với ORM nặng. Viết SQL thuần parameterized (`WHERE name = $1`).
* Bắt buộc `defer rows.Close()` cho mọi truy vấn `pgx.Rows`.
* Tránh N+1 Query: Sử dụng JOIN hoặc `WHERE id = ANY($1)`.
* Thời gian: Mọi `time.Time` xử lý và lưu DB **LUÔN LUÔN dùng UTC**.

### 💰 4. An Toàn Tiền Tệ (Money Safety)
* Lưu tiền dưới dạng **Số nguyên đơn vị nhỏ nhất (Cents/Xu)** kiểu `int64` hoặc `shopspring/decimal`. **TUYỆT ĐỐI KHÔNG** dùng `float32/float64`.
* Cấm Silent Fallback: Không tự gán `price = 0` khi bị lỗi. Phải trả lỗi hoặc lấy giá trị mặc định tường minh.

### 📦 5. Envelope Response & Error Handling
Mọi API response trả về dạng chuẩn:
```json
{
  "code": "invalid_input",
  "message": "tank_id required"
}
```
* Service/Repository return error wrap kèm context (`fmt.Errorf("do task: %w", err)`).
* Handler sử dụng `httpx.Error(w, r, log, err)` để map sentinel errors (`apperr.*`) sang HTTP status code chuẩn.
