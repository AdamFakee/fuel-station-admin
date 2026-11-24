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

export function useSyncStations(options: { enabled?: boolean } = {}) {
  return useQuery({
    enabled: options.enabled ?? true,
    queryKey: syncMonitorKeys.stations(),
    queryFn: getSyncStations,
    // Không tự làm mới (không realtime, dashboard nặng): dữ liệu tải lại khi mở trang.
    staleTime: 60 * 1000,
    refetchOnWindowFocus: false,
  });
}
