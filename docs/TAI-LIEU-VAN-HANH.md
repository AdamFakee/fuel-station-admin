# TÀI LIỆU VẬN HÀNH & HƯỚNG DẪN TRIỂN KHAI HỆ THỐNG
# HỆ THỐNG QUẢN TRỊ TRẠM NHIÊN LIỆU NỘI BỘ (FUEL STATION SYSTEM)
> **Phiên bản tài liệu**: 1.0.0 (Module M15 - Hoàn thiện)  
> **Áp dụng cho**: Hệ thống Quản trị Trung tâm (Admin Portal & Backend API)  
> **Tiêu chuẩn thiết kế**: BRD v1.6 (Phi tiền tệ, Modular Monolith, Multi-Tenant Isolation, 3 Actors)

---

## 1. TỔNG QUAN KIẾN TRÚC & NGUYÊN LÝ BẢO MẬT P0

### 1.1. Kiến trúc hệ thống
Hệ thống quản trị trạm nhiên liệu nội bộ được xây dựng theo mô hình **Modular Monolith** kết hợp kiến trúc micro-frontend hiện đại:
- **Backend**: Golang 1.23, Chi HTTP Router, PostgreSQL driver `pgx/v5` với connection pooling `pgxpool`, logger có cấu trúc `slog`, Argon2id password hashing, AES-GCM data encryption.
- **Frontend**: Next.js 16 (App Router), React 19, Tailwind CSS v4, Radix UI primitive components, TanStack React Query v5.
- **Database**: PostgreSQL 16 Enterprise với schema phân tách (`station`, `public`), functional indexes unaccent, audit triggers, và ràng buộc toàn vẹn dữ liệu cứng.

### 1.2. 3 Nguyên tắc P0 bắt buộc (Bảo mật & Toàn vẹn)
1. **Multi-Tenant Isolation (P0)**:
   - Mọi câu truy vấn dữ liệu SQL bắt buộc chứa điều kiện `WHERE tenant_id = $1`.
   - `tenant_id` được trích xuất an toàn từ `context.Context` (JWT session), **tuyệt đối không bao giờ** nhận từ Request Body hoặc Query Param do Client truyền lên.
2. **An toàn Tiền tệ (Non-Financial)**:
   - Toàn bộ hệ thống quản lý thể tích theo đơn vị Lít trên giao diện người dùng và lưu trữ dạng số nguyên Mililit (`volume_ml` - `BIGINT`) trong CSDL.
   - Không chứa bất kỳ trường đơn giá, thành tiền, thuế VAT hay tiền tệ nào trong toàn bộ hệ thống.
3. **Quy tắc Kiểm soát Phê duyệt kép (Two-man Rule)**:
   - Database trigger `station.guard_document()` ngăn chặn triệt để hành vi tự phê duyệt: `decided_by != created_by`.
   - Sau khi chứng từ được phê duyệt (`status = 'approved'`), chứng từ trở thành bất biến (không thể sửa hoặc xóa).

---

## 2. MA TRẬN PHÂN QUYỀN 3 ACTOR (RBAC) & QUY TRÌNH VẬN HÀNH (SOP)

| Chức năng / Phân hệ | Quản lý (`MANAGER`) | Kế toán (`ACCOUNTANT`) | IT Kỹ thuật (`IT`) |
|---|:---:|:---:|:---:|
| **Đăng nhập & Đổi mật khẩu** | Toàn quyền | Toàn quyền | Toàn quyền |
| **Quản lý Tài khoản & Phân quyền (IAM)** | Toàn quyền CRUD | 🚫 Bị ẩn menu | 🚫 Bị ẩn menu |
| **Nhật ký Kiểm toán (Audit Logs)** | Xem vết | Xem vết | Xem vết |
| **Giám sát Trạm & Đồng bộ (Sync Monitor)** | Xem trạng thái | 🚫 Bị ẩn menu | Xem trạm & lỗi |
| **Tài sản (Chi nhánh, Bể, Trụ bơm, Thiết bị)** | Toàn quyền CRUD | 👁️ Chỉ xem (View-only) | 👁️ Chỉ xem (View-only) |
| **Danh mục Phương tiện & Tài xế** | Toàn quyền CRUD | 👁️ Chỉ xem (View-only) | 👁️ Chỉ xem (View-only) |
| **Thiết lập Định mức nhiên liệu (Quota)** | Toàn quyền CRUD | 👁️ Chỉ xem (View-only) | 👁️ Chỉ xem (View-only) |
| **Phiếu nhập bể (Stock Receipts)** | Lập & Gửi duyệt | 👁️ Xem danh sách | 👁️ Xem danh sách |
| **Phiếu xuất điều chỉnh (Stock Issues)** | Lập, sửa, gửi duyệt | ⚡ **Duyệt / Từ chối** | 👁️ Chỉ xem (View-only) |
| **Phiên đổ nhiên liệu (Dispense Sessions)** | Xem chi tiết | Xem chi tiết | Xem chi tiết |
| **Báo cáo & Xuất dữ liệu (Reports)** | Xem & Xuất file | Xem & Xuất file | 🚫 Bị ẩn menu |

---

## 3. YÊU CẦU HỆ THỐNG & BIẾN MÔI TRƯỜNG

### 3.1. Cấu hình phần cứng máy chủ (VPS / Dedicated Server)
- **Cấu hình tối thiểu (Dev/Staging)**: 2 vCPU, 4 GB RAM, 40 GB SSD.
- **Cấu hình khuyến nghị (Production)**: 4 vCPU, 8 GB RAM, 100 GB SSD (NVMe).
- **Hệ điều hành**: Ubuntu 22.04 LTS / Debian 12 / AlmaLinux 9 / Windows Server 2022.

### 3.2. Cấu hình tệp biến môi trường
Trước khi khởi chạy hệ thống, sao chép tệp mẫu tương ứng:

```bash
# Đối với môi trường phát triển (Dev)
cp .env.example .env

# Đối với môi trường sản xuất (Production)
cp .env.production.example .env.production
```

#### Bảng chi tiết các biến môi trường cốt lõi:
| Tên biến | Bắt buộc | Mặc định | Ý nghĩa |
|---|:---:|---|---|
| `APP_ENV` | Có | `production` | Môi trường chạy (`development` / `production`). Ở production sẽ bật fail-fast khi migrate DB. |
| `POSTGRES_USER` | Có | `postgres` | Tài khoản quản trị CSDL. |
| `POSTGRES_PASSWORD` | Có | - | Mật khẩu truy cập PostgreSQL (bắt buộc đặt mật khẩu mạnh). |
| `POSTGRES_DB` | Có | `fuel_station_db` | Tên CSDL ứng dụng. |
| `DATABASE_URL` | Có | - | Chuỗi kết nối PostgreSQL (vd: `postgres://user:pass@postgres:5432/db?sslmode=disable`). |
| `DB_MAX_CONNS` | Không | `50` | Giới hạn số lượng kết nối tối đa trong Connection Pool. |
| `CORS_ALLOWED_ORIGINS` | Có | - | Danh sách URL Frontend được phép gọi API (phân tách bởi dấu phẩy). |
| `SESSION_SECRET` | Có | - | Khóa bí mật ký session/token (độ dài tối thiểu 32 ký tự ngẫu nhiên). |
| `NEXT_PUBLIC_API_URL` | Có | - | URL gốc của Backend API mà trình duyệt người dùng kết nối tới. |
| `EDGE_HEARTBEAT_THRESHOLD_SECONDS` | Không | `300` | Ngưỡng thời gian (giây) không nhận heartbeat để đánh dấu trạm Offline (5 phút). |

---

## 4. QUY TRÌNH TRIỂN KHAI VỚI DOCKER COMPOSE

### 4.1. Khởi chạy môi trường Phát triển (Development)
```bash
# Khởi động toàn bộ cụm Postgres, Backend và Admin Frontend
docker compose up -d

# Xem log tiến trình
docker compose logs -f

# Dừng hệ thống
docker compose down
```

### 4.2. Khởi chạy môi trường Sản xuất (Production)
Môi trường production sử dụng tệp `docker-compose.prod.yml` độc lập, với mạng nội bộ cô lập, volume lưu trữ dữ liệu bền vững và chính sách tự khởi động lại:

```bash
# 1. Build images với tối ưu production
docker compose --env-file .env.production -f docker-compose.prod.yml build --no-cache

# 2. Khởi động các container ở chế độ background
docker compose --env-file .env.production -f docker-compose.prod.yml up -d

# 3. Kiểm tra trạng thái sức khỏe container
docker compose --env-file .env.production -f docker-compose.prod.yml ps
```

---

## 5. QUẢN TRỊ CƠ SỞ DỮ LIỆU (DATABASE OPERATIONS)

### 5.1. Nạp dữ liệu mẫu Demo (Module M15 Benchmark Dataset)
Hệ thống cung cấp sẵn file seed migration `000010_seed_demo_m15.up.sql` tạo đầy đủ dữ liệu mẫu sẵn sàng vận hành:
- Nhà cung cấp: Petrolimex, PVOIL
- Bể chứa chuẩn: `TK-DO-01` (25,000 L), `TK-DO-02` (25,000 L), `TK-A95-01` (20,000 L) kèm tồn đầu kỳ
- Trụ bơm & vòi: `PUMP-01`, `PUMP-02` liên kết bộ số Montech RS-485 và máy chấm công Hikvision
- Quy tắc định mức: Định mức xe tải 250 L/ngày, định mức đội xe 1,200 L/tuần

```bash
# Thực thi nạp dữ liệu demo trực tiếp vào CSDL
psql -U postgres -d fuel_station_db -f backend/db/migrations/000010_seed_demo_m15.up.sql
```

### 5.2. Quy trình Sao lưu Dữ liệu (Backup)
Khuyến nghị thiết lập cronjob tự động sao lưu hàng ngày lúc 01:00 AM:

```bash
#!/bin/bash
BACKUP_DIR="/var/backups/fuelstation"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
FILENAME="$BACKUP_DIR/fuel_station_backup_$TIMESTAMP.sql.gz"

mkdir -p $BACKUP_DIR
docker exec fuel_station_postgres_prod pg_dump -U postgres fuel_station_prod | gzip > $FILENAME

# Xóa các bản sao lưu cũ hơn 30 ngày
find $BACKUP_DIR -type f -name "*.sql.gz" -mtime +30 -delete
```

### 5.3. Quy trình Phục hồi Dữ liệu (Restore)
```bash
# Giải nén và nạp lại vào CSDL
gunzip < /var/backups/fuelstation/fuel_station_backup_YYYYMMDD.sql.gz | docker exec -i fuel_station_postgres_prod psql -U postgres -d fuel_station_prod
```

---

## 6. SỔ TAY XỬ LÝ SỰ CỐ (TROUBLESHOOTING RUNBOOK)

### 6.1. Sự cố: Trạm hiển thị trạng thái Offline trên Sync Monitor
- **Hiện tượng**: Trên màn hình `/sync-monitor`, trạm xăng chuyển sang màu đỏ "Ngoại tuyến".
- **Nguyên nhân**: Edge Agent tại cây xăng không gửi bản tin Heartbeat về Server trong hơn 5 phút (`EDGE_HEARTBEAT_THRESHOLD_SECONDS`).
- **Cách xử lý**:
  1. Kiểm tra kết nối Internet tại cây xăng (đường truyền mạng Mini PC).
  2. Kiểm tra tiến trình Edge Agent trên Mini PC tại trạm (`systemctl status fuel-edge-agent`).
  3. Kiểm tra log kết nối API: `journalctl -u fuel-edge-agent -f`.

### 6.2. Sự cố: Gặp lỗi 403 Forbidden Modal khi thực hiện thao tác
- **Hiện tượng**: Xuất hiện popup cảnh báo màu đỏ "403 - Truy cập bị từ chối" và thao tác bị chặn.
- **Nguyên nhân**: Người dùng đang cố gắng thực hiện hành động ngoài phạm vi vai trò (ví dụ: Quản lý cố tình phê duyệt phiếu xuất điều chỉnh).
- **Cách xử lý**: Giải thích cho người dùng về quy tắc phân quyền: Phiếu xuất điều chỉnh bắt buộc phải do tài khoản **Kế toán** phê duyệt.

### 6.3. Sự cố: Lỗi "Vượt quá sức chứa khả dụng của bể chứa"
- **Hiện tượng**: Khi lập hoặc duyệt phiếu nhập bể, hệ thống báo lỗi vi phạm trigger `trg_stock_ledger_before_insert`.
- **Nguyên nhân**: Lượng nhiên liệu nhập vào cộng với tồn hiện tại vượt quá `max_usable_capacity_ml` của bể.
- **Cách xử lý**: Kiểm tra lại thông số thể tích thực tế trên hóa đơn xe bồn hoặc phân bổ bớt lượng nhiên liệu sang bể chứa khác cùng loại.

---

## 7. THÔNG TIN LIÊN HỆ & BẢO TRÌ HỆ THỐNG
- **Đơn vị phát triển**: Nhóm Kỹ thuật Hệ thống Quản trị Trạm Nhiên Liệu Nội Bộ
- **Phiên bản mã nguồn**: Ready Production v1.0.0
