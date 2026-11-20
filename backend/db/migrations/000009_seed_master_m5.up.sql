-- 000009_seed_master_m5.up.sql
-- Seed dữ liệu danh mục ban đầu cho Module M5 (Danh mục xe, tài xế, loại nhiên liệu, loại xe, nhóm xe, tuyến)

DO $$
DECLARE
    v_tenant_id UUID;
    v_branch_id UUID;
    v_fuel_do_id UUID;
    v_fuel_a95_id UUID;
    v_vt_truck_id UUID;
    v_vt_tanker_id UUID;
    v_vt_van_id UUID;
    v_group_1_id UUID;
    v_group_2_id UUID;
    v_route_1_id UUID;
    v_route_2_id UUID;
    v_veh_1_id UUID;
    v_veh_2_id UUID;
    v_drv_1_id UUID;
    v_drv_2_id UUID;
BEGIN
    SELECT id INTO v_tenant_id FROM station.tenant WHERE code = 'CTY-01';
    IF v_tenant_id IS NOT NULL THEN
        SELECT id INTO v_branch_id FROM station.branch WHERE tenant_id = v_tenant_id AND code = 'TRAM-01';

        -- 1. Fuel Types
        INSERT INTO station.fuel_type (tenant_id, code, name, active)
        VALUES (v_tenant_id, 'DO', 'Dầu DO 0.05S-II', true)
        ON CONFLICT (tenant_id, code) DO UPDATE SET name = EXCLUDED.name
        RETURNING id INTO v_fuel_do_id;

        INSERT INTO station.fuel_type (tenant_id, code, name, active)
        VALUES (v_tenant_id, 'A95', 'Xăng RON 95-III', true)
        ON CONFLICT (tenant_id, code) DO UPDATE SET name = EXCLUDED.name
        RETURNING id INTO v_fuel_a95_id;

        -- 2. Vehicle Types
        INSERT INTO station.vehicle_type (tenant_id, code, name, active)
        VALUES (v_tenant_id, 'TRUCK', 'Xe tải nặng', true)
        ON CONFLICT (tenant_id, code) DO UPDATE SET name = EXCLUDED.name
        RETURNING id INTO v_vt_truck_id;

        INSERT INTO station.vehicle_type (tenant_id, code, name, active)
        VALUES (v_tenant_id, 'TANKER', 'Xe bồn chuyên dụng', true)
        ON CONFLICT (tenant_id, code) DO UPDATE SET name = EXCLUDED.name
        RETURNING id INTO v_vt_tanker_id;

        INSERT INTO station.vehicle_type (tenant_id, code, name, active)
        VALUES (v_tenant_id, 'VAN', 'Xe bán tải / Van', true)
        ON CONFLICT (tenant_id, code) DO UPDATE SET name = EXCLUDED.name
        RETURNING id INTO v_vt_van_id;

        -- 3. Vehicle Groups
        INSERT INTO station.vehicle_group (tenant_id, code, name)
        VALUES (v_tenant_id, 'DOI_1', 'Đội vận tải đường dài')
        ON CONFLICT (tenant_id, code) DO UPDATE SET name = EXCLUDED.name
        RETURNING id INTO v_group_1_id;

        INSERT INTO station.vehicle_group (tenant_id, code, name)
        VALUES (v_tenant_id, 'DOI_2', 'Đội xe nội bộ trạm')
        ON CONFLICT (tenant_id, code) DO UPDATE SET name = EXCLUDED.name
        RETURNING id INTO v_group_2_id;

        -- 4. Routes
        INSERT INTO station.route (tenant_id, code, name)
        VALUES (v_tenant_id, 'TUYEN_HN_HP', 'Hà Nội - Hải Phòng')
        ON CONFLICT (tenant_id, code) DO UPDATE SET name = EXCLUDED.name
        RETURNING id INTO v_route_1_id;

        INSERT INTO station.route (tenant_id, code, name)
        VALUES (v_tenant_id, 'TUYEN_NOI_BO', 'Nội bộ trạm & kho')
        ON CONFLICT (tenant_id, code) DO UPDATE SET name = EXCLUDED.name
        RETURNING id INTO v_route_2_id;

        -- 5. Vehicles
        IF NOT EXISTS (SELECT 1 FROM station.vehicle WHERE tenant_id = v_tenant_id AND code = 'XE001' AND deleted_at IS NULL) THEN
            INSERT INTO station.vehicle (
                tenant_id, branch_id, code, plate, vehicle_type_id,
                fuel_type_id, route_id, tank_capacity_ml, status, note
            ) VALUES (
                v_tenant_id, v_branch_id, 'XE001', '29C-88888', v_vt_truck_id,
                v_fuel_do_id, v_route_1_id, 150000, 'active', 'Xe tải đầu kéo Huyndai'
            ) RETURNING id INTO v_veh_1_id;

            -- Assign to DOI_1
            INSERT INTO station.vehicle_group_member (tenant_id, group_id, vehicle_id)
            VALUES (v_tenant_id, v_group_1_id, v_veh_1_id)
            ON CONFLICT DO NOTHING;

            -- Assign NFC Card
            INSERT INTO station.credential (
                tenant_id, vehicle_id, method, external_id, status
            ) VALUES (
                v_tenant_id, v_veh_1_id, 'card', '1001234567', 'active'
            ) ON CONFLICT DO NOTHING;
        END IF;

        IF NOT EXISTS (SELECT 1 FROM station.vehicle WHERE tenant_id = v_tenant_id AND code = 'XE002' AND deleted_at IS NULL) THEN
            INSERT INTO station.vehicle (
                tenant_id, branch_id, code, plate, vehicle_type_id,
                fuel_type_id, route_id, tank_capacity_ml, status, note
            ) VALUES (
                v_tenant_id, v_branch_id, 'XE002', '29B-99999', v_vt_van_id,
                v_fuel_a95_id, v_route_2_id, 80000, 'active', 'Xe bán tải Ford Ranger'
            ) RETURNING id INTO v_veh_2_id;

            -- Assign to DOI_2
            INSERT INTO station.vehicle_group_member (tenant_id, group_id, vehicle_id)
            VALUES (v_tenant_id, v_group_2_id, v_veh_2_id)
            ON CONFLICT DO NOTHING;

            -- Assign NFC Card
            INSERT INTO station.credential (
                tenant_id, vehicle_id, method, external_id, status
            ) VALUES (
                v_tenant_id, v_veh_2_id, 'card', '1001234568', 'active'
            ) ON CONFLICT DO NOTHING;
        END IF;

        -- 6. Drivers
        IF NOT EXISTS (SELECT 1 FROM station.driver WHERE tenant_id = v_tenant_id AND code = 'TX001' AND deleted_at IS NULL) THEN
            INSERT INTO station.driver (
                tenant_id, branch_id, code, full_name, phone, department, position, status, note
            ) VALUES (
                v_tenant_id, v_branch_id, 'TX001', 'Trần Văn Lái', '0911223344', 'Đội xe vận tải 1', 'driver', 'active', 'Tài xế chính'
            ) RETURNING id INTO v_drv_1_id;

            -- Assign NFC Card
            INSERT INTO station.credential (
                tenant_id, driver_id, method, external_id, status
            ) VALUES (
                v_tenant_id, v_drv_1_id, 'card', '2001234567', 'active'
            ) ON CONFLICT DO NOTHING;
        END IF;

        IF NOT EXISTS (SELECT 1 FROM station.driver WHERE tenant_id = v_tenant_id AND code = 'TX002' AND deleted_at IS NULL) THEN
            INSERT INTO station.driver (
                tenant_id, branch_id, code, full_name, phone, department, position, status, note
            ) VALUES (
                v_tenant_id, v_branch_id, 'TX002', 'Lê Văn Vận Hành', '0922334455', 'Ban vận hành kho', 'operator', 'active', 'Kỹ thuật viên trực bơm'
            ) RETURNING id INTO v_drv_2_id;

            -- Assign NFC Card
            INSERT INTO station.credential (
                tenant_id, driver_id, method, external_id, status
            ) VALUES (
                v_tenant_id, v_drv_2_id, 'card', '2001234568', 'active'
            ) ON CONFLICT DO NOTHING;
        END IF;
    END IF;
END;
$$;
