import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/axios';
import { StockLedgerItem } from '../types';
import { stocktakeKeys } from './get-tank-stocks';

export interface TankLedgerResponse {
  items: StockLedgerItem[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export async function getTankLedger(
  tankId: string,
  page = 1,
  pageSize = 20
): Promise<TankLedgerResponse> {
  const res = await apiClient.get<TankLedgerResponse>(`/inventory/tanks/${tankId}/ledger`, {
    params: { page, page_size: pageSize },
  });
  return res.data;
}

export function useTankLedger(tankId: string, page = 1, pageSize = 20, enabled = true) {
  return useQuery({
    queryKey: stocktakeKeys.tankLedger(tankId, page, pageSize),
    queryFn: () => getTankLedger(tankId, page, pageSize),
    enabled: enabled && Boolean(tankId),
  });
}
