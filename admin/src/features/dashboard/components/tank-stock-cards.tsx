'use client';

import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { CircleStackIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import { TankStockItem } from '../types';
import { formatNumberVN } from '@/lib/format';
import { Empty } from '@/components/empty';

interface TankStockCardsProps {
  tanks: TankStockItem[];
  isLoading?: boolean;
}

export function TankStockCards({ tanks, isLoading }: TankStockCardsProps) {
  if (!isLoading && tanks.length === 0) {
    return (
      <Empty
        title="Chưa có bể chứa nào"
        description="Không tìm thấy bể chứa nhiên liệu thuộc phạm vi chi nhánh được gán."
      />
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {tanks.map((tank) => {
        const isWarning = tank.is_low || tank.stock_pct <= 20;

        return (
          <Card key={tank.tank_id} className={`border-border ${isWarning ? 'border-destructive/40 bg-destructive/5' : ''}`}>
            <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between space-y-0">
              <div className="flex items-center gap-2">
                <CircleStackIcon className={`w-5 h-5 ${isWarning ? 'text-destructive' : 'text-primary'}`} />
                <div>
                  <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
                    {tank.tank_name}
                    <span className="font-mono text-xs text-muted-foreground font-normal">({tank.tank_code})</span>
                  </CardTitle>
                  <p className="text-[11px] text-muted-foreground">{tank.branch_name}</p>
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                <Badge variant="outline" className="font-mono text-[10px] px-1.5 py-0 uppercase">
                  {tank.fuel_type_code || 'DO'}
                </Badge>
                {tank.is_low && (
                  <Badge variant="destructive" className="text-[10px] px-1.5 py-0 gap-1">
                    <ExclamationTriangleIcon className="w-3 h-3" />
                    Tồn thấp
                  </Badge>
                )}
              </div>
            </CardHeader>

            <CardContent className="p-4 pt-2 space-y-3">
              {/* Volume and percentage */}
              <div className="flex items-baseline justify-between">
                <div>
                  <span className="text-2xl font-bold tabular-nums text-foreground">
                    {formatNumberVN(tank.stock_liters ?? 0, 0)}
                  </span>
                  <span className="text-xs text-muted-foreground ml-1">Lít</span>
                </div>
                <div className="text-right">
                  <span className={`text-sm font-semibold tabular-nums ${isWarning ? 'text-destructive' : 'text-foreground'}`}>
                    {(tank.stock_pct ?? 0).toFixed(1)}%
                  </span>
                  <p className="text-[10px] text-muted-foreground">
                    Dung tích: {formatNumberVN(tank.max_capacity_liters ?? 0, 0)} L
                  </p>
                </div>
              </div>

              {/* Progress bar */}
              <Progress
                value={tank.stock_pct ?? 0}
                className="h-2"
              />

              {!tank.has_opening && (
                <p className="text-[11px] text-amber-600 bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded">
                  ⚠️ Bể chưa nhập số dư tồn đầu kỳ
                </p>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
