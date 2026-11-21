import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/axios';
import { StockReceipt } from '../types';
import { receiptKeys } from './get-receipts';

export async function getReceipt(id: string): Promise<StockReceipt> {
  const res = await apiClient.get<StockReceipt>(`/inventory/receipts/${id}`);
  return res.data;
}

/**
 * Danh sách phiếu không kèm các dòng bể, nên khi xem hoặc sửa một phiếu phải lấy bản đầy đủ.
 * Trả về bản đầy đủ khi đã tải xong, trong lúc chờ thì trả tạm dòng của danh sách.
 */
export function useFullReceipt(listItem: StockReceipt | null, enabled: boolean) {
  const { data } = useReceipt(listItem?.id ?? '', enabled && !!listItem);
  return data ?? listItem;
}

export function useReceipt(id: string, enabled = true) {
  return useQuery({
    queryKey: receiptKeys.detail(id),
    queryFn: () => getReceipt(id),
    enabled: !!id && enabled,
  });
}
