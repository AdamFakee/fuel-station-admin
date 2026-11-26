-- Trạm xăng và bể chứa không còn thao tác ngừng hoạt động (chỉ trụ bơm ngừng được). Đưa các mục đang ngừng về hoạt động,
-- vì không còn nút nào bật lại chúng.
UPDATE station.branch SET status = 'active', updated_at = now() WHERE status <> 'active';
UPDATE station.tank SET status = 'active', updated_at = now() WHERE status <> 'active';
