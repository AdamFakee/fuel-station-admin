'use client';

import * as React from 'react';
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart';
import { formatNumberVN } from '@/lib/format';
import { DailyDispenseItem } from '../types';

const chartConfig = {
  liters: { label: 'Lượng cấp phát (L)', color: 'var(--primary)' },
} satisfies ChartConfig;

/** yyyy-MM-dd thành dd/MM để làm nhãn trục. */
function shortDate(isoDate: string): string {
  const [, month, day] = isoDate.split('-');
  return `${day}/${month}`;
}

interface DispenseTrendChartProps {
  data: DailyDispenseItem[];
  isLoading?: boolean;
}

/** Biểu đồ cột lượng nhiên liệu cấp phát 7 ngày gần nhất. */
export function DispenseTrendChart({ data, isLoading }: DispenseTrendChartProps) {
  const total = data.reduce((sum, day) => sum + day.liters, 0);
  const sessions = data.reduce((sum, day) => sum + day.sessions, 0);

  return (
    <section className="flex flex-col rounded-xl border bg-card shadow-sm">
      <header className="flex flex-wrap items-baseline justify-between gap-2 border-b px-4 py-3">
        <h2 className="text-sm font-semibold">Cấp phát 7 ngày qua</h2>
        {!isLoading && (
          <span className="text-xs text-muted-foreground">
            <b className="tabular-nums text-foreground">{formatNumberVN(total, 0)} L</b> · {sessions} lượt
          </span>
        )}
      </header>
      <div className="p-4">
        <ChartContainer config={chartConfig} className="h-[220px] w-full">
          <BarChart data={data} margin={{ left: 0, right: 8, top: 8 }}>
            <CartesianGrid vertical={false} strokeDasharray="3 3" />
            <XAxis dataKey="date" tickFormatter={shortDate} tickLine={false} axisLine={false} />
            <YAxis tickLine={false} axisLine={false} width={48} tickFormatter={(v) => formatNumberVN(Number(v), 0)} />
            <ChartTooltip
              cursor={{ fill: 'var(--muted)' }}
              content={
                <ChartTooltipContent
                  labelFormatter={(_: unknown, payload: ReadonlyArray<{ payload?: unknown }>) => {
                    const day = payload?.[0]?.payload as DailyDispenseItem | undefined;
                    return day ? `${shortDate(day.date)} · ${day.sessions} lượt` : '';
                  }}
                  formatter={(value: unknown) => `${formatNumberVN(Number(value), 1)} L`}
                />
              }
            />
            <Bar dataKey="liters" fill="var(--color-liters)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ChartContainer>
      </div>
    </section>
  );
}
