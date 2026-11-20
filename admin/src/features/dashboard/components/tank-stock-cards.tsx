'use client';

import * as React from 'react';
import Link from 'next/link';
import { CheckCircleIcon, CircleStackIcon } from '@heroicons/react/24/outline';
import { Progress } from '@/components/ui/progress';
import { TankStockItem } from '../types';

/** Số bể hiện ở bảng điều khiển: các bể tồn thấp nhất. */
const MAX_TANKS = 5;

/** Bể cần chú ý: tồn thấp, dưới 20% hoặc chưa có số dư đầu kỳ. */
function needsAttention(tank: TankStockItem): boolean {
  return tank.is_low || tank.stock_pct <= 20 || !tank.has_opening;
}

/** Màu thanh theo mức tồn: đỏ dưới 20%, vàng dưới 35%, còn lại xanh. */
function barColorClass(pct: number): string {
  if (pct < 20) return '[&>div]:bg-destructive';
  if (pct < 35) return '[&>div]:bg-amber-500';
  return '[&>div]:bg-emerald-500';
}

interface TankStockCardsProps {
  tanks: TankStockItem[];
  isLoading?: boolean;
}

/** Khối "Bể chứa": tổng quan, rồi các bể tồn thấp nhất (thanh màu theo mức tồn) để thấy ngay bể nào sắp hết. */
export function TankStockCards({ tanks, isLoading }: TankStockCardsProps) {
  const lowestTanks = [...tanks].sort((a, b) => (a.stock_pct ?? 0) - (b.stock_pct ?? 0)).slice(0, MAX_TANKS);
  const attentionCount = tanks.filter(needsAttention).length;

  return (
    <section className="flex flex-col rounded-xl border bg-card shadow-sm">
      <header className="flex items-center justify-between gap-2 border-b px-4 py-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <CircleStackIcon className="h-4 w-4 text-primary" />
          Bể tồn thấp nhất
        </h2>
        <Link href="/tanks" className="text-xs text-primary hover:underline">
          Xem tất cả
        </Link>
      </header>

      <div className="space-y-4 p-4">
        <ul className="space-y-3">
          {lowestTanks.map((tank) => (
            <li key={tank.tank_id} className="grid grid-cols-[minmax(0,12rem)_1fr_3rem] items-center gap-3">
              <span className="min-w-0 text-sm" title={`${tank.tank_name} (${tank.tank_code}) · ${tank.branch_name}`}>
                <span className="block truncate font-medium">{tank.tank_name}</span>
                <span className="block truncate text-xs text-muted-foreground">{tank.fuel_type_name}</span>
              </span>
              <Progress value={tank.stock_pct ?? 0} className={`h-2.5 ${barColorClass(tank.stock_pct ?? 0)}`} />
              <span className="text-right text-sm font-semibold tabular-nums">{(tank.stock_pct ?? 0).toFixed(0)}%</span>
            </li>
          ))}
        </ul>
        {!isLoading && (
          <p className="text-xs text-muted-foreground">
            {attentionCount === 0 ? (
              <span className="inline-flex items-center gap-1 text-emerald-700">
                <CheckCircleIcon className="h-4 w-4" />
                Không bể nào cần chú ý
              </span>
            ) : (
              <span className="font-medium text-destructive">{attentionCount} bể cần chú ý</span>
            )}
          </p>
        )}
      </div>
    </section>
  );
}
