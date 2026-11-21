import * as React from 'react';
import { cn } from '@/lib/utils';

/** Màu theo ý nghĩa: xanh lá = đang hoạt động / đã hoàn tất tốt, đỏ = ngừng / lỗi / từ chối, vàng = chờ xử lý / cần chú ý, xanh chủ đạo của hệ thống = đã chốt / thông tin, xám = nháp / đã hủy / trung tính. */
export type StatusTone = 'success' | 'danger' | 'warning' | 'info' | 'neutral';

/** Dùng bộ màu của hệ thống (đã có sẵn bản sáng/tối) để mọi nhãn trạng thái đồng nhất với giao diện. */
const TONE_CLASSES: Record<StatusTone, { badge: string }> = {
  success: { badge: 'border-success-border bg-success-subtle text-success-subtle-foreground' },
  danger: { badge: 'border-destructive-border bg-destructive-subtle text-destructive-subtle-foreground' },
  warning: { badge: 'border-warning-border bg-warning-subtle text-warning-subtle-foreground' },
  info: { badge: 'border-primary-border bg-primary-subtle text-primary-subtle-foreground' },
  neutral: { badge: 'border-border bg-muted text-muted-foreground' },
};

interface StatusBadgeProps {
  tone: StatusTone;
  children: React.ReactNode;
  className?: string;
}

/** Nhãn trạng thái dùng chung cho mọi bảng: nền và chữ cùng tông màu để nhìn là biết ngay. */
export function StatusBadge({ tone, children, className }: StatusBadgeProps) {
  const classes = TONE_CLASSES[tone];
  return (
    <span
      className={cn(
        'inline-flex items-center rounded border px-2 py-0.5 text-xs font-medium whitespace-nowrap',
        classes.badge,
        className
      )}
    >
      {children}
    </span>
  );
}
