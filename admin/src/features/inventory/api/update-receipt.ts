import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/axios';
import { UpdateReceiptRequest, StockReceipt } from '../types';
import { receiptKeys } from './get-receipts';
import { tankKeys } from '@/features/assets/api/get-tanks';

interface UpdateReceiptArgs {
  id: string;
  data: UpdateReceiptRequest;
}

export async function updateReceipt({ id, data }: UpdateReceiptArgs): Promise<StockReceipt> {
  const res = await apiClient.put<StockReceipt>(`/inventory/receipts/${id}`, data);
  return res.data;
}

export function useUpdateReceipt() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateReceipt,
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: receiptKeys.all });
      queryClient.invalidateQueries({ queryKey: receiptKeys.detail(variables.id) });
      queryClient.invalidateQueries({ queryKey: tankKeys.all });
    },
  });
}
