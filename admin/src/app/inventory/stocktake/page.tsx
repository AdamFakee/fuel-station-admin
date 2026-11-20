'use client';

import * as React from 'react';
import { DetailPageHeader } from '@/components/detail-page-header';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { StocktakeTable } from '@/features/inventory/components/stocktake-table';
import { TankStockCards } from '@/features/inventory/components/tank-stock-cards';
import { AlertTable } from '@/features/inventory/components/alert-table';
import { useStocktakeSummary } from '@/features/inventory/api/get-stocktake-summary';
import { formatNumberVN } from '@/lib/format';
import {
  AlertTriangleIcon,
  RulerIcon,
  ShieldAlertIcon,
  FlameIcon,
} from 'lucide-react';

export default function StocktakePage() {
  const [activeTab, setActiveTab] = React.useState<string>('reconciliations');
  const [branchFilter, setBranchFilter] = React.useState<string>('');

  const { data: summary, isLoading: summaryLoading } = useStocktakeSummary(
    branchFilter || undefined
  );

  return (
    <div className="flex-1 flex flex-col p-6 space-y-6">
      <DetailPageHeader
        title="Kiểm kê & Đối chiếu Nhiên liệu"
        subtitle="Hệ thống quản lý tồn kho bể chứa, đối soát que thăm và giám sát cảnh báo hao hụt (Module M12)"
      />

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Tổng tồn kho */}
        <div className="p-4 rounded-xl border bg-card text-card-foreground shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-muted-foreground">Tổng tồn kho toàn bể</p>
            <div className="text-2xl font-bold tracking-tight tabular-nums mt-1 text-primary">
              {summaryLoading ? '...' : `${formatNumberVN(summary?.total_stock_liters ?? 0)} L`}
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">Thể tích thực tế ghi nhận sổ sách</p>
          </div>
          <div className="p-2.5 rounded-lg bg-primary/10 text-primary">
            <FlameIcon className="h-5 w-5" />
          </div>
        </div>

        {/* Card 2: Bể tồn thấp */}
        <div className="p-4 rounded-xl border bg-card text-card-foreground shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-muted-foreground">Bể dưới mức tồn tối thiểu</p>
            <div
              className={`text-2xl font-bold tracking-tight tabular-nums mt-1 ${
                (summary?.low_stock_tanks ?? 0) > 0 ? 'text-amber-600' : 'text-foreground'
              }`}
            >
              {summaryLoading ? '...' : summary?.low_stock_tanks ?? 0}
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">Cần lên kế hoạch nhập hàng</p>
          </div>
          <div className="p-2.5 rounded-lg bg-amber-500/10 text-amber-600">
            <AlertTriangleIcon className="h-5 w-5" />
          </div>
        </div>

        {/* Card 3: Phiếu chờ đo */}
        <div className="p-4 rounded-xl border bg-card text-card-foreground shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-muted-foreground">Phiếu chờ nhập số đo</p>
            <div
              className={`text-2xl font-bold tracking-tight tabular-nums mt-1 ${
                (summary?.open_stocktakes ?? 0) > 0 ? 'text-blue-600' : 'text-foreground'
              }`}
            >
              {summaryLoading ? '...' : summary?.open_stocktakes ?? 0}
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">Chưa nhập que thăm / cảm biến</p>
          </div>
          <div className="p-2.5 rounded-lg bg-blue-500/10 text-blue-600">
            <RulerIcon className="h-5 w-5" />
          </div>
        </div>

        {/* Card 4: Phiếu lệch ngưỡng */}
        <div className="p-4 rounded-xl border bg-card text-card-foreground shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-muted-foreground">Phiếu vượt ngưỡng sai số</p>
            <div
              className={`text-2xl font-bold tracking-tight tabular-nums mt-1 ${
                (summary?.alert_stocktakes ?? 0) > 0 ? 'text-rose-600' : 'text-foreground'
              }`}
            >
              {summaryLoading ? '...' : summary?.alert_stocktakes ?? 0}
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">Cần Kế toán xác minh hao hụt</p>
          </div>
          <div className="p-2.5 rounded-lg bg-rose-500/10 text-rose-600">
            <ShieldAlertIcon className="h-5 w-5" />
          </div>
        </div>
      </div>

      {/* Tabs navigation */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid grid-cols-3 max-w-md">
          <TabsTrigger value="reconciliations" className="text-xs">
            Kỳ đối chiếu
          </TabsTrigger>
          <TabsTrigger value="tanks" className="text-xs">
            Tồn kho & Thẻ kho
          </TabsTrigger>
          <TabsTrigger value="alerts" className="text-xs">
            Cảnh báo ({summary?.alert_stocktakes ?? 0})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="reconciliations" className="space-y-4">
          <StocktakeTable
            branchFilter={branchFilter}
            onBranchFilterChange={setBranchFilter}
          />
        </TabsContent>

        <TabsContent value="tanks" className="space-y-4">
          <TankStockCards
            branchFilter={branchFilter}
            onBranchFilterChange={setBranchFilter}
          />
        </TabsContent>

        <TabsContent value="alerts" className="space-y-4">
          <AlertTable
            branchFilter={branchFilter}
            onBranchFilterChange={setBranchFilter}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
