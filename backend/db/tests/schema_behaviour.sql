-- Kiểm tra hành vi của schema `station` (chạy trên DB trống đã áp mọi migration):
--   psql -v ON_ERROR_STOP=1 -f db/tests/schema_behaviour.sql <DB>
-- Mỗi khối `expect_error` phải GÂY LỖI đúng như thiết kế; nếu không lỗi thì kiểm tra thất bại. Toàn bộ chạy trong một giao dịch và ROLLBACK ở cuối.

BEGIN;
SET search_path = station, public;

-- Hàm hỗ trợ: chạy một câu lệnh, yêu cầu nó BÁO LỖI với mã SQLSTATE cho trước.
CREATE FUNCTION pg_temp.expect_error(p_sql TEXT, p_state TEXT, p_label TEXT) RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
    BEGIN
        EXECUTE p_sql;
    EXCEPTION WHEN OTHERS THEN
        IF SQLSTATE = p_state THEN
            RAISE NOTICE 'OK   %', p_label;
            RETURN;
        END IF;
        RAISE EXCEPTION 'FAIL % : lỗi % thay vì %: %', p_label, SQLSTATE, p_state, SQLERRM;
    END;
    RAISE EXCEPTION 'FAIL % : lẽ ra phải báo lỗi', p_label;
END;
$$;

-- ---- dữ liệu nền: 2 tenant ----
CREATE TEMP TABLE ids (k TEXT PRIMARY KEY, v UUID);
DO $$
DECLARE
    t1 UUID; t2 UUID; b1 UUID; b2 UUID; f1 UUID; f2 UUID; tk1 UUID; tk2 UUID; r_manager UUID; u1 UUID; u2 UUID;
BEGIN
    INSERT INTO tenant (code, name) VALUES ('CTY1', 'Công ty 1') RETURNING id INTO t1;
    INSERT INTO tenant (code, name) VALUES ('CTY2', 'Công ty 2') RETURNING id INTO t2;
    PERFORM seed_tenant_defaults(t1);
    PERFORM seed_tenant_defaults(t2);
    INSERT INTO branch (tenant_id, code, name) VALUES (t1, 'TRAM1', 'Trạm 1') RETURNING id INTO b1;
    INSERT INTO branch (tenant_id, code, name) VALUES (t2, 'TRAM2', 'Trạm 2') RETURNING id INTO b2;
    INSERT INTO fuel_type (tenant_id, code, name) VALUES (t1, 'DO', 'Dầu DO') RETURNING id INTO f1;
    INSERT INTO fuel_type (tenant_id, code, name) VALUES (t2, 'DO', 'Dầu DO') RETURNING id INTO f2;
    INSERT INTO tank (tenant_id, branch_id, code, name, fuel_type_id, design_capacity_ml, max_usable_capacity_ml, low_stock_threshold_ml)
        VALUES (t1, b1, 'BE1', 'Bể 1', f1, 10000000, 9000000, 1000000) RETURNING id INTO tk1;
    INSERT INTO tank (tenant_id, branch_id, code, name, fuel_type_id, design_capacity_ml, max_usable_capacity_ml)
        VALUES (t2, b2, 'BE1', 'Bể 1', f2, 10000000, 9000000) RETURNING id INTO tk2;
    SELECT id INTO r_manager FROM role WHERE tenant_id = t1 AND code = 'MANAGER';
    INSERT INTO app_user (tenant_id, employee_code, full_name, email, username, password_hash, role_id)
        VALUES (t1, 'NV1', 'Quản lý A', 'a@x.vn', 'quanly_a', 'hash', r_manager) RETURNING id INTO u1;
    INSERT INTO app_user (tenant_id, employee_code, full_name, email, username, password_hash, role_id)
        VALUES (t1, 'NV2', 'Quản lý B', 'b@x.vn', 'quanly_b', 'hash', r_manager) RETURNING id INTO u2;
    INSERT INTO ids VALUES ('t1', t1), ('t2', t2), ('b1', b1), ('b2', b2), ('f1', f1), ('f2', f2), ('tk1', tk1), ('tk2', tk2), ('u1', u1), ('u2', u2);
END;
$$;

-- ---- 1. Vai trò mặc định đúng ma trận 3 actor ----
DO $$
DECLARE t1 UUID := (SELECT v FROM ids WHERE k = 't1');
BEGIN
    ASSERT (SELECT count(*) FROM role WHERE tenant_id = t1) = 3, 'phải có 3 vai trò hệ thống';
    ASSERT NOT EXISTS (SELECT 1 FROM role_permission rp JOIN role r ON r.id = rp.role_id
                        WHERE r.tenant_id = t1 AND r.code = 'IT' AND rp.permission_code NOT LIKE '%:view'), 'IT chỉ được quyền xem';
    ASSERT NOT EXISTS (SELECT 1 FROM role_permission rp JOIN role r ON r.id = rp.role_id
                        WHERE r.tenant_id = t1 AND r.code = 'IT' AND rp.permission_code LIKE 'iam.%'), 'IT không có quyền tài khoản, vai trò';
    ASSERT EXISTS (SELECT 1 FROM role_permission rp JOIN role r ON r.id = rp.role_id
                    WHERE r.tenant_id = t1 AND r.code = 'MANAGER' AND rp.permission_code = 'iam.role:update'), 'Quản lý có quyền phân quyền';
    ASSERT EXISTS (SELECT 1 FROM role_permission rp JOIN role r ON r.id = rp.role_id
                    WHERE r.tenant_id = t1 AND r.code = 'MANAGER' AND rp.permission_code = 'asset.device:update'), 'Quản lý sửa được thiết bị';
    ASSERT NOT EXISTS (SELECT 1 FROM role_permission rp JOIN role r ON r.id = rp.role_id
                        WHERE r.tenant_id = t1 AND r.code = 'IT' AND rp.permission_code LIKE 'asset.%' AND rp.permission_code NOT LIKE '%:view'), 'IT không sửa trụ, bể, thiết bị';
    ASSERT EXISTS (SELECT 1 FROM role_permission rp JOIN role r ON r.id = rp.role_id
                    WHERE r.tenant_id = t1 AND r.code = 'ACCOUNTANT' AND rp.permission_code = 'inventory.issue:approve'), 'Kế toán duyệt phiếu xuất';
    ASSERT NOT EXISTS (SELECT 1 FROM role_permission rp JOIN role r ON r.id = rp.role_id
                        WHERE r.tenant_id = t1 AND r.code = 'MANAGER' AND rp.permission_code = 'inventory.issue:approve'), 'Quản lý không duyệt phiếu xuất';
    RAISE NOTICE 'OK   vai trò và quyền khớp ma trận 3 actor';
END;
$$;

-- ---- 2. Cô lập tenant bằng FK ghép ----
SELECT pg_temp.expect_error(format(
    $q$INSERT INTO tank (tenant_id, branch_id, code, name, fuel_type_id, design_capacity_ml, max_usable_capacity_ml)
       VALUES (%L, %L, 'X', 'X', %L, 1000, 1000)$q$,
    (SELECT v FROM ids WHERE k = 't1'), (SELECT v FROM ids WHERE k = 'b2'), (SELECT v FROM ids WHERE k = 'f1')),
    '23503', 'bể của tenant 1 không gắn được chi nhánh của tenant 2');

-- ---- 3. Mã trùng trong tenant bị chặn, khác tenant thì được ----
SELECT pg_temp.expect_error(format(
    $q$INSERT INTO fuel_type (tenant_id, code, name) VALUES (%L, 'DO', 'trùng')$q$, (SELECT v FROM ids WHERE k = 't1')),
    '23505', 'trùng mã loại nhiên liệu trong tenant');

-- ---- 4. Thẻ: xe chỉ có thẻ; một số thẻ chỉ một chủ đang hiệu lực ----
DO $$
DECLARE t1 UUID := (SELECT v FROM ids WHERE k = 't1'); b1 UUID := (SELECT v FROM ids WHERE k = 'b1'); f1 UUID := (SELECT v FROM ids WHERE k = 'f1');
        v1 UUID; v2 UUID; d1 UUID;
BEGIN
    INSERT INTO vehicle (tenant_id, code, plate, fuel_type_id) VALUES (t1, 'VEH0001', '51A-123.45', f1) RETURNING id INTO v1;
    INSERT INTO vehicle (tenant_id, code, plate, fuel_type_id) VALUES (t1, 'VEH0002', '51A-678.90', f1) RETURNING id INTO v2;
    INSERT INTO vehicle_branch (tenant_id, vehicle_id, branch_id) VALUES (t1, v1, b1);
    INSERT INTO driver (tenant_id, code, full_name) VALUES (t1, 'DRV0001', 'Bùi Đình Tuấn') RETURNING id INTO d1;
    INSERT INTO credential (tenant_id, vehicle_id, method, external_id) VALUES (t1, v1, 'card', '3862658937');
    INSERT INTO credential (tenant_id, driver_id, method, external_id) VALUES (t1, d1, 'face', 'DRV0001');
    INSERT INTO ids VALUES ('v1', v1), ('v2', v2), ('d1', d1);
END;
$$;
SELECT pg_temp.expect_error(format(
    $q$INSERT INTO credential (tenant_id, vehicle_id, method, external_id) VALUES (%L, %L, 'face', 'VEH0001')$q$,
    (SELECT v FROM ids WHERE k = 't1'), (SELECT v FROM ids WHERE k = 'v1')), '23514', 'xe không có mặt/vân tay');
SELECT pg_temp.expect_error(format(
    $q$INSERT INTO credential (tenant_id, vehicle_id, method, external_id) VALUES (%L, %L, 'card', '3862658937')$q$,
    (SELECT v FROM ids WHERE k = 't1'), (SELECT v FROM ids WHERE k = 'v2')), '23505', 'một số thẻ chỉ một chủ đang hiệu lực');
SELECT pg_temp.expect_error(format(
    $q$INSERT INTO vehicle (tenant_id, code, plate, fuel_type_id) VALUES (%L, 'VEH-0003', 'X', %L)$q$,
    (SELECT v FROM ids WHERE k = 't1'), (SELECT v FROM ids WHERE k = 'f1')), '23514', 'mã xe chỉ chữ và số (employeeNo của máy chấm công)');

-- ---- 5. Đồng bộ: version tăng, nhật ký thay đổi ghi đúng ----
DO $$
DECLARE v1 UUID := (SELECT v FROM ids WHERE k = 'v1'); ver0 BIGINT; ver BIGINT; n0 BIGINT; n BIGINT;
BEGIN
    SELECT version INTO ver0 FROM vehicle WHERE id = v1;
    SELECT count(*) INTO n0 FROM sync_change_log WHERE entity_type = 'vehicle' AND entity_id = v1;
    UPDATE vehicle SET note = 'đổi ghi chú' WHERE id = v1;
    SELECT version INTO ver FROM vehicle WHERE id = v1;
    ASSERT ver = ver0 + 1, 'version phải tăng thêm 1 sau mỗi lần sửa';
    SELECT count(*) INTO n FROM sync_change_log WHERE entity_type = 'vehicle' AND entity_id = v1;
    ASSERT n = n0 + 1, 'mỗi lần sửa phải ghi thêm một dòng nhật ký đồng bộ';
    UPDATE vehicle SET deleted_at = now() WHERE id = v1;
    ASSERT (SELECT deleted FROM sync_change_log WHERE entity_id = v1 ORDER BY seq DESC LIMIT 1), 'xóa mềm phải đánh dấu deleted';
    UPDATE vehicle SET deleted_at = NULL WHERE id = v1;
    RAISE NOTICE 'OK   version và nhật ký đồng bộ';
END;
$$;

-- ---- 6. Sổ thẻ kho: tồn đầu, nhập, xuất, chặn âm, chặn vượt dung tích, bất biến ----
DO $$
DECLARE t1 UUID := (SELECT v FROM ids WHERE k = 't1'); tk1 UUID := (SELECT v FROM ids WHERE k = 'tk1');
BEGIN
    INSERT INTO stock_ledger (tenant_id, tank_id, kind, delta_ml) VALUES (t1, tk1, 'opening', 5000000);
    INSERT INTO stock_ledger (tenant_id, tank_id, kind, delta_ml) VALUES (t1, tk1, 'receipt', 2000000);
    INSERT INTO stock_ledger (tenant_id, tank_id, kind, delta_ml) VALUES (t1, tk1, 'dispense', -25825);
    ASSERT (SELECT stock_ml FROM tank_stock WHERE tank_id = tk1) = 6974175, 'tồn phải là 5.000.000 + 2.000.000 - 25.825';
    ASSERT (SELECT seq FROM stock_ledger WHERE tank_id = tk1 ORDER BY seq DESC LIMIT 1) = 3, 'seq liên tục';
    RAISE NOTICE 'OK   số dư thẻ kho';
END;
$$;
SELECT pg_temp.expect_error(format(
    $q$INSERT INTO stock_ledger (tenant_id, tank_id, kind, delta_ml) VALUES (%L, %L, 'dispense', -99999999)$q$,
    (SELECT v FROM ids WHERE k = 't1'), (SELECT v FROM ids WHERE k = 'tk1')), '23514', 'không xuất quá tồn (tồn không âm)');
SELECT pg_temp.expect_error(format(
    $q$INSERT INTO stock_ledger (tenant_id, tank_id, kind, delta_ml) VALUES (%L, %L, 'receipt', 3000000)$q$,
    (SELECT v FROM ids WHERE k = 't1'), (SELECT v FROM ids WHERE k = 'tk1')), '23514', 'không nhập vượt dung tích khả dụng tối đa');
SELECT pg_temp.expect_error(format(
    $q$INSERT INTO stock_ledger (tenant_id, tank_id, kind, delta_ml) VALUES (%L, %L, 'opening', 1)$q$,
    (SELECT v FROM ids WHERE k = 't1'), (SELECT v FROM ids WHERE k = 'tk1')), '23514', 'chỉ một tồn đầu kỳ');
SELECT pg_temp.expect_error(format(
    $q$INSERT INTO stock_ledger (tenant_id, tank_id, kind, delta_ml) VALUES (%L, %L, 'receipt', -5)$q$,
    (SELECT v FROM ids WHERE k = 't1'), (SELECT v FROM ids WHERE k = 'tk1')), '23514', 'nhập phải có số lượng dương');
SELECT pg_temp.expect_error('UPDATE station.stock_ledger SET delta_ml = 1', '23001', 'sổ thẻ kho không sửa được');
SELECT pg_temp.expect_error('DELETE FROM station.stock_ledger', '23001', 'sổ thẻ kho không xóa được');
SELECT pg_temp.expect_error(format(
    $q$INSERT INTO stock_ledger (tenant_id, tank_id, kind, delta_ml) VALUES (%L, %L, 'opening', 1000)$q$,
    (SELECT v FROM ids WHERE k = 't1'), (SELECT v FROM ids WHERE k = 'tk2')), '23503', 'ghi sổ chéo tenant bị chặn');

-- ---- 7. Phiếu nhập: loại nhiên liệu phải khớp bể; chặn tự duyệt; duyệt xong không sửa ----
DO $$
DECLARE t1 UUID := (SELECT v FROM ids WHERE k = 't1'); b1 UUID := (SELECT v FROM ids WHERE k = 'b1'); tk1 UUID := (SELECT v FROM ids WHERE k = 'tk1');
        f1 UUID := (SELECT v FROM ids WHERE k = 'f1'); u1 UUID := (SELECT v FROM ids WHERE k = 'u1'); u2 UUID := (SELECT v FROM ids WHERE k = 'u2');
        r UUID; code TEXT;
BEGIN
    code := next_code(t1, 'PN');
    ASSERT code ~ '^PN-[0-9]{4}-0001$', 'mã chứng từ đầu tiên';
    ASSERT next_code(t1, 'PN') ~ '-0002$', 'mã chứng từ kế tiếp';
    INSERT INTO stock_receipt (tenant_id, branch_id, code, received_at, status, created_by)
        VALUES (t1, b1, code, now(), 'pending', u1) RETURNING id INTO r;
    INSERT INTO stock_receipt_line (tenant_id, receipt_id, tank_id, fuel_type_id, document_volume_ml, actual_volume_ml)
        VALUES (t1, r, tk1, f1, 1000000, 998500);
    ASSERT (SELECT variance_ml FROM stock_receipt_line WHERE receipt_id = r) = -1500, 'chênh lệch nhập = thực nhận - chứng từ';
    INSERT INTO ids VALUES ('receipt', r);
    RAISE NOTICE 'OK   phiếu nhập và chênh lệch nhập';
END;
$$;
SELECT pg_temp.expect_error(format(
    $q$UPDATE stock_receipt SET status = 'approved', decided_by = %L, decided_at = now() WHERE id = %L$q$,
    (SELECT v FROM ids WHERE k = 'u1'), (SELECT v FROM ids WHERE k = 'receipt')), '23514', 'người lập không tự duyệt phiếu mình');
DO $$
DECLARE r UUID := (SELECT v FROM ids WHERE k = 'receipt'); u2 UUID := (SELECT v FROM ids WHERE k = 'u2');
BEGIN
    UPDATE stock_receipt SET status = 'approved', decided_by = u2, decided_at = now() WHERE id = r;
    RAISE NOTICE 'OK   người khác duyệt được';
END;
$$;
SELECT pg_temp.expect_error(format($q$UPDATE stock_receipt SET note = 'sửa sau duyệt' WHERE id = %L$q$, (SELECT v FROM ids WHERE k = 'receipt')),
    '23001', 'phiếu đã duyệt không sửa được');
SELECT pg_temp.expect_error(format($q$DELETE FROM stock_receipt WHERE id = %L$q$, (SELECT v FROM ids WHERE k = 'receipt')),
    '23001', 'phiếu đã duyệt không xóa được');

-- ---- 8. Cho phép tự duyệt khi tenant bật ----
DO $$
DECLARE t1 UUID := (SELECT v FROM ids WHERE k = 't1'); b1 UUID := (SELECT v FROM ids WHERE k = 'b1'); u1 UUID := (SELECT v FROM ids WHERE k = 'u1'); r UUID;
BEGIN
    UPDATE tenant_setting SET allow_self_approval = TRUE WHERE tenant_id = t1;
    INSERT INTO stock_receipt (tenant_id, branch_id, code, received_at, status, created_by)
        VALUES (t1, b1, next_code(t1, 'PN'), now(), 'pending', u1) RETURNING id INTO r;
    UPDATE stock_receipt SET status = 'approved', decided_by = u1, decided_at = now() WHERE id = r;
    UPDATE tenant_setting SET allow_self_approval = FALSE WHERE tenant_id = t1;
    RAISE NOTICE 'OK   tenant bật cho phép tự duyệt thì duyệt được';
END;
$$;

-- ---- 9. Dòng nhập sai loại nhiên liệu bị chặn ----
DO $$
DECLARE t1 UUID := (SELECT v FROM ids WHERE k = 't1'); b1 UUID := (SELECT v FROM ids WHERE k = 'b1'); u1 UUID := (SELECT v FROM ids WHERE k = 'u1');
        tk1 UUID := (SELECT v FROM ids WHERE k = 'tk1'); f_other UUID; r UUID;
BEGIN
    INSERT INTO fuel_type (tenant_id, code, name) VALUES (t1, 'A95', 'Xăng A95') RETURNING id INTO f_other;
    INSERT INTO stock_receipt (tenant_id, branch_id, code, received_at, created_by) VALUES (t1, b1, next_code(t1, 'PN'), now(), u1) RETURNING id INTO r;
    INSERT INTO ids VALUES ('draft_receipt', r), ('f_other', f_other);
END;
$$;
SELECT pg_temp.expect_error(format(
    $q$INSERT INTO stock_receipt_line (tenant_id, receipt_id, tank_id, fuel_type_id, document_volume_ml, actual_volume_ml) VALUES (%L, %L, %L, %L, 1000, 1000)$q$,
    (SELECT v FROM ids WHERE k = 't1'), (SELECT v FROM ids WHERE k = 'draft_receipt'), (SELECT v FROM ids WHERE k = 'tk1'), (SELECT v FROM ids WHERE k = 'f_other')),
    '23514', 'nhập sai loại nhiên liệu của bể bị chặn');

-- ---- 10. Audit log bất biến ----
INSERT INTO audit_log (tenant_id, actor_name, action, entity_type) VALUES ((SELECT v FROM ids WHERE k = 't1'), 'Quản lý A', 'create', 'vehicle');
SELECT pg_temp.expect_error('UPDATE station.audit_log SET actor_name = ''x''', '23001', 'audit log không sửa được');
SELECT pg_temp.expect_error('DELETE FROM station.audit_log', '23001', 'audit log không xóa được');
SELECT pg_temp.expect_error('TRUNCATE station.audit_log', '23001', 'audit log không TRUNCATE được');

-- ---- 11. Phiên đổ: idempotency và dedupe lần bơm ----
DO $$
DECLARE t1 UUID := (SELECT v FROM ids WHERE k = 't1'); b1 UUID := (SELECT v FROM ids WHERE k = 'b1'); tk1 UUID := (SELECT v FROM ids WHERE k = 'tk1');
        es UUID; p UUID;
BEGIN
    INSERT INTO edge_station (tenant_id, branch_id, code, name) VALUES (t1, b1, 'TRAM-01', 'Trạm 1') RETURNING id INTO es;
    INSERT INTO pump (tenant_id, branch_id, code, edge_pump_id, name) VALUES (t1, b1, 'PUMP-01', 1, 'Trụ 1') RETURNING id INTO p;
    INSERT INTO pump_sensor (tenant_id, pump_id, branch_id, name, serial, com_port) VALUES (t1, p, b1, 'Bộ số trụ 1', 1234, 'COM7');
    INSERT INTO access_terminal (tenant_id, pump_id, terminal_code, host, username, password_enc) VALUES (t1, p, 'T1', '192.168.1.17', 'admin', '\x00');
    INSERT INTO dispense_session (tenant_id, branch_id, edge_station_id, code, edge_ref, pump_id, tank_id, pump_name, dispensed_ml, sensor_serial, sale_seq, edge_state, status)
        VALUES (t1, b1, es, next_code(t1, 'GD'), 'sale:1234:52', p, tk1, 'Trụ 1', 4410, 1234, 52, 'completed', 'completed');
    INSERT INTO ids VALUES ('es', es), ('pump', p);
    RAISE NOTICE 'OK   phiên đổ đầu tiên';
END;
$$;
SELECT pg_temp.expect_error(format(
    $q$INSERT INTO dispense_session (tenant_id, branch_id, edge_station_id, code, edge_ref, pump_id, pump_name, dispensed_ml, edge_state, status)
       VALUES (%L, %L, %L, 'GD-X', 'sale:1234:52', %L, 'Trụ 1', 4410, 'completed', 'completed')$q$,
    (SELECT v FROM ids WHERE k = 't1'), (SELECT v FROM ids WHERE k = 'b1'), (SELECT v FROM ids WHERE k = 'es'), (SELECT v FROM ids WHERE k = 'pump')),
    '23505', 'gửi lại cùng edge_ref không tạo phiên mới');
SELECT pg_temp.expect_error(format(
    $q$INSERT INTO dispense_session (tenant_id, branch_id, edge_station_id, code, edge_ref, pump_id, pump_name, dispensed_ml, sensor_serial, sale_seq, edge_state, status)
       VALUES (%L, %L, %L, 'GD-Y', 'khac', %L, 'Trụ 1', 4410, 1234, 52, 'completed', 'completed')$q$,
    (SELECT v FROM ids WHERE k = 't1'), (SELECT v FROM ids WHERE k = 'b1'), (SELECT v FROM ids WHERE k = 'es'), (SELECT v FROM ids WHERE k = 'pump')),
    '23505', 'một lần bơm của một trụ chỉ ghi một lần');
SELECT pg_temp.expect_error(format(
    $q$INSERT INTO dispense_session (tenant_id, branch_id, edge_station_id, code, edge_ref, pump_id, pump_name, dispensed_ml, edge_state, status)
       VALUES (%L, %L, %L, 'GD-Z', 'z', %L, 'Trụ 1', 100, 'timed_out', 'cancelled')$q$,
    (SELECT v FROM ids WHERE k = 't1'), (SELECT v FROM ids WHERE k = 'b1'), (SELECT v FROM ids WHERE k = 'es'), (SELECT v FROM ids WHERE k = 'pump')),
    '23514', 'phiên đã hủy phải có số lít bằng 0');

-- ---- 12. Định mức: bắt buộc có xe ----
SELECT pg_temp.expect_error(format(
    $q$INSERT INTO quota_rule (tenant_id, code, period, max_volume_ml, effective_from) VALUES (%L, 'Q1', 'day', 100000, current_date)$q$,
    (SELECT v FROM ids WHERE k = 't1')), '23502', 'định mức phải gắn với một xe');

-- ---- 13. Kiểm kê: sổ sách phải khớp công thức ----
SELECT pg_temp.expect_error(format(
    $q$INSERT INTO stock_reconciliation (tenant_id, branch_id, tank_id, period_date, opening_ml, receipts_ml, dispensed_ml, other_issues_ml, book_closing_ml, tolerance_pct)
       VALUES (%L, %L, %L, current_date, 1000, 500, 200, 0, 999, 0.5)$q$,
    (SELECT v FROM ids WHERE k = 't1'), (SELECT v FROM ids WHERE k = 'b1'), (SELECT v FROM ids WHERE k = 'tk1')),
    '23514', 'tồn cuối sổ sách = tồn đầu + nhập - xuất');

-- ---- 14. Phạm vi cửa hàng theo xe ----
DO $$
DECLARE t1 UUID := (SELECT v FROM ids WHERE k = 't1'); b1 UUID := (SELECT v FROM ids WHERE k = 'b1'); v1 UUID := (SELECT v FROM ids WHERE k = 'v1');
        v2 UUID := (SELECT v FROM ids WHERE k = 'v2'); b_new UUID; ver_before BIGINT; ver_after BIGINT; n BIGINT;
BEGIN
    -- xe không có dòng nào trong vehicle_branch thì không được đổ ở cửa hàng nào
    ASSERT (SELECT count(*) FROM vehicle_branch WHERE vehicle_id = v2) = 0, 'xe mới chưa được phép ở cửa hàng nào';

    -- thêm cửa hàng được phép: version của xe tăng và có dòng nhật ký đồng bộ mới
    INSERT INTO branch (tenant_id, code, name) VALUES (t1, 'TRAM9', 'Trạm 9') RETURNING id INTO b_new;
    SELECT version INTO ver_before FROM vehicle WHERE id = v1;
    SELECT count(*) INTO n FROM sync_change_log WHERE entity_type = 'vehicle' AND entity_id = v1;
    INSERT INTO vehicle_branch (tenant_id, vehicle_id, branch_id) VALUES (t1, v1, b_new);
    SELECT version INTO ver_after FROM vehicle WHERE id = v1;
    ASSERT ver_after = ver_before + 1, 'thêm cửa hàng được phép phải tăng version của xe';
    ASSERT (SELECT count(*) FROM sync_change_log WHERE entity_type = 'vehicle' AND entity_id = v1) = n + 1, 'phải ghi nhật ký đồng bộ';

    -- bỏ cửa hàng: cũng tăng version
    DELETE FROM vehicle_branch WHERE vehicle_id = v1 AND branch_id = b_new;
    ASSERT (SELECT version FROM vehicle WHERE id = v1) = ver_after + 1, 'gỡ cửa hàng được phép phải tăng version của xe';
    RAISE NOTICE 'OK   xe nhiều-nhiều cửa hàng được phép, đổi là đồng bộ lại';
END;
$$;
SELECT pg_temp.expect_error(format(
    $q$INSERT INTO vehicle_branch (tenant_id, vehicle_id, branch_id) VALUES (%L, %L, %L)$q$,
    (SELECT v FROM ids WHERE k = 't1'), (SELECT v FROM ids WHERE k = 'v1'), (SELECT v FROM ids WHERE k = 'b1')),
    '23505', 'một xe không được phép trùng một cửa hàng hai lần');
SELECT pg_temp.expect_error(format(
    $q$INSERT INTO vehicle_branch (tenant_id, vehicle_id, branch_id) VALUES (%L, %L, %L)$q$,
    (SELECT v FROM ids WHERE k = 't1'), (SELECT v FROM ids WHERE k = 'v2'), (SELECT v FROM ids WHERE k = 'b2')),
    '23503', 'xe không gắn được cửa hàng của công ty khác');

-- ---- 15. Mỗi trụ một cổng COM, serial được trùng ----
DO $$
DECLARE t1 UUID := (SELECT v FROM ids WHERE k = 't1'); b1 UUID := (SELECT v FROM ids WHERE k = 'b1'); p2 UUID;
BEGIN
    INSERT INTO pump (tenant_id, branch_id, code, edge_pump_id, name) VALUES (t1, b1, 'PUMP-02', 2, 'Trụ 2') RETURNING id INTO p2;
    -- cùng serial 1234 nhưng cổng COM khác: được
    INSERT INTO pump_sensor (tenant_id, pump_id, branch_id, name, serial, com_port) VALUES (t1, p2, b1, 'Bộ số trụ 2', 1234, 'COM8');
    INSERT INTO ids VALUES ('pump2', p2);
    -- trụ thứ ba chưa có bộ số, dùng cho các kiểm tra bên dưới
    INSERT INTO pump (tenant_id, branch_id, code, edge_pump_id, name) VALUES (t1, b1, 'PUMP-03', 3, 'Trụ 3') RETURNING id INTO p2;
    INSERT INTO ids VALUES ('pump3', p2);
    RAISE NOTICE 'OK   hai bộ số cùng serial 1234 trên hai cổng COM khác nhau';
END;
$$;
SELECT pg_temp.expect_error(format(
    $q$UPDATE pump_sensor SET com_port = 'com7' WHERE pump_id = %L$q$, (SELECT v FROM ids WHERE k = 'pump2')),
    '23505', 'hai trụ cùng cửa hàng không dùng chung một cổng COM (không phân biệt hoa thường)');
SELECT pg_temp.expect_error(format(
    $q$INSERT INTO pump_sensor (tenant_id, pump_id, branch_id, name, serial, com_port) VALUES (%L, %L, %L, 'x', 1, 'COM9')$q$,
    (SELECT v FROM ids WHERE k = 't1'), (SELECT v FROM ids WHERE k = 'pump3'), (SELECT v FROM ids WHERE k = 'b2')),
    '23503', 'bộ số phải cùng cửa hàng với trụ');
SELECT pg_temp.expect_error(format(
    $q$INSERT INTO pump_sensor (tenant_id, pump_id, branch_id, name, serial, com_port) VALUES (%L, %L, %L, '  ', 1, 'COM11')$q$,
    (SELECT v FROM ids WHERE k = 't1'), (SELECT v FROM ids WHERE k = 'pump3'), (SELECT v FROM ids WHERE k = 'b1')),
    '23514', 'bộ số phải có tên');

-- ---- 16. Lần bơm theo (trụ, số thứ tự): hai trụ cùng serial không đụng nhau ----
DO $$
DECLARE t1 UUID := (SELECT v FROM ids WHERE k = 't1'); b1 UUID := (SELECT v FROM ids WHERE k = 'b1'); es UUID := (SELECT v FROM ids WHERE k = 'es');
        p2 UUID := (SELECT v FROM ids WHERE k = 'pump2');
BEGIN
    INSERT INTO dispense_session (tenant_id, branch_id, edge_station_id, code, edge_ref, pump_id, pump_name, dispensed_ml, sensor_serial, sale_seq, edge_state, status)
        VALUES (t1, b1, es, next_code(t1, 'GD'), 'sale:pump2:52', p2, 'Trụ 2', 1000, 1234, 52, 'completed', 'completed');
    RAISE NOTICE 'OK   cùng serial và cùng số thứ tự nhưng khác trụ vẫn ghi được';
END;
$$;

DO $$ BEGIN RAISE NOTICE '=== TẤT CẢ KIỂM TRA SCHEMA ĐẠT ==='; END; $$;
ROLLBACK;
