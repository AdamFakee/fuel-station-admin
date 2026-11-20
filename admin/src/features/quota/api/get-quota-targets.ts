import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/axios';
import { QuotaTargets } from '../types';
import { quotaKeys } from './get-quota-rules';

export async function getQuotaTargets(): Promise<QuotaTargets> {
  const res = await apiClient.get<QuotaTargets>('/quotas/targets');
  return res.data;
}

export function useQuotaTargets() {
  return useQuery({
    queryKey: quotaKeys.targets(),
    queryFn: getQuotaTargets,
    staleTime: 60 * 1000,
  });
}
