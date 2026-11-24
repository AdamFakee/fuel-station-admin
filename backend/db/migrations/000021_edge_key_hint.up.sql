-- 000021_edge_key_hint.up.sql
-- 7 ký tự cuối của khóa API, lưu lúc cấp để người quản trị nhận ra khóa nào đang dùng (đối chiếu với edge.conf của mini server).
-- Không đủ để đoán khóa (khóa dài 48 ký tự ngẫu nhiên); khóa cấp trước migration này chưa có gợi ý (NULL).
ALTER TABLE station.edge_station ADD COLUMN api_key_hint TEXT CHECK (api_key_hint IS NULL OR char_length(api_key_hint) = 7);
