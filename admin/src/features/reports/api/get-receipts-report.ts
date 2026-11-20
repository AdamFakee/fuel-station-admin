import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/axios';
import { ReceiptReportResponse } from '../types';
import { reportKeys } from './get-stock-ledger-report';

export interface ReceiptReportParams {
  branch_id?: string;
  supplier_id?: string;
  tank_id?: string;
  status?: string;
  from_date?: string;
  to_date?: string;
}

export async function getReceiptsReport(params?: ReceiptReportParams): Promise<ReceiptReportResponse> {
  const res = await apiClient.get<ReceiptReportResponse>('/reports/receipts', { params });
  return res.data;
}

export function useReceiptsReport(params?: ReceiptReportParams) {
  return useQuery({
    queryKey: reportKeys.receipts(params),
    queryFn: () => getReceiptsReport(params),
  });
}
