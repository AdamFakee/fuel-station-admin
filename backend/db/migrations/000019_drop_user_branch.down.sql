-- 000019_drop_user_branch.down.sql
-- Dựng lại bảng rỗng; không khôi phục các gán trạm xăng đã xóa.
CREATE TABLE IF NOT EXISTS station.user_branch (
    tenant_id UUID NOT NULL,
    user_id   UUID NOT NULL,
    branch_id UUID NOT NULL,
    PRIMARY KEY (user_id, branch_id),
    FOREIGN KEY (tenant_id, user_id)   REFERENCES station.app_user (tenant_id, id) ON DELETE CASCADE,
    FOREIGN KEY (tenant_id, branch_id) REFERENCES station.branch (tenant_id, id)
);
