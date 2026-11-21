import * as React from 'react';
import { DetailSection } from '@/components/detail-dialog';
import { StatusBadge } from '@/components/status-badge';
import { formatDateTimeVN, formatNumberVN } from '@/lib/format';
import type { Branch, PumpDetail, Tank } from '@/features/assets/types';
import type { UserListItem } from '@/features/iam/types';
import type { DriverListItem, VehicleListItem } from '@/features/master/types';
import type { QuotaRule } from '@/features/quota/types';
import type { AlertItem, StockReconciliationItem } from '@/features/inventory/types';
import type { AccessEventListItem } from '@/features/dispense/types';

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
        { label: 'Mật khẩu', value: p.terminal ? (p.terminal.has_password ? 'Đã đặt' : 'Chưa đặt') : undefined },
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
        { label: 'Trạm xăng phụ trách', value: u.branch_names?.join(', '), wide: true },
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
        { label: 'Trạm xăng được đổ', value: v.branch_names?.join(', '), wide: true },
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
        { label: 'Mã nhân viên', value: d.code },
        { label: 'Trạng thái', value: <StatusBadge tone={status.tone}>{status.label}</StatusBadge> },
        { label: 'Họ và tên', value: d.full_name },
        { label: 'Số điện thoại', value: d.phone },
        { label: 'Bộ phận', value: d.department },
        { label: 'Hiệu lực', value: d.valid_from || d.valid_to ? `${d.valid_from ?? '…'} → ${d.valid_to ?? 'không thời hạn'}` : 'Không thời hạn' },
        { label: 'Ghi chú', value: d.note, wide: true },
      ],
    },
    {
      title: 'Phương thức xác thực',
      fields: [
        { label: 'Thẻ NFC', value: d.card_number || 'Chưa có' },
        { label: 'Khuôn mặt', value: d.has_face ? 'Đã đăng ký' : 'Chưa có' },
        { label: 'Vân tay', value: d.has_fingerprint ? 'Đã đăng ký' : 'Chưa có' },
      ],
    },
    auditSection(d.created_at, d.updated_at),
  ];
}

const PERIOD_LABEL: Record<string, string> = { per_dispense: 'Từng lần', day: 'Theo ngày', week: 'Theo tuần', month: 'Theo tháng' };

export function quotaRuleDetail(r: QuotaRule): DetailSection[] {
  return [
    {
      title: 'Quy tắc định mức',
      fields: [
        { label: 'Mã quy tắc', value: r.code },
        {
          label: 'Trạng thái',
          value: <StatusBadge tone={r.status === 'active' ? 'success' : 'neutral'}>{r.status === 'active' ? 'Hiệu lực' : 'Đã hủy'}</StatusBadge>,
        },
        { label: 'Xe áp dụng', value: [r.target_code, r.target_name].filter(Boolean).join(' · ') },
        { label: 'Chu kỳ', value: PERIOD_LABEL[r.period] ?? r.period },
        { label: 'Định mức tối đa', value: `${formatNumberVN(r.max_volume_liters)} L` },
        { label: 'Giãn cách tối thiểu', value: r.min_interval_minutes ? `${r.min_interval_minutes} phút` : 'Không giới hạn' },
        { label: 'Hiệu lực từ', value: dateTime(r.effective_from) },
        { label: 'Hiệu lực đến', value: r.effective_to ? dateTime(r.effective_to) : 'Không thời hạn' },
      ],
    },
    auditSection(r.created_at, r.updated_at),
  ];
}

const ALERT_KIND: Record<string, string> = {
  low_stock: 'Tồn kho thấp',
  loss_variance: 'Lệch ngưỡng hao hụt',
  station_offline: 'Trạm mất kết nối',
  sync_error: 'Lỗi đồng bộ',
};

export function alertDetail(a: AlertItem): DetailSection[] {
  return [
    {
      title: 'Cảnh báo',
      fields: [
        { label: 'Loại cảnh báo', value: ALERT_KIND[a.kind] ?? a.kind },
        {
          label: 'Trạng thái',
          value: <StatusBadge tone={a.resolved_at ? 'success' : 'danger'}>{a.resolved_at ? 'Đã xử lý' : 'Chưa xử lý'}</StatusBadge>,
        },
        { label: 'Trạm xăng', value: a.branch_name },
        { label: 'Bể chứa', value: a.tank_name },
        { label: 'Trạm Edge', value: a.edge_station_name },
        { label: 'Phát sinh lúc', value: dateTime(a.created_at) },
        { label: 'Xử lý lúc', value: a.resolved_at ? dateTime(a.resolved_at) : undefined },
        { label: 'Nội dung', value: a.message, wide: true },
      ],
    },
  ];
}

export function stocktakeDetail(s: StockReconciliationItem): DetailSection[] {
  return [
    {
      title: 'Kỳ đối chiếu',
      fields: [
        { label: 'Ngày', value: s.period_date },
        { label: 'Trạm xăng', value: s.branch_name },
        { label: 'Bể chứa', value: `${s.tank_name} (${s.tank_code})` },
        { label: 'Loại nhiên liệu', value: s.fuel_type_name },
      ],
    },
    {
      title: 'Số liệu sổ sách',
      fields: [
        { label: 'Tồn đầu kỳ', value: `${formatNumberVN(s.opening_liters)} L` },
        { label: 'Nhập trong kỳ', value: `${formatNumberVN(s.receipts_liters)} L` },
        { label: 'Xuất bơm', value: `${formatNumberVN(s.dispensed_liters)} L` },
        { label: 'Xuất điều chỉnh', value: `${formatNumberVN(s.other_issues_liters)} L` },
        { label: 'Tồn cuối sổ', value: `${formatNumberVN(s.book_closing_liters)} L` },
      ],
    },
    {
      title: 'Thực đo & chênh lệch',
      fields: [
        { label: 'Thực đo (que thăm)', value: s.measured_liters !== undefined ? `${formatNumberVN(s.measured_liters)} L` : 'Chưa đo' },
        { label: 'Số tích lũy đồng hồ', value: s.pump_totalizer_liters !== undefined ? `${formatNumberVN(s.pump_totalizer_liters)} L` : undefined },
        { label: 'Chênh lệch', value: s.variance_liters !== undefined ? `${formatNumberVN(s.variance_liters)} L (${formatNumberVN(s.variance_pct, 2)} %)` : undefined },
        { label: 'Dung sai cho phép', value: `${formatNumberVN(s.tolerance_pct)} %` },
        { label: 'Người đo', value: s.measured_by_name },
      ],
    },
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
