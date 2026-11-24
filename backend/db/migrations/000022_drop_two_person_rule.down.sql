-- 000022_drop_two_person_rule.down.sql
ALTER TABLE station.tenant_setting ADD COLUMN IF NOT EXISTS allow_self_approval BOOLEAN NOT NULL DEFAULT FALSE;

CREATE OR REPLACE FUNCTION station.guard_document() RETURNS trigger LANGUAGE plpgsql AS $$
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
