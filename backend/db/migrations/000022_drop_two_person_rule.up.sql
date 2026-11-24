-- 000022_drop_two_person_rule.up.sql
-- Bỏ quy tắc "người duyệt phải khác người lập" (kiểm soát hai người) của phiếu nhập và phiếu xuất: người có quyền duyệt
-- thì duyệt được cả phiếu do chính mình lập. Giữ nguyên các chặn còn lại: duyệt phải có người duyệt, chứng từ đã duyệt
-- là cuối cùng (không sửa, không xóa, không đổi trạng thái). Công tắc tenant_setting.allow_self_approval không còn ý nghĩa nên xóa.
CREATE OR REPLACE FUNCTION station.guard_document() RETURNS trigger LANGUAGE plpgsql AS $$
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
    END IF;
    RETURN NEW;
END;
$$;

ALTER TABLE station.tenant_setting DROP COLUMN IF EXISTS allow_self_approval;
