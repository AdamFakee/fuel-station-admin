import * as React from 'react';
import { DetailSection } from '@/components/detail-dialog';
import { StatusBadge } from '@/components/status-badge';
import { FaceThumbnail } from '@/components/face-thumbnail';
import { formatDateTimeVN, formatNumberVN } from '@/lib/format';
import type { Branch, PumpDetail, Tank } from '@/features/assets/types';
import type { UserListItem } from '@/features/iam/types';
import type { DriverListItem, VehicleListItem } from '@/features/master/types';
import type { AccessEventListItem } from '@/features/dispense/types';
import type { EdgeStationStatus } from '@/features/sync-monitor/types';
import type { StockLedgerLineItem, StockLedgerSummaryItem } from '@/features/reports/types';

/**
 * Nội dung hộp thoại chi tiết cho từng loại dòng bảng. Chỉ đọc, gom một chỗ để mọi bảng hiển thị nhất quán.
 */

const liters = (ml: number | undefined | null) => (ml === undefined || ml === null ? '—' : `${formatNumberVN(ml / 1000)} L`);
const dateTime = (value?: string | null) => (value ? formatDateTimeVN(value) : '—');

const activeBadge = (active: boolean, on = 'Hoạt động', off = 'Ngừng hoạt động') => (
  <StatusBadge tone={active ? 'success' : 'neutral'}>{active ? on : off}</StatusBadge>
);

const auditSection = (createdAt?: string, updatedAt?: string): DetailSection => ({
  title: 'Hệ thống',
  fields: [
    { label: 'Ngày tạo', value: dateTime(createdAt) },
    { label: 'Cập nhật cuối', value: dateTime(updatedAt) },
  ],
});

export function branchDetail(b: Branch): DetailSection[] {
  return [
    {
      title: 'Thông tin trạm xăng',
      fields: [
        { label: 'Mã trạm xăng', value: b.code },
        { label: 'Trạng thái', value: activeBadge(b.status === 'active') },
        { label: 'Tên trạm xăng', value: b.name },
        { label: 'Người quản lý', value: b.manager_name },
        { label: 'Số điện thoại', value: b.phone },
        { label: 'Địa chỉ', value: b.address, wide: true },
      ],
    },
    auditSection(b.created_at, b.updated_at),
  ];
}

export function tankDetail(t: Tank): DetailSection[] {
  return [
    {
      title: 'Thông tin bể',
      fields: [
        { label: 'Mã bể', value: t.code },
        { label: 'Trạng thái', value: activeBadge(t.status === 'active', 'Hoạt động', 'Ngừng vận hành') },
        { label: 'Tên bể', value: t.name },
        { label: 'Trạm xăng', value: t.branch_name },
        { label: 'Loại nhiên liệu', value: t.fuel_type_name },
        { label: 'Tồn hiện tại', value: liters(t.current_stock_ml) },
      ],
    },
    {
      title: 'Dung tích & ngưỡng',
      fields: [
        { label: 'Dung tích thiết kế', value: liters(t.design_capacity_ml) },
        { label: 'Dung tích khả dụng', value: liters(t.max_usable_capacity_ml) },
        { label: 'Ngưỡng cảnh báo tồn thấp', value: liters(t.low_stock_threshold_ml) },
        { label: 'Dung sai hao hụt', value: `${formatNumberVN(t.loss_tolerance_pct)} %` },
      ],
    },
    auditSection(t.created_at, t.updated_at),
  ];
}

export function pumpDetail(p: PumpDetail): DetailSection[] {
  const nozzle = p.nozzles?.[0];
  return [
    {
      title: 'Thông tin trụ bơm',
      fields: [
        { label: 'Mã trụ', value: p.code },
        { label: 'Trạng thái', value: activeBadge(p.enabled, 'Hoạt động', 'Ngừng vận hành') },
        { label: 'Tên trụ', value: p.name },
        { label: 'Trạm xăng', value: p.branch_name },
        { label: 'Số trụ trên trạm', value: String(p.edge_pump_id) },
        { label: 'Bể xuất', value: nozzle?.tank_name },
        { label: 'Ghi chú', value: p.note, wide: true },
      ],
    },
    {
      title: 'Bộ số Montech (RS-485)',
      fields: [
        { label: 'Tên bộ số', value: p.sensor?.name },
        { label: 'Cổng COM', value: p.sensor?.com_port },
        { label: 'Serial', value: p.sensor ? String(p.sensor.serial) : undefined },
        { label: 'Tốc độ baud', value: p.sensor ? String(p.sensor.baud) : undefined },
      ],
    },
    {
      title: 'Máy chấm công Hikvision',
      fields: [
        { label: 'Mã máy', value: p.terminal?.terminal_code },
        { label: 'Địa chỉ', value: p.terminal ? `${p.terminal.host}:${p.terminal.port}` : undefined },
        { label: 'Tài khoản', value: p.terminal?.username },
        { label: 'Mật khẩu', value: p.terminal ? (p.terminal.has_password ? p.terminal.password_hint || 'Đã đặt' : 'Chưa đặt') : undefined },
      ],
    },
    auditSection(p.created_at, p.updated_at),
  ];
}

export function userDetail(u: UserListItem): DetailSection[] {
  return [
    {
      title: 'Tài khoản',
      fields: [
        { label: 'Mã nhân viên', value: u.employee_code },
        {
          label: 'Trạng thái',
          value: <StatusBadge tone={u.status === 'locked' ? 'danger' : 'success'}>{u.status === 'locked' ? 'Bị khóa' : 'Hoạt động'}</StatusBadge>,
        },
        { label: 'Họ và tên', value: u.full_name },
        { label: 'Email đăng nhập', value: u.email },
        { label: 'Số điện thoại', value: u.phone },
        { label: 'Vai trò', value: u.role_name },
      ],
    },
    {
      title: 'Hoạt động',
      fields: [
        { label: 'Đăng nhập cuối', value: dateTime(u.last_login_at) },
        { label: 'Ngày tạo', value: dateTime(u.created_at) },
      ],
    },
  ];
}

export function vehicleDetail(v: VehicleListItem): DetailSection[] {
  return [
    {
      title: 'Phương tiện',
      fields: [
        { label: 'Mã xe', value: v.code },
        {
          label: 'Quyền đổ',
          value: <StatusBadge tone={v.status === 'active' ? 'success' : 'danger'}>{v.status === 'active' ? 'Hoạt động' : 'Bị khóa'}</StatusBadge>,
        },
        { label: 'Biển số', value: v.plate },
        { label: 'Loại xe', value: v.vehicle_type_name },
        { label: 'Loại nhiên liệu', value: v.fuel_type_name },
        { label: 'Thẻ NFC', value: v.card_number },
        { label: 'Ghi chú', value: v.note, wide: true },
      ],
    },
    auditSection(v.created_at, v.updated_at),
  ];
}

const DRIVER_STATUS: Record<string, { label: string; tone: 'success' | 'danger' | 'neutral' }> = {
  active: { label: 'Hoạt động', tone: 'success' },
  blocked: { label: 'Bị chặn', tone: 'danger' },
  inactive: { label: 'Ngừng', tone: 'neutral' },
};

export function driverDetail(d: DriverListItem): DetailSection[] {
  const status = DRIVER_STATUS[d.status] ?? { label: d.status, tone: 'neutral' as const };
  return [
    {
      title: 'Tài xế',
      fields: [
        { label: 'Mã tài xế', value: d.code },
        { label: 'Trạng thái', value: <StatusBadge tone={status.tone}>{status.label}</StatusBadge> },
        { label: 'Họ và tên', value: d.full_name },
        { label: 'Số điện thoại', value: d.phone },
        { label: 'Hiệu lực', value: d.valid_from || d.valid_to ? `${d.valid_from ?? '…'} → ${d.valid_to ?? 'không thời hạn'}` : 'Không thời hạn' },
        { label: 'Ghi chú', value: d.note, wide: true },
      ],
    },
    {
      title: 'Phương thức xác thực',
      fields: [
        { label: 'Thẻ NFC', value: d.card_number || 'Chưa có' },
        { label: 'Khuôn mặt', value: d.has_face ? <FaceThumbnail fileId={d.face_file_id} size={96} /> : 'Chưa có' },      ],
    },
    auditSection(d.created_at, d.updated_at),
  ];
}

const DECISION = { accept: 'Chấp nhận', reject: 'Từ chối' } as const;
const METHOD = { card: 'Thẻ NFC', face: 'Khuôn mặt', fingerprint: 'Vân tay' } as const;

export function accessEventDetail(e: AccessEventListItem): DetailSection[] {
  return [
    {
      title: 'Lượt xác thực',
      fields: [
        { label: 'Thời điểm', value: dateTime(e.occurred_at) },
        {
          label: 'Kết quả',
          value: <StatusBadge tone={e.decision === 'accept' ? 'success' : 'danger'}>{DECISION[e.decision]}</StatusBadge>,
        },
        { label: 'Trạm xăng', value: e.branch_name },
        { label: 'Phương thức', value: e.method ? METHOD[e.method] : undefined },
        { label: 'Mã định danh / thẻ', value: e.external_id },
        { label: 'Đối tượng nhận diện', value: e.party_name || e.driver_name || e.vehicle_plate },
        { label: 'Lý do', value: e.reason, wide: true },
      ],
    },
  ];
}

const litersL = (value: number) => `${formatNumberVN(value, 2)} L`;

/** Một dòng tổng hợp theo bể trong báo cáo Nhập – Xuất – Tồn. */
export function stockSummaryDetail(s: StockLedgerSummaryItem): DetailSection[] {
  return [
    {
      title: 'Thông tin bể',
      fields: [
        { label: 'Mã bể', value: s.tank_code },
        { label: 'Tên bể', value: s.tank_name },
        { label: 'Nhiên liệu', value: s.fuel_type_name },
        { label: 'Trạm xăng', value: s.branch_name },
        { label: 'Dung tích', value: litersL(s.capacity_liters) },
      ],
    },
    {
      title: 'Biến động trong kỳ',
      fields: [
        { label: 'Tồn đầu', value: litersL(s.opening_liters) },
        { label: 'Tổng nhập', value: litersL(s.receipt_liters) },
        { label: 'Cấp phát', value: litersL(s.dispense_liters) },
        { label: 'Xuất khác', value: litersL(s.issue_liters) },
        { label: 'Điều chỉnh', value: litersL(s.adjust_liters) },
        { label: 'Tồn cuối', value: litersL(s.closing_liters) },
      ],
    },
  ];
}

/** Một dòng thẻ kho chi tiết trong báo cáo Nhập – Xuất – Tồn. */
export function stockLedgerLineDetail(l: StockLedgerLineItem): DetailSection[] {
  return [
    {
      title: 'Giao dịch',
      fields: [
        { label: 'Thời gian', value: dateTime(l.occurred_at) },
        { label: 'Bể chứa', value: l.tank_name },
        { label: 'Loại nghiệp vụ', value: l.kind_label },
        { label: 'Mã tham chiếu', value: l.ref_code },
        { label: 'Ghi chú', value: l.note, wide: true },
      ],
    },
    {
      title: 'Số lượng',
      fields: [
        { label: 'Nhập', value: l.in_liters > 0 ? litersL(l.in_liters) : '—' },
        { label: 'Xuất', value: l.out_liters > 0 ? litersL(l.out_liters) : '—' },
        { label: 'Tồn sau giao dịch', value: litersL(l.balance_liters) },
      ],
    },
  ];
}

/** Một trạm Edge Agent trong màn Trạng thái trạm & Đồng bộ. */
/** Hiển thị khóa API: chỉ 7 ký tự cuối (khóa thật server không giữ), phần còn lại che bằng dấu chấm. */
export function apiKeyLabel(hasKey: boolean, hint?: string, hasStation = true): string {
  if (!hasKey) return hasStation ? 'Đã thu hồi' : 'Chưa cấp';
  // Dạng che giống khóa thật (edge_ + 48 ký tự), chỉ lộ 7 ký tự cuối để đối chiếu với token trong edge.conf.
  // Khóa cấp từ trước khi lưu 7 ký tự cuối không có gì để so, chỉ báo đã cấp.
  return hint ? `edge_xxxxxxxx${hint}` : 'Đã cấp';
}

export function stationDetail(st: EdgeStationStatus): DetailSection[] {
  return [
    {
      title: 'Thông tin trạm',
      fields: [
        { label: 'Mã trạm', value: st.code },
        { label: 'Tên trạm / Thiết bị', value: st.name },
        { label: 'Trạm xăng trực thuộc', value: `${st.branch_name} (${st.branch_code})` },
        { label: 'Phiên bản', value: st.agent_version },
        { label: 'Khóa API', value: <span className="font-mono">{apiKeyLabel(st.has_api_key, st.api_key_hint, st.has_station)}</span>, wide: true },
      ],
    },
    {
      title: 'Kết nối & đồng bộ',
      fields: [
        {
          label: 'Trạng thái kết nối',
          value: <StatusBadge tone={st.is_online ? 'success' : 'neutral'}>{st.is_online ? 'Online' : 'Offline'}</StatusBadge>,
        },
        { label: 'Hàng đợi chờ gửi', value: formatNumberVN(st.pending_queue) },
        { label: 'Lần thấy cuối (Heartbeat)', value: dateTime(st.last_seen_at) },
        { label: 'Lần đồng bộ cuối', value: dateTime(st.last_sync_at) },
        { label: 'Lỗi gần nhất', value: st.last_error ?? 'Bình thường', wide: true },
      ],
    },
    auditSection(st.created_at, st.updated_at),
  ];
}
