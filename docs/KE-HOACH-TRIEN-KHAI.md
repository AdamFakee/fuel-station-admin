# Kế hoạch triển khai Admin (theo BRD v1.6, phạm vi đã chốt)

> Phạm vi chốt với chủ dự án: **cây xăng nội bộ, không có tiền** (không đơn giá, thành tiền, VAT, giá vốn); **không realtime**
> (không SignalR, SSE, WebSocket; dashboard làm mới thủ công hoặc 30 giây); **3 actor**; IT chỉ xem; Quản lý giữ toàn bộ quyền quản trị;
> khóa API của trạm Edge do **ADMIN cấp, cấp lại và thu hồi** ở trang Trạng thái trạm & Đồng bộ (quyền `sync.monitor:update`, có ghi nhật ký thao tác). Khóa chỉ hiện một lần, server chỉ giữ bản băm; mini server đặt khóa bằng `install.sh set-token` hoặc `install.ps1 -Action set-token` (xem `deploy/README.md` của repo fuel-station).

## 1. Ba actor và quyền

| Module | IT kỹ thuật | Quản lý | Kế toán |
|---|---|---|---|
| Đăng nhập, đổi và quên mật khẩu | ✔ | ✔ | ✔ |
| Tài khoản, vai trò, phân quyền | | ✔ | |
| Audit log | xem | xem | xem |
| Trạm online/offline, hàng đợi và lỗi đồng bộ | xem | xem | |
| Nhà máy/chi nhánh, trụ bơm, bể chứa, thiết bị | xem | ✔ sửa | xem |
| Xe, tài xế, thẻ, mặt, đồng bộ xuống máy | xem | ✔ | xem |
| Định mức (lít) | xem | ✔ | xem |
| Phiếu nhập bể: lập và duyệt | xem | ✔ | xem |
| Phiếu xuất điều chỉnh, hao hụt: lập | | ✔ | |
| Phiếu xuất điều chỉnh, hao hụt: duyệt | | | ✔ |
| Kiểm kê: nhập số đo thực tế | | ✔ | |
| Kiểm kê: xác nhận chênh lệch | | | ✔ |
| Dashboard | ✔ | ✔ | ✔ |
| Phiên đổ và chi tiết | xem | ✔ | xem |
| Báo cáo và xuất Excel/PDF | | ✔ | ✔ |

Ma trận này đã nằm trong DB: `station.seed_tenant_defaults(tenant_id)` (migration `000007`) dựng 3 vai trò hệ thống `MANAGER`, `ACCOUNTANT`, `IT`
và quyền của từng vai trò. Quản lý có thể chỉnh ma trận quyền sau (RBAC), nhưng không xóa được 3 vai trò hệ thống.

## 2. Kiểm tra source base (đã làm) và việc phải sửa trước khi làm module

Base build được và có cấu trúc đúng hướng (Modular Monolith, `apperr`, `httpx`, `tx`, migration nhúng). Các điểm sau **phải sửa ở module nền (M0)**:

| # | Vấn đề | Chỗ | Cách sửa |
|---|---|---|---|
| 1 | Migration lỗi hoặc không nối được DB chỉ **cảnh báo rồi chạy tiếp** ("fallback mode") | `internal/app/app.go` | Khi `APP_ENV` khác `local` thì dừng ngay (fail-fast) |
| 2 | Migrator tự `Force` phiên bản khi trạng thái dirty | `internal/platform/postgres/migrator.go` | Bỏ: dirty phải do người xử lý, tự ép dễ làm hỏng schema âm thầm |
| 3 | CORS phản chiếu mọi `Origin` kèm `Allow-Credentials: true` | `internal/shared/middleware` | Danh sách Origin cho phép lấy từ cấu hình |
| 4 | CORS cho phép header `X-Tenant-ID` | cùng chỗ | Bỏ: vi phạm P0 (tenant không được lấy từ client) |
| 5 | Chưa có middleware xác thực: `WithTenantID` có nhưng không ai đặt | `middleware`, `authz` | Middleware auth đọc phiên, dựng `Principal` (user, tenant, role, quyền, chi nhánh được gán) |
| 6 | `authz.Principal` thiếu tenant và phạm vi chi nhánh | `internal/shared/authz` | Thêm `TenantID`, `BranchIDs` |
| 7 | Logger chỉ ghi method và path, không có status, thời gian, request id | `middleware.Logger` | Ghi thêm status, duration, request_id, user_id |
| 8 | `docker-compose.yml` cố định mật khẩu `postgres/postgres` và `APP_ENV: production` | gốc repo | Đọc từ `.env`, tách compose dev và prod |
| 9 | Không có test nào | toàn repo | Thêm test từng module; `make db-test` đã có cho schema |
| 10 | `admin/src/features` rỗng, chưa có trang đăng nhập, chưa có layout theo quyền | `admin` | M0 dựng khung auth và menu theo quyền |

## 3. Schema (đã viết: migration `000002` đến `000007`)

| File | Nội dung |
|---|---|
| `000002_tenancy_iam` | hàm chung (`set_updated_at`, `bump_version`, `next_code`), `tenant`, `tenant_setting`, `branch`, `permission`, `role`, `role_permission`, `app_user`, `user_branch`, `auth_session`, `password_reset`, `audit_log` (bất biến) |
| `000003_master_data` | `stored_file`, `fuel_type`, `vehicle_type`, `vehicle_group`, `route`, `tank`, `pump`, `nozzle`, `pump_sensor`, `access_terminal`, `vehicle`, `driver`, `credential`, `quota_rule`, `quota_extra` |
| `000004_edge_sync` | `edge_station`, `sync_change_log` (cursor `seq`), trigger ghi thay đổi cho pump, sensor, terminal, vehicle, driver, credential |
| `000005_dispense` | `dispense_session`, `dispense_session_event`, `access_event` |
| `000006_inventory` | `supplier`, `stock_ledger` (chỉ thêm, tự tính số dư, chặn tồn âm và vượt dung tích), view `tank_stock`, `stock_receipt` (+ dòng, + đính kèm), `stock_issue`, `stock_reconciliation`, `alert`, `notification_outbox` |
| `000007_permissions_seed` | 61 quyền, `seed_tenant_defaults` |

Quyết định thiết kế chính:
- **Cô lập tenant ở tầng DB:** mọi bảng cha có `UNIQUE (tenant_id, id)` và bảng con dùng FK ghép, nên dữ liệu hai tenant không thể tham chiếu chéo nhau dù code có sai.
- **Không có tiền:** không có cột giá hay thành tiền ở bất kỳ bảng nào. Thể tích là mililít (`_ml`), khớp Edge Agent.
- **Tồn kho không sửa tay:** chỉ có `stock_ledger` (thêm, không sửa, không xóa). Trigger tự đánh `seq`, tính số dư, chặn tồn âm, chặn vượt dung tích khả dụng tối đa, và khóa dòng bể để ghi đồng thời không sai số dư.
- **Chứng từ:** `draft → pending → approved | rejected`; đã duyệt thì không sửa, không xóa. Người có quyền duyệt duyệt được cả phiếu do chính mình lập (đã bỏ quy tắc người duyệt khác người lập ở migration 000022).
- **Đồng bộ xuống trạm:** `version` tự tăng, trigger ghi `sync_change_log`; Edge Agent kéo `WHERE seq > cursor`.
- **Idempotency lên server:** `UNIQUE (edge_station_id, edge_ref)` và `(edge_station_id, sensor_serial, sale_seq)`.
- **Số thẻ** lưu đúng dạng máy chấm công báo `cardNo` (thập phân, byte đầu là byte thấp; UID `79:7F:3B:E6` là `3862658937`).
- **Kiểm tra:** `make db-test` (trong `backend`) dựng DB tạm, áp mọi migration, chạy 31 kiểm tra hành vi trong `db/tests/schema_behaviour.sql`, rồi thử down và up lại.

Không dùng RLS (Row Level Security) ở bước này; cô lập tenant dựa vào FK ghép và điều kiện `tenant_id` bắt buộc ở mọi truy vấn. Có thể thêm RLS sau như lớp phòng thủ thứ hai.

## 4. Hợp đồng với Edge Agent (không realtime, không có UI cấp token)

Xác thực: header `X-Api-Key`, so băm với `edge_station.api_key_hash` (cấp từ trang Trạng thái trạm trên admin; seed chỉ dùng cho dữ liệu demo). Chi nhánh và tenant suy ra từ trạm.

| API | Việc | Ánh xạ vào Edge Agent |
|---|---|---|
| `GET /edge/v1/catalog/changes?cursor=&limit=` | Trả thay đổi danh mục thuộc chi nhánh của trạm, `seq > cursor`; kèm `next_cursor`, `has_more` | `MasterDataSource::pull` |
| `POST /edge/v1/dispense-sessions` | Nhận phiên đổ (idempotent theo `edge_ref`); nếu `completed` thì ghi dòng `dispense` vào `stock_ledger` cùng giao dịch | `CloudSink` topic `session.closed`, `sale.completed` |
| `POST /edge/v1/access-events` | Nhận lô sự kiện xác thực (kể cả bị từ chối) | `auth_log` của trạm |
| `POST /edge/v1/heartbeat` | Cập nhật `last_seen_at`, `pending_queue`, `agent_version` | giám sát đồng bộ |

Edge Agent phía trạm hiện còn thiếu để khớp BRD (làm sau, không chặn admin): biển số trong giao dịch, kiểm tra hạn mức còn lại, giãn cách tối thiểu giữa hai lần bơm,
tồn bể khả dụng, giới hạn lít `min(hạn mức, tồn bể)`, đọc `ready_timeout` từ danh mục.

## 5. Kế hoạch từng module

Thứ tự theo phụ thuộc. Mỗi module xong khi: có API backend, có màn hình, có test, có ghi audit đúng chỗ, và qua `make test`, `make lint`, `npm run lint`, `npm run build`.

| Module | Việc chính | Phụ thuộc | Cỡ |
|---|---|---|---|
| **M0. Nền** | Sửa 10 điểm ở mục 2; cấu hình (CORS, secret); middleware auth + `Principal`; ghi audit dùng chung (`audit.Record(ctx, ...)`); lưu file; khung FE: đăng nhập, layout, menu theo quyền, axios, xử lý lỗi | schema | L |
| **M1. Xác thực** | Đăng nhập (Argon2id), refresh token cookie, "ghi nhớ", khóa sau 5 lần sai (`tenant_setting`), đổi mật khẩu, quên mật khẩu qua email (`notification_outbox` + worker SMTP) | M0 | M |
| **M2. Tài khoản, vai trò, phân quyền** (Quản lý) | CRUD tài khoản, gán chi nhánh, khóa/mở khóa, đặt lại mật khẩu; CRUD vai trò, ma trận quyền; chặn tự hạ quyền hoặc tự khóa người quản trị cuối cùng | M1 | M |
| **M3. Audit log** | Màn xem, lọc, xuất; đảm bảo mọi module ghi vết đúng danh sách nhạy cảm của BRD | M0 | S |
| **M4. Tổ chức, tài sản** (Quản lý sửa, IT và Kế toán xem) | Chi nhánh; loại nhiên liệu; bể (dung tích, ngưỡng, hao hụt); trụ, vòi, bộ số, máy chấm công (mật khẩu máy mã hóa AES-GCM); tồn đầu kỳ bể | M2 | L |
| **M5. Danh mục xe, tài xế** | Loại xe, nhóm xe, tuyến; xe; tài xế; thẻ, mặt (tải ảnh), vân tay; khóa, mở khóa; xóa mềm; mã xe và mã nhân viên đúng định dạng máy chấm công | M4 | L |
| **M6. Định mức** | Quy tắc theo xe, nhóm, tuyến; chu kỳ; giãn cách; hiệu lực; hủy; cấp bổ sung đột xuất | M5 | M |
| **M7. API Edge** | 4 API ở mục 4; xác thực khóa; đưa phiên vào `stock_ledger`; trạm online/offline (quá 5 phút không heartbeat) | M4, M5 | L |
| **M8. Theo dõi đồng bộ** (IT, Quản lý xem) | Danh sách trạm, lần đồng bộ cuối, hàng đợi, lỗi | M7 | S |
| **M9. Phiên đổ** | Danh sách (lọc trụ, xe, tài xế, trạng thái, thời gian), chi tiết (dòng thời gian, giao dịch, nhật ký xác thực), xem lượt bị từ chối | M7 | M |
| **M10. Nhập bể** (Quản lý) | Phiếu nhập nhiều dòng (một chuyến xe bồn vào nhiều bể), đính kèm ảnh, kiểm sức chứa, gửi duyệt, duyệt hoặc từ chối, ghi `stock_ledger` | M4 | L |
| **M11. Xuất điều chỉnh** | Phiếu điều chuyển, hao hụt, kiểm định; Quản lý lập, Kế toán duyệt; ghi sổ | M10 | M |
| **M12. Tồn kho, kiểm kê, cảnh báo** | Tồn tức thời; job đối chiếu cuối ngày (tồn sổ sách, số đo thực tế, đồng hồ tổng cột bơm); Quản lý nhập số đo, Kế toán xác nhận; cảnh báo tồn thấp và vượt ngưỡng hao hụt (trên hệ thống và email) | M9, M10, M11 | L |
| **M13. Dashboard** | Tồn từng bể, trạng thái trụ (theo lần đồng bộ cuối), tiêu hao thực tế so với định mức, giao dịch gần nhất; làm mới thủ công hoặc 30 giây | M9, M12 | M |
| **M14. Báo cáo** | 6 mẫu (Nhập – Xuất – Tồn và thẻ kho; bảng kê phiếu nhập; lịch sử cấp phát; tiêu hao theo xe; cấp phát theo tài xế; đối chiếu kiểm kê), xuất Excel và PDF, **không có cột tiền** | M9 đến M12 | L |
| **M15. Hoàn thiện** | Phân quyền toàn diện (kiểm thử theo từng actor), dữ liệu mẫu, tài liệu vận hành, docker-compose chuẩn | tất cả | M |

Gợi ý chia đợt phát hành:
1. **Đợt 1 (chạy được cùng Edge Agent):** M0, M1, M2, M3, M4, M5, M7, M8, M9. Đủ để quản lý tài khoản, khai báo trạm và xe, đồng bộ xuống máy chấm công và xem phiên đổ thật.
2. **Đợt 2 (kho):** M6, M10, M11, M12.
3. **Đợt 3:** M13, M14, M15.

## 6. Việc cần chốt thêm khi làm (không chặn đợt 1)
- Dung lượng và nơi lưu ảnh mặt, ảnh chứng từ (ổ đĩa cục bộ hay MinIO); giới hạn ảnh mặt nhỏ hơn 200 KB cho máy chấm công.
- Cách gửi email (SMTP nào) cho quên mật khẩu và cảnh báo.
- Ngưỡng "trạm offline" (đề xuất 5 phút) và nhịp heartbeat của Edge Agent.
- Múi giờ hiển thị: lưu UTC, hiển thị theo `Asia/Ho_Chi_Minh`.

## 7. Mô hình cửa hàng, xe, tài xế (chốt sau, thay thế các mô tả cũ ở trên)

```text
Cửa hàng ─┬─ Trụ ─┬─ Bộ số Montech (1, cổng COM riêng, serial được trùng)
          │       └─ Máy chấm công Hikvision (1)
          └─ Mini PC chạy Edge Agent (1 cho cả cửa hàng)

Xe, Tài xế: dữ liệu cấp công ty; xe đổ được ở MỌI cửa hàng, tài xế lái được mọi xe
            (đã bỏ tính năng "xe được phép đổ ở những cửa hàng nào": migration 000024 xóa bảng vehicle_branch)
```

- **Migration `000011_vehicle_store_scope`:** (đã thêm `vehicle_branch`, sau đó bị `000024_drop_vehicle_branch` gỡ hẳn); bỏ `vehicle.branch_id`, `driver.branch_id`, `driver.position` (không còn nhân viên vận hành, bảo vệ);
  `pump_sensor` thêm `branch_id` và `name`, cổng COM duy nhất trong một cửa hàng, serial không cần duy nhất; một lần bơm nhận diện theo (trụ, số thứ tự) thay vì (serial, số thứ tự).
- **Đồng bộ xuống trạm:** API Edge đẩy MỌI xe của công ty xuống mọi trạm; không còn cờ `allowed_here` (xe không bị từ chối vì "đổ nhầm cửa hàng").
- **Migration `000012_simplify_vehicle`:** bỏ tuyến đường, đội nhóm phương tiện và dung tích bình chứa của xe; định mức chỉ còn áp theo xe (các quy tắc định mức theo nhóm hoặc tuyến bị xóa); số thẻ NFC bắt buộc khi tạo xe (kiểm tra ở API); báo cáo tiêu hao theo xe bỏ cột nhóm, tuyến.
- **Giao diện:** form trụ gồm 3 phần (trụ và vòi, bộ số, máy chấm công), bỏ màn Thiết bị riêng (`/devices` chuyển về `/pumps`); form xe không còn ô chọn cửa hàng; màn tài xế bỏ vị trí và chi nhánh.
- **Còn lại phía Edge Agent (repo `fuel-station`, chưa làm):** bỏ xử lý cờ `allowed_here` / từ chối `NotAllowedHere` (API không còn gửi cờ); nhận diện bộ số bằng (cổng COM, serial) thay vì chỉ serial; khóa lần bơm theo (trụ, số thứ tự).
