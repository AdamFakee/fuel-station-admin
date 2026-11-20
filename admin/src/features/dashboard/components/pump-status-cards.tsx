'use client';

import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AdjustmentsHorizontalIcon, SignalSlashIcon } from '@heroicons/react/24/outline';
import { PumpStatusItem } from '../types';
import { formatNumberVN } from '@/lib/format';
import { Empty } from '@/components/empty';

interface PumpStatusCardsProps {
  pumps: PumpStatusItem[];
  isLoading?: boolean;
}

export function PumpStatusCards({ pumps, isLoading }: PumpStatusCardsProps) {
  if (!isLoading && pumps.length === 0) {
    return (
      <Empty
        title="Chưa có trụ bơm nào"
        description="Chưa có trụ bơm nhiên liệu được khai báo cho chi nhánh này."
      />
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {pumps.map((pump) => (
        <Card key={pump.pump_id} className="border-border">
          <CardHeader className="p-3.5 pb-2 flex flex-row items-center justify-between space-y-0">
            <div className="flex items-center gap-2">
              <AdjustmentsHorizontalIcon className="w-4 h-4 text-primary" />
              <div>
                <CardTitle className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  {pump.pump_name}
                  <span className="font-mono text-[10px] text-muted-foreground">({pump.pump_code})</span>
                </CardTitle>
                <p className="text-[10px] text-muted-foreground">{pump.branch_name}</p>
              </div>
            </div>

            {pump.is_station_online ? (
              <Badge variant="outline" className="gap-1 border-emerald-500/30 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 text-[10px] px-1.5 py-0 font-normal">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Online
              </Badge>
            ) : (
              <Badge variant="outline" className="gap-1 border-zinc-300 bg-zinc-50 text-zinc-600 dark:bg-zinc-900 dark:text-zinc-400 text-[10px] px-1.5 py-0 font-normal">
                <SignalSlashIcon className="w-2.5 h-2.5 text-zinc-400" />
                Offline
              </Badge>
            )}
          </CardHeader>

          <CardContent className="p-3.5 pt-2 flex items-center justify-between">
            <div>
              <span className="text-lg font-bold tabular-nums text-foreground">
                {formatNumberVN(pump.today_dispensed_liters, 1)}
              </span>
              <span className="text-[11px] text-muted-foreground ml-1">Lít hôm nay</span>
            </div>
            <div className="text-right">
              <span className="text-xs font-medium tabular-nums text-muted-foreground">
                {pump.today_dispense_count} phiên
              </span>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
