-- 000006_inventory.up.sql
-- Nhập – Xuất – Tồn bể chứa. Tồn kho KHÔNG sửa tay: mọi thay đổi đi qua station.stock_ledger (chỉ thêm), và tồn hiện tại là số dư dòng mới nhất.
--   Tồn cuối = Tồn đầu + Tổng nhập đã duyệt - Tổng xuất thực tế.
-- Chỉ tính LÍT. Không có đơn giá, thành tiền hay hóa đơn VAT.

-- ---------------------------------------------------------------------------------------------------
-- Nhà cung cấp
-- ---------------------------------------------------------------------------------------------------
CREATE TABLE station.supplier (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id  UUID        NOT NULL REFERENCES station.tenant (id),
    code       TEXT        NOT NULL CHECK (code ~ '^[A-Za-z0-9_-]{1,32}$'),
    name       TEXT        NOT NULL,
    phone      TEXT,
    address    TEXT,
    active     BOOLEAN     NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (tenant_id, id),
    UNIQUE (tenant_id, code)
);
CREATE TRIGGER trg_supplier_updated BEFORE UPDATE ON station.supplier FOR EACH ROW EXECUTE FUNCTION station.set_updated_at();

-- ---------------------------------------------------------------------------------------------------
-- Sổ thẻ kho: chỉ thêm. Trigger tự đánh số thứ tự, tính số dư, chặn tồn âm và chặn vượt dung tích khả dụng tối đa của bể.
-- ---------------------------------------------------------------------------------------------------
CREATE TABLE station.stock_ledger (
    id             BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    tenant_id      UUID        NOT NULL,
    tank_id        UUID        NOT NULL,
    seq            BIGINT      NOT NULL,               -- đặt bởi trigger: số thứ tự trong bể, liên tục từ 1
    occurred_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    kind           TEXT        NOT NULL CHECK (kind IN ('opening', 'receipt', 'dispense', 'issue', 'transfer_out', 'transfer_in', 'adjust')),
    delta_ml       BIGINT      NOT NULL CHECK (delta_ml <> 0),
    balance_after_ml BIGINT    NOT NULL,               -- đặt bởi trigger
    ref_type       TEXT,                               -- stock_receipt, dispense_session, stock_issue, stock_reconciliation
    ref_id         UUID,
    note           TEXT,
    created_by     UUID,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (tank_id, seq),
    FOREIGN KEY (tenant_id, tank_id) REFERENCES station.tank (tenant_id, id),
    CHECK (
        (kind IN ('opening', 'receipt', 'transfer_in') AND delta_ml > 0)
        OR (kind IN ('dispense', 'issue', 'transfer_out') AND delta_ml < 0)
        OR kind = 'adjust'
    )
);
CREATE INDEX ix_stock_ledger_tank_time ON station.stock_ledger (tenant_id, tank_id, occurred_at);
-- Mỗi chứng từ chỉ ghi sổ một lần cho mỗi bể và mỗi loại.
CREATE UNIQUE INDEX ux_stock_ledger_ref ON station.stock_ledger (tank_id, kind, ref_type, ref_id) WHERE ref_id IS NOT NULL;

CREATE FUNCTION station.stock_ledger_before_insert() RETURNS trigger LANGUAGE plpgsql AS $$
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
        IF NEW.kind <> 'opening' THEN
            RAISE EXCEPTION 'bể % chưa có tồn đầu kỳ: dòng đầu tiên phải là opening', NEW.tank_id USING ERRCODE = 'check_violation';
        END IF;
        v_last_seq := 0;
        v_last_balance := 0;
    ELSIF NEW.kind = 'opening' THEN
        RAISE EXCEPTION 'bể % đã có tồn đầu kỳ', NEW.tank_id USING ERRCODE = 'check_violation';
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
CREATE TRIGGER trg_stock_ledger_before_insert BEFORE INSERT ON station.stock_ledger FOR EACH ROW EXECUTE FUNCTION station.stock_ledger_before_insert();
CREATE TRIGGER trg_stock_ledger_immutable BEFORE UPDATE OR DELETE ON station.stock_ledger FOR EACH ROW EXECUTE FUNCTION station.forbid_change();
CREATE TRIGGER trg_stock_ledger_no_truncate BEFORE TRUNCATE ON station.stock_ledger FOR EACH STATEMENT EXECUTE FUNCTION station.forbid_change();

-- Tồn hiện tại của từng bể (dòng sổ mới nhất).
CREATE VIEW station.tank_stock AS
SELECT t.tenant_id,
       t.id                                   AS tank_id,
       t.branch_id,
       t.code,
       t.name,
       t.fuel_type_id,
       COALESCE(l.balance_after_ml, 0)        AS stock_ml,
       t.max_usable_capacity_ml,
       t.low_stock_threshold_ml,
       ROUND(COALESCE(l.balance_after_ml, 0) * 100.0 / t.max_usable_capacity_ml, 2) AS stock_pct,
       COALESCE(l.balance_after_ml, 0) <= t.low_stock_threshold_ml                  AS is_low,
       (l.id IS NOT NULL)                     AS has_opening
  FROM station.tank t
  LEFT JOIN LATERAL (
        SELECT id, balance_after_ml FROM station.stock_ledger WHERE tank_id = t.id ORDER BY seq DESC LIMIT 1
  ) l ON TRUE;

-- ---------------------------------------------------------------------------------------------------
-- Chặn tự duyệt: người duyệt phải khác người lập, trừ khi tenant cho phép (tenant_setting.allow_self_approval).
-- Chứng từ đã duyệt là cuối cùng: không sửa, không xóa.
-- ---------------------------------------------------------------------------------------------------
CREATE FUNCTION station.guard_document() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
    v_allow BOOLEAN;
BEGIN
    IF TG_OP = 'DELETE' THEN
        IF OLD.status NOT IN ('draft', 'pending') THEN
            RAISE EXCEPTION 'chứng từ % ở trạng thái % không được xóa', OLD.code, OLD.status USING ERRCODE = 'restrict_violation';
        END IF;
        RETURN OLD;
    END IF;

    IF OLD.status IN ('approved', 'rejected') AND NEW.status <> OLD.status AND NOT (OLD.status = 'rejected' AND NEW.status IN ('draft', 'pending')) THEN
        RAISE EXCEPTION 'chứng từ % đã %, không đổi trạng thái được', OLD.code, OLD.status USING ERRCODE = 'restrict_violation';
    END IF;
    IF OLD.status = 'approved' THEN
        RAISE EXCEPTION 'chứng từ % đã duyệt, không được sửa', OLD.code USING ERRCODE = 'restrict_violation';
    END IF;

    IF NEW.status = 'approved' AND OLD.status <> 'approved' THEN
        IF NEW.decided_by IS NULL THEN
            RAISE EXCEPTION 'duyệt chứng từ % cần người duyệt', NEW.code USING ERRCODE = 'check_violation';
        END IF;
        SELECT allow_self_approval INTO v_allow FROM station.tenant_setting WHERE tenant_id = NEW.tenant_id;
        IF NEW.decided_by = NEW.created_by AND NOT COALESCE(v_allow, FALSE) THEN
            RAISE EXCEPTION 'người duyệt phải khác người lập chứng từ %', NEW.code USING ERRCODE = 'check_violation';
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------------------------------
-- Phiếu nhập bể (workflow: draft -> pending -> approved | rejected). Một chuyến xe bồn có thể nhập vào nhiều bể (nhiều dòng).
-- ---------------------------------------------------------------------------------------------------
CREATE TABLE station.stock_receipt (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id     UUID        NOT NULL,
    branch_id     UUID        NOT NULL,
    code          TEXT        NOT NULL,                 -- PN-2026-0001
    received_at   TIMESTAMPTZ NOT NULL,
    supplier_id   UUID,
    tanker_plate  TEXT,                                 -- số xe bồn
    document_no   TEXT,                                 -- số chứng từ giao nhận
    status        TEXT        NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'pending', 'approved', 'rejected')),
    note          TEXT,
    created_by    UUID        NOT NULL,
    decided_by    UUID,                                 -- người duyệt hoặc từ chối
    decided_at    TIMESTAMPTZ,
    reject_reason TEXT,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (tenant_id, id),
    UNIQUE (tenant_id, code),
    CHECK ((status IN ('approved', 'rejected')) = (decided_by IS NOT NULL AND decided_at IS NOT NULL)),
    CHECK (status <> 'rejected' OR reject_reason IS NOT NULL),
    FOREIGN KEY (tenant_id, branch_id)   REFERENCES station.branch (tenant_id, id),
    FOREIGN KEY (tenant_id, supplier_id) REFERENCES station.supplier (tenant_id, id),
    FOREIGN KEY (tenant_id, created_by)  REFERENCES station.app_user (tenant_id, id),
    FOREIGN KEY (tenant_id, decided_by)  REFERENCES station.app_user (tenant_id, id)
);
CREATE INDEX ix_stock_receipt_list ON station.stock_receipt (tenant_id, branch_id, received_at DESC);
CREATE INDEX ix_stock_receipt_pending ON station.stock_receipt (tenant_id, branch_id) WHERE status = 'pending';
CREATE TRIGGER trg_stock_receipt_guard BEFORE UPDATE OR DELETE ON station.stock_receipt FOR EACH ROW EXECUTE FUNCTION station.guard_document();
CREATE TRIGGER trg_stock_receipt_updated BEFORE UPDATE ON station.stock_receipt FOR EACH ROW EXECUTE FUNCTION station.set_updated_at();

CREATE TABLE station.stock_receipt_line (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id         UUID        NOT NULL,
    receipt_id        UUID        NOT NULL,
    tank_id           UUID        NOT NULL,
    fuel_type_id      UUID        NOT NULL,             -- loại nhiên liệu của xe bồn; phải trùng loại của bể nhận
    level_before_ml   BIGINT      CHECK (level_before_ml >= 0),   -- mức đo bể trước nhập
    document_volume_ml BIGINT     NOT NULL CHECK (document_volume_ml > 0),   -- số lít theo chứng từ
    actual_volume_ml  BIGINT      NOT NULL CHECK (actual_volume_ml > 0),     -- số lít thực nhận vào bể
    level_after_ml    BIGINT      CHECK (level_after_ml >= 0),   -- mức đo bể sau nhập
    variance_ml       BIGINT      GENERATED ALWAYS AS (actual_volume_ml - document_volume_ml) STORED,   -- chênh lệch nhập
    UNIQUE (receipt_id, tank_id),
    FOREIGN KEY (tenant_id, receipt_id)   REFERENCES station.stock_receipt (tenant_id, id) ON DELETE CASCADE,
    FOREIGN KEY (tenant_id, tank_id)      REFERENCES station.tank (tenant_id, id),
    FOREIGN KEY (tenant_id, fuel_type_id) REFERENCES station.fuel_type (tenant_id, id)
);

-- Loại nhiên liệu của dòng nhập phải trùng loại của bể.
CREATE FUNCTION station.check_receipt_line_fuel() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
    v_fuel UUID;
BEGIN
    SELECT fuel_type_id INTO v_fuel FROM station.tank WHERE id = NEW.tank_id AND tenant_id = NEW.tenant_id;
    IF v_fuel IS DISTINCT FROM NEW.fuel_type_id THEN
        RAISE EXCEPTION 'loại nhiên liệu của dòng nhập không trùng loại của bể %', NEW.tank_id USING ERRCODE = 'check_violation';
    END IF;
    RETURN NEW;
END;
$$;
CREATE TRIGGER trg_receipt_line_fuel BEFORE INSERT OR UPDATE ON station.stock_receipt_line FOR EACH ROW EXECUTE FUNCTION station.check_receipt_line_fuel();

CREATE TABLE station.stock_receipt_attachment (
    receipt_id UUID NOT NULL,
    tenant_id  UUID NOT NULL,
    file_id    UUID NOT NULL,
    PRIMARY KEY (receipt_id, file_id),
    FOREIGN KEY (tenant_id, receipt_id) REFERENCES station.stock_receipt (tenant_id, id) ON DELETE CASCADE,
    FOREIGN KEY (tenant_id, file_id)    REFERENCES station.stored_file (tenant_id, id)
);

-- ---------------------------------------------------------------------------------------------------
-- Phiếu xuất khác (điều chuyển giữa bể, hao hụt, kiểm định). Xuất cấp phát đội xe KHÔNG qua phiếu: tự sinh từ phiên đổ.
-- ---------------------------------------------------------------------------------------------------
CREATE TABLE station.stock_issue (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id     UUID        NOT NULL,
    branch_id     UUID        NOT NULL,
    code          TEXT        NOT NULL,                 -- PX-2026-0001
    kind          TEXT        NOT NULL CHECK (kind IN ('transfer', 'loss', 'inspection')),
    tank_id       UUID        NOT NULL,                 -- bể xuất
    to_tank_id    UUID,                                 -- bể nhận (chỉ điều chuyển)
    volume_ml     BIGINT      NOT NULL CHECK (volume_ml > 0),
    reason        TEXT        NOT NULL,
    status        TEXT        NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'pending', 'approved', 'rejected')),
    created_by    UUID        NOT NULL,
    decided_by    UUID,
    decided_at    TIMESTAMPTZ,
    reject_reason TEXT,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (tenant_id, id),
    UNIQUE (tenant_id, code),
    CHECK ((kind = 'transfer') = (to_tank_id IS NOT NULL)),
    CHECK (to_tank_id IS NULL OR to_tank_id <> tank_id),
    CHECK ((status IN ('approved', 'rejected')) = (decided_by IS NOT NULL AND decided_at IS NOT NULL)),
    CHECK (status <> 'rejected' OR reject_reason IS NOT NULL),
    FOREIGN KEY (tenant_id, branch_id)  REFERENCES station.branch (tenant_id, id),
    FOREIGN KEY (tenant_id, tank_id)    REFERENCES station.tank (tenant_id, id),
    FOREIGN KEY (tenant_id, to_tank_id) REFERENCES station.tank (tenant_id, id),
    FOREIGN KEY (tenant_id, created_by) REFERENCES station.app_user (tenant_id, id),
    FOREIGN KEY (tenant_id, decided_by) REFERENCES station.app_user (tenant_id, id)
);
CREATE INDEX ix_stock_issue_list ON station.stock_issue (tenant_id, branch_id, created_at DESC);
CREATE INDEX ix_stock_issue_pending ON station.stock_issue (tenant_id, branch_id) WHERE status = 'pending';
CREATE TRIGGER trg_stock_issue_guard BEFORE UPDATE OR DELETE ON station.stock_issue FOR EACH ROW EXECUTE FUNCTION station.guard_document();
CREATE TRIGGER trg_stock_issue_updated BEFORE UPDATE ON station.stock_issue FOR EACH ROW EXECUTE FUNCTION station.set_updated_at();

-- ---------------------------------------------------------------------------------------------------
-- Kiểm kê và đối chiếu (mỗi bể mỗi kỳ một dòng). Quản lý nhập số đo thực tế; Kế toán xác nhận chênh lệch.
-- ---------------------------------------------------------------------------------------------------
CREATE TABLE station.stock_reconciliation (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id          UUID        NOT NULL,
    branch_id          UUID        NOT NULL,
    tank_id            UUID        NOT NULL,
    period_date        DATE        NOT NULL,            -- ngày đối chiếu (giờ Việt Nam)
    opening_ml         BIGINT      NOT NULL,            -- tồn đầu kỳ
    receipts_ml        BIGINT      NOT NULL,            -- tổng nhập đã duyệt trong kỳ
    dispensed_ml       BIGINT      NOT NULL,            -- tổng xuất cấp phát qua vòi
    other_issues_ml    BIGINT      NOT NULL,            -- tổng xuất khác (điều chuyển, hao hụt, kiểm định)
    book_closing_ml    BIGINT      NOT NULL,            -- tồn cuối sổ sách
    measured_ml        BIGINT      CHECK (measured_ml >= 0),          -- tồn đo thực tế tại bể (que thăm hoặc cảm biến)
    pump_totalizer_ml  BIGINT      CHECK (pump_totalizer_ml >= 0),    -- chênh lệch đồng hồ tổng cột bơm trong kỳ
    variance_ml        BIGINT,                          -- measured - book_closing
    variance_pct       NUMERIC(7,3),
    tolerance_pct      NUMERIC(5,2) NOT NULL,           -- ngưỡng hao hụt cho phép tại thời điểm đối chiếu (ảnh chụp từ bể)
    status             TEXT        NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'matched', 'alert', 'confirmed')),
    measured_by        UUID,
    confirmed_by       UUID,
    confirmed_at       TIMESTAMPTZ,
    note               TEXT,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (tenant_id, id),
    UNIQUE (tank_id, period_date),
    CHECK (book_closing_ml = opening_ml + receipts_ml - dispensed_ml - other_issues_ml),
    CHECK ((status = 'confirmed') = (confirmed_by IS NOT NULL AND confirmed_at IS NOT NULL)),
    FOREIGN KEY (tenant_id, branch_id)   REFERENCES station.branch (tenant_id, id),
    FOREIGN KEY (tenant_id, tank_id)     REFERENCES station.tank (tenant_id, id),
    FOREIGN KEY (tenant_id, measured_by) REFERENCES station.app_user (tenant_id, id),
    FOREIGN KEY (tenant_id, confirmed_by) REFERENCES station.app_user (tenant_id, id)
);
CREATE INDEX ix_stock_reconciliation_list ON station.stock_reconciliation (tenant_id, branch_id, period_date DESC);
CREATE TRIGGER trg_stock_reconciliation_updated BEFORE UPDATE ON station.stock_reconciliation FOR EACH ROW EXECUTE FUNCTION station.set_updated_at();

-- ---------------------------------------------------------------------------------------------------
-- Cảnh báo và hàng đợi thông báo (trên hệ thống hoặc email)
-- ---------------------------------------------------------------------------------------------------
CREATE TABLE station.alert (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID        NOT NULL,
    branch_id       UUID,
    kind            TEXT        NOT NULL CHECK (kind IN ('low_stock', 'loss_variance', 'station_offline', 'sync_error')),
    tank_id         UUID,
    edge_station_id UUID,
    message         TEXT        NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    resolved_at     TIMESTAMPTZ,
    FOREIGN KEY (tenant_id, branch_id)       REFERENCES station.branch (tenant_id, id),
    FOREIGN KEY (tenant_id, tank_id)         REFERENCES station.tank (tenant_id, id),
    FOREIGN KEY (tenant_id, edge_station_id) REFERENCES station.edge_station (tenant_id, id)
);
CREATE INDEX ix_alert_open ON station.alert (tenant_id, created_at DESC) WHERE resolved_at IS NULL;

CREATE TABLE station.notification_outbox (
    id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    tenant_id    UUID        NOT NULL,
    channel      TEXT        NOT NULL CHECK (channel IN ('email')),
    recipient    TEXT        NOT NULL,                 -- địa chỉ email
    subject      TEXT        NOT NULL,
    body         TEXT        NOT NULL,
    status       TEXT        NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed')),
    attempts     INTEGER     NOT NULL DEFAULT 0,
    next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_error   TEXT,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    sent_at      TIMESTAMPTZ
);
CREATE INDEX ix_notification_due ON station.notification_outbox (next_attempt_at) WHERE status = 'pending';
