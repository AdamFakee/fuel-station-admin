import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/axios';
import { SyncMonitorResponse } from '../types';

export const syncMonitorKeys = {
  all: ['sync-monitor'] as const,
  stations: () => [...syncMonitorKeys.all, 'stations'] as const,
};

export async function getSyncStations(): Promise<SyncMonitorResponse> {
  const res = await apiClient.get<SyncMonitorResponse>('/sync-monitor/stations');
  return res.data;
}

export function useSyncStations(options?: { refetchInterval?: number | false }) {
  return useQuery({
    queryKey: syncMonitorKeys.stations(),
    queryFn: getSyncStations,
    staleTime: 10 * 1000,
    refetchInterval: options?.refetchInterval ?? 30 * 1000, // BRD: Không realtime, làm mới thủ công hoặc 30 giây
  });
}
