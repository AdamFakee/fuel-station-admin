'use client';

import { useAuth } from '@/features/auth/hooks/use-auth';
import * as React from 'react';
import { StatCard } from '@/components/stat-card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { StocktakeTable } from '@/features/inventory/components/stocktake-table';
import { TankStockCards } from '@/features/inventory/components/tank-stock-cards';
import { AlertTable } from '@/features/inventory/components/alert-table';
import { useStocktakeSummary } from '@/features/inventory/api/get-stocktake-summary';
import { formatNumberVN } from '@/lib/format';
import { AlertTriangleIcon, RulerIcon, ShieldAlertIcon, FlameIcon, PlusIcon } from 'lucide-react';

export default function StocktakePage() {
  const { hasPermission } = useAuth();
  const [activeTab, setActiveTab] = React.useState<string>('reconciliations');
  const [branchFilter, setBranchFilter] = React.useState<string>('');
  const [createRequestId, setCreateRequestId] = React.useState(0);

  const { data: summary, isLoading: summaryLoading } = useStocktakeSummary(branchFilter || undefined);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-6 p-6">
      {/* KPI Summary Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Tổng tồn kho toàn bể"
          value={summaryLoading ? '...' : `${formatNumberVN(summary?.total_stock_liters ?? 0)} L`}
          icon={FlameIcon}
          tone="primary"
        />
        <StatCard
          label="Bể dưới mức tồn tối thiểu"
          value={summaryLoading ? '...' : (summary?.low_stock_tanks ?? 0)}
          icon={AlertTriangleIcon}
          tone={(summary?.low_stock_tanks ?? 0) > 0 ? 'danger' : 'neutral'}
        />
        <StatCard
          label="Phiếu chờ nhập số đo"
          value={summaryLoading ? '...' : (summary?.open_stocktakes ?? 0)}
          icon={RulerIcon}
          tone="primary"
        />
        <StatCard
          label="Phiếu vượt ngưỡng sai số"
          value={summaryLoading ? '...' : (summary?.alert_stocktakes ?? 0)}
          icon={ShieldAlertIcon}
          tone={(summary?.alert_stocktakes ?? 0) > 0 ? 'danger' : 'neutral'}
        />
      </div>

      {/* Hành động của trang (nằm trên cùng, không chen vào thanh lọc) */}
      {activeTab === 'reconciliations' && hasPermission('inventory.stocktake:create') && (
        <div className="flex justify-end">
          <Button onClick={() => setCreateRequestId((id) => id + 1)}>
            <PlusIcon className="mr-2 h-4 w-4" />
            Khởi tạo kỳ đối chiếu
          </Button>
        </div>
      )}

      {/* Tabs navigation */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex min-h-0 flex-1 flex-col gap-4">
        <div>
          <TabsList>
            <TabsTrigger value="reconciliations">Kỳ đối chiếu</TabsTrigger>
            <TabsTrigger value="tanks">Tồn kho & Thẻ kho</TabsTrigger>
            <TabsTrigger value="alerts">Cảnh báo</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="reconciliations" className="flex min-h-0 flex-col gap-4 data-[state=active]:flex-1">
          <StocktakeTable
            branchFilter={branchFilter}
            onBranchFilterChange={setBranchFilter}
            createRequestId={createRequestId}
          />
        </TabsContent>

        <TabsContent value="tanks" className="space-y-4">
          <TankStockCards branchFilter={branchFilter} onBranchFilterChange={setBranchFilter} />
        </TabsContent>

        <TabsContent value="alerts" className="flex min-h-0 flex-col gap-4 data-[state=active]:flex-1">
          <AlertTable branchFilter={branchFilter} onBranchFilterChange={setBranchFilter} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
