-- 000023_ledger_first_row.up.sql
-- Sổ kho: cho phép dòng đầu tiên của bể là NHẬP KHO (phiếu nhập, điều chuyển đến), không bắt buộc phải là tồn đầu kỳ.
-- Trước đây bể tạo với tồn đầu kỳ 0 không có dòng sổ nào (tồn đầu kỳ phải lớn hơn 0) nên không bao giờ nhập hàng được:
-- duyệt phiếu nhập báo "bể chưa có tồn đầu kỳ: dòng đầu tiên phải là opening".
CREATE OR REPLACE FUNCTION station.stock_ledger_before_insert() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
    v_last_seq     BIGINT;
    v_last_balance BIGINT;
    v_max          BIGINT;
BEGIN
    -- Khóa dòng bể để các lần ghi sổ của cùng một bể xếp hàng (số thứ tự và số dư luôn đúng).
    SELECT max_usable_capacity_ml INTO v_max FROM station.tank WHERE id = NEW.tank_id AND tenant_id = NEW.tenant_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'không có bể %', NEW.tank_id USING ERRCODE = 'foreign_key_violation';
    END IF;

    SELECT seq, balance_after_ml INTO v_last_seq, v_last_balance
      FROM station.stock_ledger WHERE tank_id = NEW.tank_id ORDER BY seq DESC LIMIT 1;

    IF v_last_seq IS NULL THEN
        -- Bể mới tạo với tồn đầu kỳ 0 không có dòng sổ nào: lần nhập đầu tiên (phiếu nhập, điều chuyển đến) mở sổ, số dư xuất phát là 0.
        -- Xuất, điều chỉnh trên bể chưa có sổ vẫn bị chặn (không có tồn để trừ, và điều chỉnh cần có số dư để so).
        IF NEW.kind NOT IN ('opening', 'receipt', 'transfer_in') THEN
            RAISE EXCEPTION 'bể % chưa có tồn: dòng đầu tiên của sổ phải là tồn đầu kỳ hoặc nhập kho', NEW.tank_id USING ERRCODE = 'check_violation';
        END IF;
        v_last_seq := 0;
        v_last_balance := 0;
    ELSIF NEW.kind = 'opening' THEN
        RAISE EXCEPTION 'bể % đã có số liệu tồn, không đặt tồn đầu kỳ được', NEW.tank_id USING ERRCODE = 'check_violation';
    END IF;

    NEW.seq := v_last_seq + 1;
    NEW.balance_after_ml := v_last_balance + NEW.delta_ml;

    IF NEW.balance_after_ml < 0 THEN
        RAISE EXCEPTION 'tồn bể % không đủ: còn % ml, cần xuất % ml', NEW.tank_id, v_last_balance, -NEW.delta_ml USING ERRCODE = 'check_violation';
    END IF;
    IF NEW.delta_ml > 0 AND NEW.balance_after_ml > v_max THEN
        RAISE EXCEPTION 'vượt dung tích khả dụng tối đa của bể %: % ml > % ml', NEW.tank_id, NEW.balance_after_ml, v_max USING ERRCODE = 'check_violation';
    END IF;
    RETURN NEW;
END;
$$;
