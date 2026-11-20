import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/axios';
import { DashboardResponse } from '../types';

export const dashboardKeys = {
  all: ['dashboard'] as const,
  main: () => [...dashboardKeys.all, 'main'] as const,
};

export async function getDashboard(): Promise<DashboardResponse> {
  const res = await apiClient.get<DashboardResponse>('/dashboard');
  return res.data;
}

export function useDashboard(options?: { refetchInterval?: number | false }) {
  return useQuery({
    queryKey: dashboardKeys.main(),
    queryFn: getDashboard,
    staleTime: 10 * 1000,
    refetchInterval: options?.refetchInterval ?? 30 * 1000, // BRD: Không realtime, làm mới thủ công hoặc 30 giây
  });
}
