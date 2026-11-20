'use client';

import * as React from 'react';
import { AdminShell } from '@/components/admin-shell';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { ArrowPathIcon, CircleStackIcon, ClockIcon, AdjustmentsHorizontalIcon } from '@heroicons/react/24/outline';
import { useDashboard } from '@/features/dashboard/api/get-dashboard';
import { KpiCards } from '@/features/dashboard/components/kpi-cards';
import { TankStockCards } from '@/features/dashboard/components/tank-stock-cards';
import { PumpStatusCards } from '@/features/dashboard/components/pump-status-cards';
import { RecentSessionsTable } from '@/features/dashboard/components/recent-sessions-table';
import { SkeletonTable } from '@/components/skeleton-table';

export default function DashboardPage() {
  const [autoRefresh, setAutoRefresh] = React.useState(true);
  const { data, isLoading, isFetching, refetch } = useDashboard({
    refetchInterval: autoRefresh ? 30 * 1000 : false,
  });

  return (
    <AdminShell>
      <div className="space-y-6">
        {/* Header & Controls */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-border">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-foreground">
              Bảng điều khiển & Giám sát vận hành
            </h1>
            <p className="text-xs text-muted-foreground mt-1">
              Theo dõi trực tiếp lượng cấp phát (Lít), mức tồn khả dụng từng bể chứa và trạng thái kết nối trụ bơm.
            </p>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 bg-muted/50 px-3 py-1.5 rounded-md border border-border">
              <Switch
                id="auto-refresh"
                checked={autoRefresh}
                onCheckedChange={setAutoRefresh}
              />
              <Label htmlFor="auto-refresh" className="text-xs text-muted-foreground cursor-pointer">
                Tự làm mới (30s)
              </Label>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              disabled={isFetching}
              className="gap-1.5"
            >
              <ArrowPathIcon className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin' : ''}`} />
              <span className="text-xs">{isFetching ? 'Đang tải...' : 'Làm mới'}</span>
            </Button>
          </div>
        </div>

        {/* 1. KPI Cards */}
        <KpiCards kpi={data?.kpi} isLoading={isLoading} />

        {/* 2. Tank Stock Levels */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <CircleStackIcon className="w-4 h-4 text-primary" />
            <h2 className="text-sm font-semibold text-foreground">
              Mức tồn kho bể chứa nhiên liệu ({data?.tanks.length || 0})
            </h2>
          </div>
          <TankStockCards tanks={data?.tanks || []} isLoading={isLoading} />
        </div>

        {/* 3. Pump Statuses & Edge Stations */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <AdjustmentsHorizontalIcon className="w-4 h-4 text-primary" />
            <h2 className="text-sm font-semibold text-foreground">
              Trạng thái trụ bơm & Kết nối trạm Edge ({data?.pumps.length || 0})
            </h2>
          </div>
          <PumpStatusCards pumps={data?.pumps || []} isLoading={isLoading} />
        </div>

        {/* 4. Recent Dispense Sessions */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ClockIcon className="w-4 h-4 text-primary" />
              <h2 className="text-sm font-semibold text-foreground">
                Giao dịch cấp phát nhiên liệu gần nhất
              </h2>
            </div>
            <span className="text-[11px] text-muted-foreground">
              Cập nhật lúc: {data?.generated_at ? new Date(data.generated_at).toLocaleTimeString('vi-VN') : '—'}
            </span>
          </div>

          {isLoading ? (
            <SkeletonTable rows={5} cols={7} />
          ) : (
            <RecentSessionsTable sessions={data?.recent_sessions || []} isLoading={isLoading} />
          )}
        </div>
      </div>
    </AdminShell>
  );
}
