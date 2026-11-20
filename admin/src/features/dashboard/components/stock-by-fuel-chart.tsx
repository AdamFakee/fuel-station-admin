'use client';

import * as React from 'react';
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart';
import { formatNumberVN } from '@/lib/format';
import { TankStockItem } from '../types';

const chartConfig = {
  stock: { label: 'Tồn hiện tại (L)', color: 'var(--primary)' },
  free: { label: 'Còn chứa được (L)', color: 'var(--muted)' },
} satisfies ChartConfig;

interface FuelStock {
  fuel: string;
  stock: number;
  free: number;
  capacity: number;
}

/** Cộng tồn và dung tích của các bể theo loại nhiên liệu. */
function aggregateByFuel(tanks: TankStockItem[]): FuelStock[] {
  const byFuel = new Map<string, FuelStock>();
  for (const tank of tanks) {
    const fuel = tank.fuel_type_name || tank.fuel_type_code || 'Khác';
    const current = byFuel.get(fuel) ?? { fuel, stock: 0, free: 0, capacity: 0 };
    current.stock += tank.stock_liters ?? 0;
    current.capacity += tank.max_capacity_liters ?? 0;
    byFuel.set(fuel, current);
  }
  return [...byFuel.values()]
    .map((item) => ({ ...item, free: Math.max(item.capacity - item.stock, 0) }))
    .sort((a, b) => b.capacity - a.capacity);
}

interface StockByFuelChartProps {
  tanks: TankStockItem[];
  isLoading?: boolean;
}

/** Biểu đồ cột chồng: với mỗi loại nhiên liệu, phần đã có và phần còn chứa được trong tổng dung tích. */
export function StockByFuelChart({ tanks, isLoading }: StockByFuelChartProps) {
  const data = aggregateByFuel(tanks);
  const totalStock = data.reduce((sum, item) => sum + item.stock, 0);
  const totalCapacity = data.reduce((sum, item) => sum + item.capacity, 0);
  const pct = totalCapacity > 0 ? (totalStock / totalCapacity) * 100 : 0;

  return (
    <section className="flex flex-col rounded-xl border bg-card shadow-sm">
      <header className="flex flex-wrap items-baseline justify-between gap-2 border-b px-4 py-3">
        <h2 className="text-sm font-semibold">Tồn kho theo nhiên liệu</h2>
        {!isLoading && (
          <span className="text-xs text-muted-foreground">
            <b className="tabular-nums text-foreground">{pct.toFixed(0)}%</b> dung tích
          </span>
        )}
      </header>
      <div className="p-4">
        <ChartContainer config={chartConfig} className="h-[220px] w-full">
          <BarChart data={data} layout="vertical" margin={{ left: 0, right: 8 }}>
            <CartesianGrid horizontal={false} strokeDasharray="3 3" />
            <XAxis
              type="number"
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) => `${formatNumberVN(Number(v) / 1000, 0)}k`}
            />
            <YAxis type="category" dataKey="fuel" tickLine={false} axisLine={false} width={120} tick={{ fontSize: 12 }} />
            <ChartTooltip
              cursor={{ fill: 'transparent' }}
              content={<ChartTooltipContent formatter={(value: unknown) => `${formatNumberVN(Number(value), 0)} L`} />}
            />
            <Bar dataKey="stock" stackId="a" fill="var(--color-stock)" radius={[4, 0, 0, 4]} />
            <Bar dataKey="free" stackId="a" fill="var(--color-free)" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ChartContainer>
      </div>
    </section>
  );
}
