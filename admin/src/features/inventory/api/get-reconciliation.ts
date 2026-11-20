import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/axios';
import { StockReconciliationItem } from '../types';
import { stocktakeKeys } from './get-tank-stocks';

export async function getReconciliation(id: string): Promise<StockReconciliationItem> {
  const res = await apiClient.get<StockReconciliationItem>(`/inventory/stocktake/${id}`);
  return res.data;
}

export function useReconciliation(id: string, enabled = true) {
  return useQuery({
    queryKey: stocktakeKeys.reconciliationDetail(id),
    queryFn: () => getReconciliation(id),
    enabled: enabled && Boolean(id),
  });
}
