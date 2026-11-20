import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/axios';
import { StockReconciliationItem, SubmitMeasureRequest } from '../types';
import { stocktakeKeys } from './get-tank-stocks';

export interface SubmitMeasurePayload {
  id: string;
  data: SubmitMeasureRequest;
}

export async function submitMeasuredStock({
  id,
  data,
}: SubmitMeasurePayload): Promise<StockReconciliationItem> {
  const res = await apiClient.put<StockReconciliationItem>(
    `/inventory/stocktake/${id}/measure`,
    data
  );
  return res.data;
}

export function useSubmitMeasuredStock() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: submitMeasuredStock,
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: stocktakeKeys.all });
      queryClient.invalidateQueries({
        queryKey: stocktakeKeys.reconciliationDetail(variables.id),
      });
    },
  });
}
