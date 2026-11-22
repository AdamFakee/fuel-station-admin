import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/axios';
import { TankStockItem } from '../types';

export const stocktakeKeys = {
  all: ['inventory-stocktake'] as const,
  tankStocks: (branchId?: string) => [...stocktakeKeys.all, 'tank-stocks', branchId] as const,
  tankLedger: (tankId: string, page: number, pageSize: number) =>
    [...stocktakeKeys.all, 'tank-ledger', tankId, page, pageSize] as const,
};

export async function getTankStocks(branchId?: string): Promise<TankStockItem[]> {
  const params: Record<string, string> = {};
  if (branchId && branchId !== 'all') {
    params.branch_id = branchId;
  }
  const res = await apiClient.get<TankStockItem[]>('/inventory/tanks/stock', { params });
  return res.data;
}

export function useTankStocks(branchId?: string) {
  return useQuery({
    queryKey: stocktakeKeys.tankStocks(branchId),
    queryFn: () => getTankStocks(branchId),
  });
}
