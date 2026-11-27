-- Số lần người vận hành yêu cầu "đẩy lại dữ liệu" cho một máy chấm công (máy mới thay, bị xóa sạch hoặc thiếu người).
-- Tăng số này thì trigger tăng version và ghi nhật ký đồng bộ; trạm thấy số tăng sẽ đẩy lại toàn bộ người xuống riêng máy đó.
ALTER TABLE station.access_terminal ADD COLUMN resync_seq BIGINT NOT NULL DEFAULT 0 CHECK (resync_seq >= 0);
