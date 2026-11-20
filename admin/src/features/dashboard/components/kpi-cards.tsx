'use client';

import * as React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import {
  FireIcon,
  CheckCircleIcon,
  ServerIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';
import { DashboardKpi } from '../types';
import { formatNumberVN } from '@/lib/format';

interface KpiCardsProps {
  kpi?: DashboardKpi;
  isLoading?: boolean;
}

export function KpiCards({ kpi, isLoading }: KpiCardsProps) {
  const cards = [
    {
      title: 'Nhiên liệu cấp hôm nay',
      value: kpi ? `${formatNumberVN(kpi.today_total_liters, 1)} Lít` : '—',
      subtext: kpi ? `${kpi.today_completed_sessions} lượt hoàn thành` : '',
      icon: FireIcon,
      color: 'text-primary',
      bg: 'bg-primary/10',
    },
    {
      title: 'Tỷ lệ phiên thành công',
      value: kpi
        ? kpi.today_total_sessions > 0
          ? `${Math.round((kpi.today_completed_sessions / kpi.today_total_sessions) * 100)}%`
          : '100%'
        : '—',
      subtext: kpi ? `${kpi.today_failed_sessions} lượt thất bại/hủy` : '',
      icon: CheckCircleIcon,
      color: 'text-emerald-600',
      bg: 'bg-emerald-500/10',
    },
    {
      title: 'Trụ bơm & Trạm kết nối',
      value: kpi ? `${kpi.active_pumps} Trụ` : '—',
      subtext: kpi ? `${kpi.online_stations} trạm Edge Online` : '',
      icon: ServerIcon,
      color: 'text-blue-600',
      bg: 'bg-blue-500/10',
    },
    {
      title: 'Cảnh báo mức tồn bể',
      value: kpi ? `${kpi.low_stock_tanks} Bể` : '—',
      subtext: kpi && kpi.low_stock_tanks > 0 ? 'Cần nhập bổ sung gấp' : 'Tất cả ở mức an toàn',
      icon: ExclamationTriangleIcon,
      color: kpi && kpi.low_stock_tanks > 0 ? 'text-destructive font-bold' : 'text-muted-foreground',
      bg: kpi && kpi.low_stock_tanks > 0 ? 'bg-destructive/10' : 'bg-muted',
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((c) => {
        const Icon = c.icon;
        return (
          <Card key={c.title} className="border-border">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground font-medium">{c.title}</p>
                <div className="text-2xl font-bold tracking-tight mt-1 tabular-nums">
                  {isLoading ? '...' : c.value}
                </div>
                {c.subtext && (
                  <p className="text-[11px] text-muted-foreground mt-0.5">{c.subtext}</p>
                )}
              </div>
              <div className={`p-2.5 rounded-lg ${c.bg}`}>
                <Icon className={`w-5 h-5 ${c.color}`} />
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
