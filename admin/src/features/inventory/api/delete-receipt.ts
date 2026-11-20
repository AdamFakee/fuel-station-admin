import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/axios';
import { receiptKeys } from './get-receipts';

export async function deleteReceipt(id: string): Promise<void> {
  await apiClient.delete(`/inventory/receipts/${id}`);
}

export function useDeleteReceipt() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteReceipt,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: receiptKeys.all });
    },
  });
}
