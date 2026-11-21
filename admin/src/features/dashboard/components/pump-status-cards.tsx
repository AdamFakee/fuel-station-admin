'use client';

import * as React from 'react';
import Link from 'next/link';
import { Cell, Pie, PieChart } from 'recharts';
import { AdjustmentsHorizontalIcon } from '@heroicons/react/24/outline';
import { ChartContainer, type ChartConfig } from '@/components/ui/chart';
import { PumpStatusItem } from '../types';

const chartConfig = {
  online: { label: 'Đang kết nối', color: '#10b981' },
  offline: { label: 'Mất kết nối', color: '#ef4444' },
} satisfies ChartConfig;

interface PumpStatusCardsProps {
  pumps: PumpStatusItem[];
  isLoading?: boolean;
}

interface StationSummary {
  branchName: string;
  total: number;
  offline: number;
}

/** Mất kết nối là chuyện của trạm Edge, nên tóm tắt theo trạm (trạm xăng): bao nhiêu trụ offline trên tổng số trụ của trạm. */
function summarizeByStation(pumps: PumpStatusItem[]): StationSummary[] {
  const byBranch = new Map<string, StationSummary>();
  for (const pump of pumps) {
    const current = byBranch.get(pump.branch_name) ?? { branchName: pump.branch_name, total: 0, offline: 0 };
    current.total += 1;
    if (!pump.is_station_online) current.offline += 1;
    byBranch.set(pump.branch_name, current);
  }
  return [...byBranch.values()].sort((a, b) => b.offline - a.offline);
}

/** Khối "Trụ bơm": biểu đồ vòng trụ đang kết nối so với mất kết nối, kèm các trạm đang có trụ offline. */
export function PumpStatusCards({ pumps, isLoading }: PumpStatusCardsProps) {
  const stations = summarizeByStation(pumps);
  const offlineStations = stations.filter((station) => station.offline > 0);
  const offlineCount = pumps.filter((pump) => !pump.is_station_online).length;
  const onlineCount = pumps.length - offlineCount;
  const chartData = [
    { name: 'online', value: onlineCount },
    { name: 'offline', value: offlineCount },
  ];

  return (
    <section className="flex flex-col rounded-xl border bg-card shadow-sm">
      <header className="flex items-center justify-between gap-2 border-b px-4 py-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <AdjustmentsHorizontalIcon className="h-4 w-4 text-primary" />
          Trụ bơm
        </h2>
        <Link href="/pumps" className="text-xs text-primary hover:underline">
          Xem tất cả
        </Link>
      </header>

      <div className="flex flex-1 flex-col gap-4 p-4">
        <div className="flex items-center gap-6">
          <div className="relative h-[140px] w-[140px] shrink-0">
            <ChartContainer config={chartConfig} className="h-full w-full">
              <PieChart>
                <Pie
                  data={pumps.length === 0 ? [{ name: 'empty', value: 1 }] : chartData}
                  dataKey="value"
                  innerRadius={46}
                  outerRadius={64}
                  strokeWidth={0}
                  isAnimationActive={false}
                >
                  {pumps.length === 0 ? (
                    <Cell fill="var(--muted)" />
                  ) : (
                    chartData.map((slice) => <Cell key={slice.name} fill={`var(--color-${slice.name})`} />)
                  )}
                </Pie>
              </PieChart>
            </ChartContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-2xl font-bold tabular-nums">{isLoading ? '...' : pumps.length}</span>
              <span className="text-xs text-muted-foreground">trụ</span>
            </div>
          </div>

          <ul className="space-y-2 text-sm">
            <li className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
              Đang kết nối
              <b className="ml-1 tabular-nums">{onlineCount}</b>
            </li>
            <li className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-red-500" />
              Mất kết nối
              <b className="ml-1 tabular-nums">{offlineCount}</b>
            </li>
          </ul>
        </div>

        {offlineStations.length > 0 && (
          <ul className="divide-y rounded-lg border">
            {offlineStations.slice(0, 4).map((station) => (
              <li key={station.branchName} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                <span className="truncate">{station.branchName}</span>
                <span className="shrink-0 rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700 dark:bg-red-950/40 dark:text-red-300">
                  {station.offline}/{station.total} trụ offline
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
