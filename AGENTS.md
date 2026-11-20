# QUẢN TRỊ DỰ ÁN & CỔNG ĐIỀU HƯỚNG AGENT (MASTER WORKSPACE ROUTER)

> **Dành cho Agent/Developer**: Đây là Root AGENTS Router điều hướng chung cho Workspace `fuel-statiton-admin`. Mỗi sub-project (`admin` và `backend`) có file quy tắc `AGENTS.md` độc lập cùng cấp.

---

## 🧭 BẢNG HƯỚNG DẪN ĐIỀU HƯỚNG BỐI CẢNH (AGENT CONTEXT ROUTER)

> **BẮT BUỘC:** Khi nhận bất kỳ nhiệm vụ nào, Agent **CHỈ ĐỌC ĐÚNG FILE RULES CỦA SUB-PROJECT ĐÓ** để giữ cho Context Window luôn tinh gọn:

| Tình huống / Nhiệm vụ của Agent | File Cần Đọc (`view_file`) | Thời điểm Đọc | Phạm vi & Quy chuẩn Cần Nắm |
|---|---|---|---|
| 🏁 **Nhiệm vụ chung Workspace** | `AGENTS.md` | Ngay khi nhận prompt | Tra cứu cổng điều hướng & Nguyên lý bảo mật P0 |
| 💻 **Làm UI / Frontend Admin (Next.js)** | `admin/AGENTS.md` | Khi làm UI, Form, Client Hook | App Router `src/features`, CRUD dùng Drawer/Popup, 1 File = 1 API, TanStack Query v5 |
| ⚙️ **Làm Backend Golang (API / Service)** | `backend/AGENTS.md` | Khi làm API, SQL Repo, Service | Modular Monolith `internal/modules/`, Sentinel Error mapping, `pgxpool` |
| 🧩 **Thiết kế Module & Interface** | `.agents/skills/codebase-design/SKILL.md` | Khi refactor / tạo Interface | Triết lý Deep Modules (Interface mỏng, Implementation sâu) |
| 🏛️ **Tra Cứu Kiến Trúc Hệ Thống** | `.agents/skills/architect/SKILL.md` | Khi cần tra cứu conventions | Tra cứu cấu trúc & quy ước thiết kế hệ thống |

---

## 🗺️ CHỈ MỤC SKILLS NỘI BỘ ĐÃ XÁC MINH (VERIFIED SKILLS INDEX)

| Tên Skill Nội Bộ | Mục Đích Sử Dụng | Đường Dẫn `SKILL.md` |
|---|---|---|
| **`codebase-design`** | Thiết kế Deep Modules, Seams & Interfaces | [`.agents/skills/codebase-design/SKILL.md`](.agents/skills/codebase-design/SKILL.md) |
| **`search-api`** | Thiết kế API Search, Pagination & Filtering | [`.agents/skills/search-api/SKILL.md`](.agents/skills/search-api/SKILL.md) |
| **`admin-table-format`** | Định dạng & Layout Bảng dữ liệu Admin | [`.agents/skills/admin-table-format/SKILL.md`](.agents/skills/admin-table-format/SKILL.md) |
| **`fe-detail-page`** | Thiết kế Màn hình chi tiết Admin | [`.agents/skills/fe-detail-page/SKILL.md`](.agents/skills/fe-detail-page/SKILL.md) |
| **`fe-dialog-form`** | Thiết kế Modal Form dữ liệu Admin | [`.agents/skills/fe-dialog-form/SKILL.md`](.agents/skills/fe-dialog-form/SKILL.md) |
| **`confirm-dialog`** | Hộp thoại xác nhận thao tác nguy hiểm | [`.agents/skills/confirm-dialog/SKILL.md`](.agents/skills/confirm-dialog/SKILL.md) |
| **`vercel-react-best-practices`** | Tối ưu hiệu năng React & Next.js App Router | [`.agents/skills/vercel-react-best-practices/SKILL.md`](.agents/skills/vercel-react-best-practices/SKILL.md) |
| **`architect`** | Tra cứu tài liệu & quyết định kiến trúc | [`.agents/skills/architect/SKILL.md`](.agents/skills/architect/SKILL.md) |

---

## 🔴 NGUYÊN LÝ BẢO MẬT P0 CHUNG HOÀN TOÀN BẮT BUỘC

1. **Multi-Tenant Isolation (Security P0)**:
   - Mọi SQL Query dữ liệu tenant **BẮT BUỘC** có `WHERE tenant_id = $1`.
   - `tenant_id` lấy từ `context.Context` (JWT/Session). **TUYỆT ĐỐI KHÔNG** nhận `tenant_id` từ Request Body/Query do Client truyền lên.
2. **Định danh Kép (UUID `id` vs Mã `code`)**:
   - `id` (`UUIDv4`): Khóa chính, khóa ngoại, URL param `/v1/items/{id}`.
   - `code` (Human-Friendly): Chuỗi ký tự cho người dùng (`FS-2026-0001`, `PUMP-01`).
   - Đã có `id` $\rightarrow$ Thao tác 100% bằng `id`. Không query ngược lại bằng `code`.
3. **An Toàn Tiền Tệ (Money Safety)**:
   - Lưu tiền dưới dạng Số nguyên đơn vị nhỏ nhất (Cents/Xu) `int64` hoặc `Decimal`. **CẤM DÙNG `float64`**.

---

## 📝 QUY CHUẨN COMMIT GIT BẮT BUỘC (MANDATORY COMMIT MESSAGE CONVENTIONS)

> **BẮT BUỘC CHO MỌI AGENT VÀ DEVELOPER**: Mọi git commit trong toàn bộ dự án **BẮT BUỘC PHẢI CÓ CẢ TITLE VÀ SUBTITLE (BODY)**. Tuyệt đối **CẤM** commit chỉ có một dòng title cụt lủn không giải trình nội dung.

### 1. Cấu trúc Commit 2 phần chuẩn:
```text
<type>(<scope>): <title_ngắn_gọn_súc_tích_dưới_72_ký_tự>

- <tập_tin_hoặc_mô_đun_1>: <mô tả chi tiết việc đã thực hiện>
- <tập_tin_hoặc_mô_đun_2>: <mô tả chi tiết việc đã thực hiện>
- <tập_tin_hoặc_mô_đun_n>: <mô tả chi tiết việc đã thực hiện>
```

### 2. Quy tắc cụ thể:
1. **Title (Dòng 1)**:
   - Sử dụng tiền tố Conventional Commits: `feat`, `fix`, `docs`, `refactor`, `test`, `perf`, `chore`.
   - Kèm `(<scope>)` xác định phạm vi ảnh hưởng (ví dụ: `feat(pumps): ...`, `docs(api): ...`, `fix(auth): ...`).
2. **Dòng trống phân cách**: Bắt buộc có chính xác 1 dòng trống giữa Title và Subtitle.
3. **Subtitle / Body (Từ dòng 3 trở đi)**:
   - Liệt kê dạng gạch đầu dòng (`- `) chi tiết từng tệp, chức năng, hoặc module đã thay đổi.
   - Nêu rõ lý do, logic cốt lõi đã xử lý và kết quả xác minh (test, lint).
   - Cấm viết chung chung như "- update code" hoặc "- fix bug".

---

## 🚫 QUY TẮC BẢO VỆ MÃ NGUỒN VÀ TRIỂN KHAI (GIT OPERATIONS RULE)

> **TUYỆT ĐỐI CẤM TỰ Ý PUSH CODE LÊN GIT (`git push`):**
> 1. **Quyền kiểm soát thuộc về Developer**: Mọi hành vi thực thi lệnh `git push` (bao gồm `git push origin ...`) bắt buộc phải có **yêu cầu / xác nhận tường minh từ người dùng** trong phiên hội thoại.
> 2. **Không tự động kích hoạt CI/CD**: Việc push code sẽ kích hoạt các pipeline build, push Docker Hub và deploy tự động lên VPS Production. Do đó, Agent không bao giờ được tự ý push sau khi commit hoặc sau khi sửa lỗi nếu chưa được Developer cho phép.
> 3. **Phạm vi Agent được phép**: Agent được phép tạo branch, chỉnh sửa file, chạy lint/test, và tạo commit cục bộ (khi được giao việc), nhưng **DỪNG LẠI Ở BƯỚC COMMIT** và báo cáo lại để Developer quyết định thời điểm push.
