import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/axios';
import { ConfirmReconciliationRequest, StockReconciliationItem } from '../types';
import { stocktakeKeys } from './get-tank-stocks';

export interface ConfirmPayload {
  id: string;
  data: ConfirmReconciliationRequest;
}

export async function confirmReconciliation({
  id,
  data,
}: ConfirmPayload): Promise<StockReconciliationItem> {
  const res = await apiClient.post<StockReconciliationItem>(
    `/inventory/stocktake/${id}/confirm`,
    data
  );
  return res.data;
}

export function useConfirmReconciliation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: confirmReconciliation,
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: stocktakeKeys.all });
      queryClient.invalidateQueries({
        queryKey: stocktakeKeys.reconciliationDetail(variables.id),
      });
    },
  });
}
