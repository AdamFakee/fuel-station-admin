import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/axios';
import { CreateReceiptRequest, StockReceipt } from '../types';
import { receiptKeys } from './get-receipts';
import { tankKeys } from '@/features/assets/api/get-tanks';

export async function createReceipt(data: CreateReceiptRequest): Promise<StockReceipt> {
  const res = await apiClient.post<StockReceipt>('/inventory/receipts', data);
  return res.data;
}

export function useCreateReceipt() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createReceipt,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: receiptKeys.all });
      queryClient.invalidateQueries({ queryKey: tankKeys.all });
    },
  });
}
