// Command seed nạp dữ liệu nền cho môi trường phát triển: công ty, vai trò, tài khoản, trạm xăng và trạm Edge.
// Dữ liệu vận hành (bể, trụ, xe, tài xế, phiếu...) nạp qua API bằng scripts/seed_operational.py để đi qua đúng luật nghiệp vụ.
package main

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"log"
	"os"
	"strings"

	"fuel-station-backend/internal/platform/crypto"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

// Các id cố định: test và script dùng chung.
const (
	defaultTenantID = "11111111-1111-1111-1111-111111111111"
	adminUserID     = "33333333-3333-3333-3333-333333333331"
	accountantID    = "33333333-3333-3333-3333-333333333332"
	itUserID        = "33333333-3333-3333-3333-333333333333"
)

type station struct {
	id          string
	name        string
	address     string
	managerName string
	phone       string
	edgeCode    string
	edgeKey     string // hậu tố khóa API của Edge Agent: khóa thật là <SEED_EDGE_KEY_PREFIX>_<edgeKey>
}

var stations = []station{
	{"22222222-2222-2222-2222-222222222221", "Trạm xăng Cầu Giấy", "Số 128 Xuân Thủy, Cầu Giấy, Hà Nội", "Nguyễn Văn Quản Lý", "0243 7561 128", "EDGE-CG", "cau_giay"},
	{"22222222-2222-2222-2222-222222222222", "Trạm xăng Hải Phòng", "Km 7 Quốc lộ 5, Hồng Bàng, Hải Phòng", "Đỗ Quang Huy", "0225 3841 507", "EDGE-HP", "hai_phong"},
	{"22222222-2222-2222-2222-222222222223", "Trạm xăng Đà Nẵng", "Số 215 Nguyễn Hữu Thọ, Hải Châu, Đà Nẵng", "Võ Thị Thanh Hương", "0236 3622 215", "EDGE-DN", "da_nang"},
}

func envOr(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func must(err error, what string) {
	if err != nil {
		log.Fatalf("%s: %v", what, err)
	}
}

func main() {
	ctx := context.Background()
	// Biến môi trường (server): DATABASE_URL, SEED_PASSWORD (mật khẩu chung cho mọi tài khoản mẫu),
	// SEED_EDGE_KEY_PREFIX (tiền tố khóa API Edge). Không đặt thì dùng giá trị dành cho máy dev.
	dbURL := envOr("DATABASE_URL", "postgres://postgres:postgres@localhost:5432/fuel_station_db?sslmode=disable")
	seedPassword := os.Getenv("SEED_PASSWORD")
	edgePrefix := envOr("SEED_EDGE_KEY_PREFIX", "edge_key")

	pool, err := pgxpool.New(ctx, dbURL)
	must(err, "kết nối database")
	defer pool.Close()

	// Chế độ chỉ tạo tài khoản Quản trị hệ thống cho server đã có dữ liệu thật (không động tới dữ liệu khác).
	if os.Getenv("SEED_MODE") == "admin" {
		seedAdminOnly(ctx, pool)
		return
	}

	tenantID := uuid.MustParse(defaultTenantID)

	_, err = pool.Exec(ctx, `
		INSERT INTO station.tenant (id, code, name, status)
		VALUES ($1, 'PETRO-VN', 'Công ty Cổ phần Xăng dầu Petro Việt Nam', 'active')
		ON CONFLICT (id) DO NOTHING`, tenantID)
	must(err, "tạo công ty")

	// 3 vai trò hệ thống (Quản lý, Kế toán, IT) cùng ma trận quyền mặc định.
	_, err = pool.Exec(ctx, `SELECT station.seed_tenant_defaults($1)`, tenantID)
	must(err, "tạo vai trò mặc định")

	// Trạm xăng: mã do hệ thống sinh như khi tạo qua giao diện.
	for _, st := range stations {
		_, err = pool.Exec(ctx, `
			INSERT INTO station.branch (id, tenant_id, code, name, address, manager_name, phone, status)
			VALUES ($1, $2, station.next_code($2, 'CN'), $3, $4, $5, $6, 'active')
			ON CONFLICT (tenant_id, id) DO NOTHING`,
			uuid.MustParse(st.id), tenantID, st.name, st.address, st.managerName, st.phone)
		must(err, "tạo trạm xăng "+st.name)

		sum := sha256.Sum256([]byte(edgePrefix + "_" + st.edgeKey))
		_, err = pool.Exec(ctx, `
			INSERT INTO station.edge_station (tenant_id, branch_id, code, name, api_key_hash, status, agent_version)
			VALUES ($1, $2, $3, $4, $5, 'active', '1.0.0')
			ON CONFLICT (branch_id) DO NOTHING`,
			tenantID, uuid.MustParse(st.id), st.edgeCode, "Edge Agent "+st.name, hex.EncodeToString(sum[:]))
		must(err, "tạo trạm Edge "+st.name)
	}

	roleID := func(code string) uuid.UUID {
		var id uuid.UUID
		must(pool.QueryRow(ctx, `SELECT id FROM station.role WHERE tenant_id = $1 AND code = $2`, tenantID, code).Scan(&id), "tra vai trò "+code)
		return id
	}

	users := []struct {
		id, name, email, phone, password, role string
	}{
		// Quản trị hệ thống (bên triển khai): vai trò cao nhất, quản lý được cả tài khoản Quản lý.
		{"33333333-3333-3333-3333-333333333337", "Lê Hoàng Nam", "quantri@petrovn.vn", "0908552310", "Admin@123456", "ADMIN"},
		{adminUserID, "Nguyễn Văn Quản Lý", "admin@petrovn.vn", "0901234567", "Admin@123456", "MANAGER"},
		{accountantID, "Trần Thị Thu Hà", "ketoan@petrovn.vn", "0912345678", "Accountant@123456", "ACCOUNTANT"},
		{itUserID, "Phạm Minh Tuấn", "it@petrovn.vn", "0987654321", "TechIT@123456", "IT"},
		// Thêm các Quản lý khác: phiếu nhập phải do người khác lập mới duyệt được.
		{"33333333-3333-3333-3333-333333333334", "Trần Đức Thắng", "thang.td@petrovn.vn", "0913556201", "Manager@123456", "MANAGER"},
		{"33333333-3333-3333-3333-333333333335", "Đỗ Quang Huy", "huy.dq@petrovn.vn", "0904118472", "Manager@123456", "MANAGER"},
		{"33333333-3333-3333-3333-333333333336", "Võ Thị Thanh Hương", "huong.vtt@petrovn.vn", "0935227619", "Manager@123456", "MANAGER"},
	}

	for _, u := range users {
		password := u.password
		if seedPassword != "" {
			password = seedPassword
		}
		hash, err := crypto.HashPassword(password)
		must(err, "băm mật khẩu "+u.email)
		_, err = pool.Exec(ctx, `
			INSERT INTO station.app_user (id, tenant_id, employee_code, full_name, email, phone, username, password_hash, role_id, status, must_change_password)
			VALUES ($1, $2, station.next_code($2, 'NV'), $3, $4, $5, $6, $7, $8, 'active', FALSE)
			ON CONFLICT (tenant_id, id) DO NOTHING`,
			uuid.MustParse(u.id), tenantID, u.name, u.email, u.phone, u.email, hash, roleID(u.role))
		must(err, "tạo tài khoản "+u.email)
	}

	fmt.Println("Đã nạp dữ liệu nền: 1 công ty, 3 vai trò, 6 tài khoản, 3 trạm xăng và 3 trạm Edge.")
}

// seedAdminOnly tạo duy nhất một tài khoản Quản trị hệ thống (ADMIN) cho công ty đang có trên server.
// Đọc từ biến môi trường ADMIN_EMAIL, ADMIN_NAME, ADMIN_PASSWORD (mật khẩu lấy từ secret, không ghi vào mã nguồn hay nhật ký).
// An toàn khi chạy lại: tài khoản đã có thì giữ nguyên, không đổi mật khẩu.
func seedAdminOnly(ctx context.Context, pool *pgxpool.Pool) {
	email := strings.ToLower(strings.TrimSpace(os.Getenv("ADMIN_EMAIL")))
	name := strings.TrimSpace(os.Getenv("ADMIN_NAME"))
	password := os.Getenv("ADMIN_PASSWORD")
	if email == "" || name == "" {
		must(fmt.Errorf("thiếu ADMIN_EMAIL hoặc ADMIN_NAME"), "đọc thông tin tài khoản")
	}
	if len(password) < 6 {
		must(fmt.Errorf("ADMIN_PASSWORD phải từ 6 ký tự trở lên"), "kiểm tra mật khẩu")
	}

	// Phải đúng một công ty: nhiều công ty thì không đoán được tài khoản thuộc công ty nào.
	var tenantID uuid.UUID
	var tenantCount int
	must(pool.QueryRow(ctx, `SELECT count(*), coalesce(min(id::text), '00000000-0000-0000-0000-000000000000')::uuid FROM station.tenant`).Scan(&tenantCount, &tenantID), "tra công ty")
	if tenantCount != 1 {
		must(fmt.Errorf("server có %d công ty, cần đúng 1", tenantCount), "xác định công ty")
	}

	var exists bool
	must(pool.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM station.app_user WHERE tenant_id = $1 AND lower(email) = $2 AND deleted_at IS NULL)`, tenantID, email).Scan(&exists), "kiểm tra email")
	if exists {
		fmt.Println("Tài khoản", email, "đã tồn tại, giữ nguyên (không đổi mật khẩu).")
		return
	}

	var roleID uuid.UUID
	must(pool.QueryRow(ctx, `SELECT id FROM station.role WHERE tenant_id = $1 AND code = 'ADMIN'`, tenantID).Scan(&roleID), "tra vai trò ADMIN (cần chạy migration 000018 trước)")

	hash, err := crypto.HashPassword(password)
	must(err, "băm mật khẩu")
	_, err = pool.Exec(ctx, `
		INSERT INTO station.app_user (id, tenant_id, employee_code, full_name, email, username, password_hash, role_id, status, must_change_password)
		VALUES ($1, $2, station.next_code($2, 'NV'), $3, $4, $4, $5, $6, 'active', FALSE)`,
		uuid.New(), tenantID, name, email, hash, roleID)
	must(err, "tạo tài khoản Quản trị hệ thống")
	fmt.Println("Đã tạo tài khoản Quản trị hệ thống:", email)
}
