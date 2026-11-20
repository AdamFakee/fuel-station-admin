'use client';

import * as React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { SignalIcon, ExclamationTriangleIcon, CircleStackIcon, ServerIcon } from '@heroicons/react/24/outline';
import { SyncMonitorSummary } from '../types';
import { formatNumberVN } from '@/lib/format';

interface SyncSummaryCardsProps {
  summary?: SyncMonitorSummary;
  isLoading?: boolean;
}

export function SyncSummaryCards({ summary, isLoading }: SyncSummaryCardsProps) {
  const cards = [
    {
      title: 'Tổng số Trạm Edge',
      value: summary ? formatNumberVN(summary.total_stations) : '—',
      icon: ServerIcon,
      color: 'text-primary',
      bg: 'bg-primary/10',
    },
    {
      title: 'Đang kết nối (Online)',
      value: summary ? formatNumberVN(summary.online_stations) : '—',
      icon: SignalIcon,
      color: 'text-emerald-600',
      bg: 'bg-emerald-500/10',
    },
    {
      title: 'Mất kết nối (Offline)',
      value: summary ? formatNumberVN(summary.offline_stations) : '—',
      icon: ExclamationTriangleIcon,
      color: summary && summary.offline_stations > 0 ? 'text-destructive' : 'text-muted-foreground',
      bg: summary && summary.offline_stations > 0 ? 'bg-destructive/10' : 'bg-muted',
    },
    {
      title: 'Hàng đợi chờ đẩy lên',
      value: summary ? formatNumberVN(summary.total_pending_queue) : '—',
      icon: CircleStackIcon,
      color: summary && summary.total_pending_queue > 0 ? 'text-amber-600' : 'text-muted-foreground',
      bg: summary && summary.total_pending_queue > 0 ? 'bg-amber-500/10' : 'bg-muted',
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
