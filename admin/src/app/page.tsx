'use client';

import { ClockIcon } from '@heroicons/react/24/outline';
import { useDashboard } from '@/features/dashboard/api/get-dashboard';
import { KpiCards } from '@/features/dashboard/components/kpi-cards';
import { DispenseTrendChart } from '@/features/dashboard/components/dispense-trend-chart';
import { StockByFuelChart } from '@/features/dashboard/components/stock-by-fuel-chart';
import { TankStockCards } from '@/features/dashboard/components/tank-stock-cards';
import { PumpStatusCards } from '@/features/dashboard/components/pump-status-cards';
import { RecentSessionsTable } from '@/features/dashboard/components/recent-sessions-table';
import { SkeletonTable } from '@/components/skeleton-table';

export default function DashboardPage() {
  const { data, isLoading } = useDashboard();

  return (
    <>
      <div className="flex min-h-0 flex-1 flex-col gap-6 p-6">
        {/* 1. KPI Cards */}
        <KpiCards kpi={data?.kpi} isLoading={isLoading} />

        {/* 2. Biểu đồ: cấp phát 7 ngày và tồn kho theo nhiên liệu */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
          <div className="lg:col-span-3">
            <DispenseTrendChart data={data?.daily_dispense || []} isLoading={isLoading} />
          </div>
          <div className="lg:col-span-2">
            <StockByFuelChart tanks={data?.tanks || []} isLoading={isLoading} />
          </div>
        </div>

        {/* 3. Cảnh báo: chỉ bể và trụ có vấn đề */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <TankStockCards tanks={data?.tanks || []} isLoading={isLoading} />
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
    </>
  );
}
