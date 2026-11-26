-- Trả lại quyền cho vai trò Quản lý mặc định. Vai trò tự tạo từng được cấp các quyền này thì không khôi phục được.
INSERT INTO station.role_permission (role_id, permission_code)
SELECT r.id, p.code
  FROM station.role r CROSS JOIN station.permission p
 WHERE r.is_system AND r.code = 'MANAGER'
   AND p.code IN (
        'org.branch:create',
        'org.branch:update',
        'org.branch:delete',
        'asset.tank:create',
        'asset.tank:update',
        'asset.tank:delete',
        'asset.pump:create',
        'asset.pump:update',
        'asset.pump:delete',
        'asset.device:create',
        'asset.device:update',
        'asset.device:delete')
ON CONFLICT DO NOTHING;
