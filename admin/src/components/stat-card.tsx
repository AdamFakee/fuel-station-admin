import * as React from 'react';
import { cn } from '@/lib/utils';

export type StatTone = 'neutral' | 'primary' | 'success' | 'danger';

const TONE_CLASSES: Record<StatTone, { icon: string; value: string }> = {
  neutral: { icon: 'bg-muted text-muted-foreground', value: 'text-foreground' },
  primary: { icon: 'bg-primary/10 text-primary', value: 'text-foreground' },
  success: { icon: 'bg-emerald-500/10 text-emerald-600', value: 'text-foreground' },
  danger: { icon: 'bg-red-500/10 text-red-600', value: 'text-foreground' },
};

interface StatCardProps {
  label: string;
  value: React.ReactNode;
  icon: React.ComponentType<{ className?: string }>;
  tone?: StatTone;
  className?: string;
}

/** Thẻ số liệu dùng chung: nhãn nhỏ ở trên, số lớn ở dưới, icon trong ô màu nhạt bên phải. Màu chỉ nằm ở icon, số luôn đọc rõ. */
export function StatCard({ label, value, icon: Icon, tone = 'neutral', className }: StatCardProps) {
  const classes = TONE_CLASSES[tone];
  return (
    <div className={cn('@container/stat flex items-center justify-between gap-3 rounded-xl border bg-card px-5 py-4 shadow-xs', className)}>
      <div className="min-w-0">
        <p className="truncate text-xs font-medium text-muted-foreground">{label}</p>
        <p className={cn('mt-1 whitespace-nowrap text-base font-bold leading-tight tabular-nums tracking-tight @[170px]/stat:text-lg @[200px]/stat:text-xl @[240px]/stat:text-2xl', classes.value)} title={typeof value === 'string' || typeof value === 'number' ? String(value) : undefined}>{value}</p>
      </div>
      <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-lg', classes.icon)}>
        <Icon className="h-5 w-5" />
      </div>
    </div>
  );
}
