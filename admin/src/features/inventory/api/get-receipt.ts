import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/axios';
import { StockReceipt } from '../types';
import { receiptKeys } from './get-receipts';

export async function getReceipt(id: string): Promise<StockReceipt> {
  const res = await apiClient.get<StockReceipt>(`/inventory/receipts/${id}`);
  return res.data;
}

export function useReceipt(id: string, enabled = true) {
  return useQuery({
    queryKey: receiptKeys.detail(id),
    queryFn: () => getReceipt(id),
    enabled: !!id && enabled,
  });
}
