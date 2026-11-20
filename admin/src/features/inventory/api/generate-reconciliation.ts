import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/axios';
import { CreateReconciliationRequest, StockReconciliationItem } from '../types';
import { stocktakeKeys } from './get-tank-stocks';

export async function generateReconciliation(
  data: CreateReconciliationRequest
): Promise<StockReconciliationItem> {
  const res = await apiClient.post<StockReconciliationItem>('/inventory/stocktake', data);
  return res.data;
}

export function useGenerateReconciliation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: generateReconciliation,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: stocktakeKeys.all });
    },
  });
}
