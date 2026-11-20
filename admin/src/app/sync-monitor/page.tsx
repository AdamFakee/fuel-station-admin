'use client';

import { useSyncStations } from '@/features/sync-monitor/api/get-stations';
import { SyncSummaryCards } from '@/features/sync-monitor/components/sync-summary-cards';
import { StationTable } from '@/features/sync-monitor/components/station-table';
import { SkeletonTable } from '@/components/skeleton-table';

export default function SyncMonitorPage() {
  const { data, isLoading } = useSyncStations();

  return (
    <>
      <div className="flex min-h-0 flex-1 flex-col gap-6 p-6">
        {/* Operational KPI summary */}
        <SyncSummaryCards summary={data?.summary} isLoading={isLoading} />

        {/* Stations table */}
        <div className="space-y-2">
          <h2 className="text-sm font-semibold text-foreground">Danh sách Trạm Edge Agent</h2>

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
