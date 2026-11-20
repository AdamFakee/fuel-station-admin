import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/axios';
import { ReceiptListParams, ReceiptListResponse } from '../types';

export const receiptKeys = {
  all: ['inventory-receipts'] as const,
  list: (params?: ReceiptListParams) => [...receiptKeys.all, 'list', params] as const,
  detail: (id: string) => [...receiptKeys.all, 'detail', id] as const,
};

export async function getReceipts(params?: ReceiptListParams): Promise<ReceiptListResponse> {
  const res = await apiClient.get<ReceiptListResponse>('/inventory/receipts', { params });
  return res.data;
}

export function useReceipts(params?: ReceiptListParams) {
  return useQuery({
    queryKey: receiptKeys.list(params),
    queryFn: () => getReceipts(params),
  });
}
