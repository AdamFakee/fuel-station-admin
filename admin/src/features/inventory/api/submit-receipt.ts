import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/axios';
import { StockReceipt } from '../types';
import { receiptKeys } from './get-receipts';

export async function submitReceipt(id: string): Promise<StockReceipt> {
  const res = await apiClient.post<StockReceipt>(`/inventory/receipts/${id}/submit`);
  return res.data;
}

export function useSubmitReceipt() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: submitReceipt,
    onSuccess: (receipt) => {
      queryClient.invalidateQueries({ queryKey: receiptKeys.all });
      queryClient.invalidateQueries({ queryKey: receiptKeys.detail(receipt.id) });
    },
  });
}
