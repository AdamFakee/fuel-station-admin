import type { StatusTone } from '@/components/status-badge';

/**
 * Nhãn và màu trạng thái: NGUỒN DUY NHẤT cho bảng, hộp chi tiết, bộ lọc và file Excel.
 * Muốn đổi chữ hay màu thì chỉ sửa ở đây.
 */
export interface StatusStyle {
  label: string;
  tone: StatusTone;
}

/**
 * Chuẩn theo mã trạng thái của hệ thống: MỖI Ý NGHĨA MỘT CHỮ, mọi đối tượng dùng chung, để đối soát không bị lệch.
 * Không gộp hai mã khác ý nghĩa vào một chữ.
 */
const ACTIVE: StatusStyle = { label: 'Hoạt động', tone: 'success' }; // active, enabled
const INACTIVE: StatusStyle = { label: 'Ngừng hoạt động', tone: 'neutral' }; // inactive, disabled
const LOCKED: StatusStyle = { label: 'Bị khóa', tone: 'danger' }; // blocked, banned, locked

export const DRIVER_STATUS = { active: ACTIVE, blocked: LOCKED, inactive: INACTIVE } satisfies Record<string, StatusStyle>;
export const VEHICLE_STATUS = { active: ACTIVE, banned: LOCKED } satisfies Record<string, StatusStyle>;
export const USER_STATUS = { active: ACTIVE, locked: LOCKED } satisfies Record<string, StatusStyle>;

/** Trụ bơm lưu bật/tắt (`enabled`) thay cho chuỗi trạng thái. */
export const PUMP_STATUS = { enabled: ACTIVE, disabled: INACTIVE } satisfies Record<string, StatusStyle>;

export const pumpStatus = (enabled: boolean): StatusStyle => (enabled ? PUMP_STATUS.enabled : PUMP_STATUS.disabled);

/** Lấy nhãn theo giá trị server trả về; giá trị lạ thì hiện nguyên văn, màu trung tính. */
export function statusStyle(map: Record<string, StatusStyle>, status: string): StatusStyle {
  return map[status] ?? { label: status, tone: 'neutral' };
}
