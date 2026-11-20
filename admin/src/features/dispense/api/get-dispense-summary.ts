import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/axios';
import { DispenseSummary } from '../types';
import { dispenseKeys } from './get-sessions';

export async function getDispenseSummary(branchId?: string): Promise<DispenseSummary> {
  const res = await apiClient.get<DispenseSummary>('/dispense/summary', {
    params: branchId ? { branch_id: branchId } : undefined,
  });
  return res.data;
}

export function useDispenseSummary(branchId?: string) {
  return useQuery({
    queryKey: dispenseKeys.summary(branchId),
    queryFn: () => getDispenseSummary(branchId),
    refetchInterval: 30 * 1000, // Refresh every 30 seconds as specified in non-realtime BRD
  });
}
