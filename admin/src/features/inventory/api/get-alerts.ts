import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/axios';
import { AlertItem } from '../types';
import { stocktakeKeys } from './get-tank-stocks';

export async function getAlerts(branchId?: string, resolved?: boolean): Promise<AlertItem[]> {
  const params: Record<string, any> = {};
  if (branchId && branchId !== 'all') {
    params.branch_id = branchId;
  }
  if (resolved !== undefined) {
    params.resolved = resolved;
  }
  const res = await apiClient.get<AlertItem[]>('/inventory/alerts', { params });
  return res.data;
}

export function useAlerts(branchId?: string, resolved?: boolean) {
  return useQuery({
    queryKey: stocktakeKeys.alerts(branchId, resolved),
    queryFn: () => getAlerts(branchId, resolved),
  });
}
