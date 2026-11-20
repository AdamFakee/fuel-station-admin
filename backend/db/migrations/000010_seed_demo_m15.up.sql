-- 000010_seed_demo_m15.up.sql
-- Seed dữ liệu mẫu hoàn chỉnh (Module M15) phục vụ kiểm thử, demo toàn diện và vận hành:
-- 1. Nhà cung cấp (Petrolimex, PVOIL)
-- 2. Bể chứa chuẩn (TK-DO-01, TK-DO-02, TK-A95-01) kèm tồn đầu kỳ
-- 3. Trụ bơm, vòi bơm, bộ số Montech RS-485 và máy chấm công Hikvision
-- 4. Định mức cấp phát nhiên liệu (Quota rules)

DO $$
DECLARE
    v_tenant_id UUID;
    v_branch_id UUID;
    v_u_manager UUID;
    v_u_accountant UUID;
    v_fuel_do_id UUID;
    v_fuel_a95_id UUID;
    v_tank_do_1_id UUID;
    v_tank_do_2_id UUID;
    v_tank_a95_1_id UUID;
    v_pump_1_id UUID;
    v_pump_2_id UUID;
    v_sup_petro_id UUID;
    v_sup_pvoil_id UUID;
    v_group_1_id UUID;
    v_route_1_id UUID;
    v_edge_pump_id BIGINT;
BEGIN
    -- Tìm tenant hiện hữu (PETRO-VN hoặc CTY-01)
    SELECT id INTO v_tenant_id FROM station.tenant WHERE code IN ('PETRO-VN', 'CTY-01') ORDER BY created_at ASC LIMIT 1;
    IF v_tenant_id IS NOT NULL THEN
        SELECT id INTO v_branch_id FROM station.branch WHERE tenant_id = v_tenant_id AND code IN ('BR-01', 'TRAM-01') ORDER BY created_at ASC LIMIT 1;
        SELECT id INTO v_u_manager FROM station.app_user WHERE tenant_id = v_tenant_id AND username IN ('admin', 'quanly') ORDER BY created_at ASC LIMIT 1;
        SELECT id INTO v_u_accountant FROM station.app_user WHERE tenant_id = v_tenant_id AND username = 'ketoan' LIMIT 1;
        SELECT id INTO v_fuel_do_id FROM station.fuel_type WHERE tenant_id = v_tenant_id AND code = 'DO' LIMIT 1;
        SELECT id INTO v_fuel_a95_id FROM station.fuel_type WHERE tenant_id = v_tenant_id AND code = 'A95' LIMIT 1;
        SELECT id INTO v_group_1_id FROM station.vehicle_group WHERE tenant_id = v_tenant_id AND code = 'DOI_1' LIMIT 1;
        SELECT id INTO v_route_1_id FROM station.route WHERE tenant_id = v_tenant_id AND code = 'TUYEN_HN_HP' LIMIT 1;

        -- 1. Suppliers
        INSERT INTO station.supplier (tenant_id, code, name, phone, address, active)
        VALUES 
            (v_tenant_id, 'PETROLIMEX', 'Tập đoàn Xăng dầu Petrolimex', '0241234567', 'Số 1 Khâm Thiên, Đống Đa, Hà Nội', true),
            (v_tenant_id, 'PVOIL', 'Tổng công ty Dầu Việt Nam PVOIL', '0289876543', 'Số 1-5 Lê Duẩn, Quận 1, TP. HCM', true)
        ON CONFLICT (tenant_id, code) DO UPDATE SET name = EXCLUDED.name;

        SELECT id INTO v_sup_petro_id FROM station.supplier WHERE tenant_id = v_tenant_id AND code = 'PETROLIMEX';
        SELECT id INTO v_sup_pvoil_id FROM station.supplier WHERE tenant_id = v_tenant_id AND code = 'PVOIL';

        -- 2. Tanks (Bể chứa)
        -- Bể DO 1: Dung tích 25,000 L, Max 24,000 L
        IF v_fuel_do_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM station.tank WHERE tenant_id = v_tenant_id AND code = 'TK-DO-01') THEN
            INSERT INTO station.tank (
                tenant_id, branch_id, code, name, fuel_type_id,
                design_capacity_ml, max_usable_capacity_ml, low_stock_threshold_ml, loss_tolerance_pct, status
            ) VALUES (
                v_tenant_id, v_branch_id, 'TK-DO-01', 'Bể Dầu DO Số 1', v_fuel_do_id,
                25000000, 24000000, 2000000, 0.5, 'active'
            ) RETURNING id INTO v_tank_do_1_id;

            -- Tồn đầu kỳ 15,000 L
            INSERT INTO station.stock_ledger (
                tenant_id, tank_id, occurred_at, kind, delta_ml, note, created_by
            ) VALUES (
                v_tenant_id, v_tank_do_1_id, now() - INTERVAL '30 days', 'opening', 15000000, 'Tồn đầu kỳ khởi tạo hệ thống', v_u_manager
            );
        ELSE
            SELECT id INTO v_tank_do_1_id FROM station.tank WHERE tenant_id = v_tenant_id AND code = 'TK-DO-01';
        END IF;

        -- Bể DO 2: Dung tích 25,000 L, Max 24,000 L
        IF v_fuel_do_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM station.tank WHERE tenant_id = v_tenant_id AND code = 'TK-DO-02') THEN
            INSERT INTO station.tank (
                tenant_id, branch_id, code, name, fuel_type_id,
                design_capacity_ml, max_usable_capacity_ml, low_stock_threshold_ml, loss_tolerance_pct, status
            ) VALUES (
                v_tenant_id, v_branch_id, 'TK-DO-02', 'Bể Dầu DO Số 2', v_fuel_do_id,
                25000000, 24000000, 2000000, 0.5, 'active'
            ) RETURNING id INTO v_tank_do_2_id;

            -- Tồn đầu kỳ 8,000 L
            INSERT INTO station.stock_ledger (
                tenant_id, tank_id, occurred_at, kind, delta_ml, note, created_by
            ) VALUES (
                v_tenant_id, v_tank_do_2_id, now() - INTERVAL '30 days', 'opening', 8000000, 'Tồn đầu kỳ khởi tạo hệ thống', v_u_manager
            );
        ELSE
            SELECT id INTO v_tank_do_2_id FROM station.tank WHERE tenant_id = v_tenant_id AND code = 'TK-DO-02';
        END IF;

        -- Bể A95 1: Dung tích 20,000 L, Max 19,000 L
        IF v_fuel_a95_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM station.tank WHERE tenant_id = v_tenant_id AND code = 'TK-A95-01') THEN
            INSERT INTO station.tank (
                tenant_id, branch_id, code, name, fuel_type_id,
                design_capacity_ml, max_usable_capacity_ml, low_stock_threshold_ml, loss_tolerance_pct, status
            ) VALUES (
                v_tenant_id, v_branch_id, 'TK-A95-01', 'Bể Xăng A95 Số 1', v_fuel_a95_id,
                20000000, 19000000, 1500000, 0.5, 'active'
            ) RETURNING id INTO v_tank_a95_1_id;

            -- Tồn đầu kỳ 12,000 L
            INSERT INTO station.stock_ledger (
                tenant_id, tank_id, occurred_at, kind, delta_ml, note, created_by
            ) VALUES (
                v_tenant_id, v_tank_a95_1_id, now() - INTERVAL '30 days', 'opening', 12000000, 'Tồn đầu kỳ khởi tạo hệ thống', v_u_manager
            );
        ELSE
            SELECT id INTO v_tank_a95_1_id FROM station.tank WHERE tenant_id = v_tenant_id AND code = 'TK-A95-01';
        END IF;

        -- 3. Pumps, Nozzles, Sensors, Terminals
        -- Trụ 1
        IF NOT EXISTS (SELECT 1 FROM station.pump WHERE tenant_id = v_tenant_id AND code = 'PUMP-01') THEN
            SELECT COALESCE(MAX(edge_pump_id), 0) + 1 INTO v_edge_pump_id FROM station.pump WHERE tenant_id = v_tenant_id AND branch_id = v_branch_id;
            
            INSERT INTO station.pump (
                tenant_id, branch_id, code, edge_pump_id, name, note, enabled
            ) VALUES (
                v_tenant_id, v_branch_id, 'PUMP-01', v_edge_pump_id, 'Trụ bơm Số 1 (DO)', 'Trụ bơm dầu đôi', true
            ) RETURNING id INTO v_pump_1_id;

            -- Vòi bơm 1 -> Bể DO 1
            IF v_tank_do_1_id IS NOT NULL THEN
                INSERT INTO station.nozzle (tenant_id, pump_id, nozzle_no, tank_id, status)
                VALUES (v_tenant_id, v_pump_1_id, 1, v_tank_do_1_id, 'active');
            END IF;

            -- Bộ số Montech RS-485
            IF NOT EXISTS (SELECT 1 FROM station.pump_sensor WHERE pump_id = v_pump_1_id) THEN
                INSERT INTO station.pump_sensor (tenant_id, pump_id, serial, com_port, baud)
                VALUES (v_tenant_id, v_pump_1_id, 1234, 'COM7', 9600);
            END IF;

            -- Máy chấm công Hikvision
            IF NOT EXISTS (SELECT 1 FROM station.access_terminal WHERE tenant_id = v_tenant_id AND terminal_code = 'T1') THEN
                INSERT INTO station.access_terminal (
                    tenant_id, pump_id, terminal_code, host, port, https, username, password_enc
                ) VALUES (
                    v_tenant_id, v_pump_1_id, 'T1', '192.168.1.101', 80, false, 'admin', decode('7465737470617373776f7264', 'hex')
                );
            END IF;
        END IF;

        -- Trụ 2
        IF NOT EXISTS (SELECT 1 FROM station.pump WHERE tenant_id = v_tenant_id AND code = 'PUMP-02') THEN
            SELECT COALESCE(MAX(edge_pump_id), 0) + 1 INTO v_edge_pump_id FROM station.pump WHERE tenant_id = v_tenant_id AND branch_id = v_branch_id;

            INSERT INTO station.pump (
                tenant_id, branch_id, code, edge_pump_id, name, note, enabled
            ) VALUES (
                v_tenant_id, v_branch_id, 'PUMP-02', v_edge_pump_id, 'Trụ bơm Số 2 (A95)', 'Trụ bơm xăng', true
            ) RETURNING id INTO v_pump_2_id;

            -- Vòi bơm 1 -> Bể A95 1
            IF v_tank_a95_1_id IS NOT NULL THEN
                INSERT INTO station.nozzle (tenant_id, pump_id, nozzle_no, tank_id, status)
                VALUES (v_tenant_id, v_pump_2_id, 1, v_tank_a95_1_id, 'active');
            END IF;

            -- Bộ số Montech RS-485
            IF NOT EXISTS (SELECT 1 FROM station.pump_sensor WHERE pump_id = v_pump_2_id) THEN
                INSERT INTO station.pump_sensor (tenant_id, pump_id, serial, com_port, baud)
                VALUES (v_tenant_id, v_pump_2_id, 5678, 'COM8', 9600);
            END IF;

            -- Máy chấm công Hikvision
            IF NOT EXISTS (SELECT 1 FROM station.access_terminal WHERE tenant_id = v_tenant_id AND terminal_code = 'T2') THEN
                INSERT INTO station.access_terminal (
                    tenant_id, pump_id, terminal_code, host, port, https, username, password_enc
                ) VALUES (
                    v_tenant_id, v_pump_2_id, 'T2', '192.168.1.102', 80, false, 'admin', decode('7465737470617373776f7264', 'hex')
                );
            END IF;
        END IF;

        -- 4. Quota Rules
        -- Định mức tuần cho Đội 1 (1,200 L/tuần)
        IF v_group_1_id IS NOT NULL AND NOT EXISTS (
            SELECT 1 FROM station.quota_rule WHERE tenant_id = v_tenant_id AND code = 'QR-DOI1-WEEK'
        ) THEN
            INSERT INTO station.quota_rule (
                tenant_id, code, vehicle_group_id, period,
                max_volume_ml, min_interval_minutes, effective_from, status, created_by
            ) VALUES (
                v_tenant_id, 'QR-DOI1-WEEK', v_group_1_id, 'week',
                1200000, 360, CURRENT_DATE, 'active', v_u_manager
            );
        END IF;

        -- Định mức ngày cho Tuyến HN-HP (500 L/ngày)
        IF v_route_1_id IS NOT NULL AND NOT EXISTS (
            SELECT 1 FROM station.quota_rule WHERE tenant_id = v_tenant_id AND code = 'QR-ROUTE1-DAY'
        ) THEN
            INSERT INTO station.quota_rule (
                tenant_id, code, route_id, period,
                max_volume_ml, min_interval_minutes, effective_from, status, created_by
            ) VALUES (
                v_tenant_id, 'QR-ROUTE1-DAY', v_route_1_id, 'day',
                500000, 240, CURRENT_DATE, 'active', v_u_manager
            );
        END IF;

    END IF;
END;
$$;
