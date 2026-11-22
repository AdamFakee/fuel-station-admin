import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/axios';
import { StockLedgerResponse } from '../types';

export interface StockLedgerParams {
  branch_id?: string;
  tank_id?: string;
  from_date?: string;
  to_date?: string;
  page?: number;
  page_size?: number;
}

export const reportKeys = {
  all: ['reports'] as const,
  stockLedger: (params?: StockLedgerParams) => [...reportKeys.all, 'stock-ledger', params] as const,
  receipts: (params?: object) => [...reportKeys.all, 'receipts', params] as const,
  dispenses: (params?: object) => [...reportKeys.all, 'dispenses', params] as const,
  vehicleConsumption: (params?: object) => [...reportKeys.all, 'vehicle-consumption', params] as const,
  driverDispense: (params?: object) => [...reportKeys.all, 'driver-dispense', params] as const,
};

export async function getStockLedgerReport(params?: StockLedgerParams): Promise<StockLedgerResponse> {
  const res = await apiClient.get<StockLedgerResponse>('/reports/stock-ledger', { params });
  return res.data;
}

export function useStockLedgerReport(params?: StockLedgerParams) {
  return useQuery({
    queryKey: reportKeys.stockLedger(params),
    queryFn: () => getStockLedgerReport(params),
    // Giữ bảng cũ trong lúc tải trang mới để không bị nháy trắng
    placeholderData: keepPreviousData,
  });
}
