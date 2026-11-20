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

export function useDashboard() {
  return useQuery({
    queryKey: dashboardKeys.main(),
    queryFn: getDashboard,
    // Không tự làm mới (không realtime, dashboard nặng): dữ liệu tải lại khi mở trang.
    staleTime: 60 * 1000,
    refetchOnWindowFocus: false,
  });
}
