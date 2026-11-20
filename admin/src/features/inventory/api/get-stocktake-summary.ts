import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/axios';
import { StocktakeSummary } from '../types';
import { stocktakeKeys } from './get-tank-stocks';

export async function getStocktakeSummary(branchId?: string): Promise<StocktakeSummary> {
  const params: Record<string, string> = {};
  if (branchId && branchId !== 'all') {
    params.branch_id = branchId;
  }
  const res = await apiClient.get<StocktakeSummary>('/inventory/stocktake/summary', { params });
  return res.data;
}

export function useStocktakeSummary(branchId?: string) {
  return useQuery({
    queryKey: stocktakeKeys.summary(branchId),
    queryFn: () => getStocktakeSummary(branchId),
  });
}
