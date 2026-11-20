'use client';

import * as React from 'react';
import { DetailPageHeader } from '@/components/detail-page-header';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { ArrowPathIcon } from '@heroicons/react/24/outline';
import { useSyncStations } from '@/features/sync-monitor/api/get-stations';
import { SyncSummaryCards } from '@/features/sync-monitor/components/sync-summary-cards';
import { StationTable } from '@/features/sync-monitor/components/station-table';
import { SkeletonTable } from '@/components/skeleton-table';

export default function SyncMonitorPage() {
  const [autoRefresh, setAutoRefresh] = React.useState(true);
  const { data, isLoading, isFetching, refetch } = useSyncStations({
    refetchInterval: autoRefresh ? 30 * 1000 : false,
  });

  return (
    <>
      <div className="flex-1 space-y-6 p-6">
        <DetailPageHeader title="Trạng thái trạm & Giám sát đồng bộ">
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
        </DetailPageHeader>

        {/* Operational KPI summary */}
        <SyncSummaryCards summary={data?.summary} isLoading={isLoading} />

        {/* Stations table */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-foreground">
              Danh sách Trạm Edge Agent ({data?.stations.length || 0})
            </h2>
            <span className="text-[11px] text-muted-foreground">
              Ngưỡng mất kết nối (Offline): quá 5 phút không có tín hiệu heartbeat
            </span>
          </div>

          {isLoading ? (
            <SkeletonTable rows={4} cols={8} />
          ) : (
            <StationTable stations={data?.stations || []} isLoading={isLoading} />
          )}
        </div>
      </div>
    </>
  );
}
