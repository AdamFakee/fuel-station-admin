import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/axios';
import { ApproveReceiptRequest, StockReceipt } from '../types';
import { receiptKeys } from './get-receipts';
import { tankKeys } from '@/features/assets/api/get-tanks';

interface ApproveReceiptArgs {
  id: string;
  data: ApproveReceiptRequest;
}

export async function approveReceipt({ id, data }: ApproveReceiptArgs): Promise<StockReceipt> {
  const res = await apiClient.post<StockReceipt>(`/inventory/receipts/${id}/approve`, data);
  return res.data;
}

export function useApproveReceipt() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: approveReceipt,
    onSuccess: (receipt) => {
      queryClient.invalidateQueries({ queryKey: receiptKeys.all });
      queryClient.invalidateQueries({ queryKey: receiptKeys.detail(receipt.id) });
      queryClient.invalidateQueries({ queryKey: tankKeys.all });
    },
  });
}
