-- 000016_drop_stocktake.up.sql
-- Bỏ tính năng kiểm kê và đối chiếu (kèm cảnh báo tồn thấp, lệch ngưỡng): xóa bảng kỳ đối chiếu, bảng cảnh báo và quyền `inventory.stocktake:*`.
-- Phiếu nhập, phiếu xuất và sổ kho vẫn giữ.
DELETE FROM station.role_permission WHERE permission_code LIKE 'inventory.stocktake:%';
DELETE FROM station.permission WHERE code LIKE 'inventory.stocktake:%';
DROP TABLE IF EXISTS station.stock_reconciliation;
DROP TABLE IF EXISTS station.alert;
