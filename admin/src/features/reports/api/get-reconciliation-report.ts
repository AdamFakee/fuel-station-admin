import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/axios';
import { ReconciliationReportResponse } from '../types';
import { reportKeys } from './get-stock-ledger-report';

export interface ReconciliationReportParams {
  branch_id?: string;
  tank_id?: string;
  status?: string;
  from_date?: string;
  to_date?: string;
}

export async function getReconciliationReport(params?: ReconciliationReportParams): Promise<ReconciliationReportResponse> {
  const res = await apiClient.get<ReconciliationReportResponse>('/reports/reconciliation', { params });
  return res.data;
}

export function useReconciliationReport(params?: ReconciliationReportParams) {
  return useQuery({
    queryKey: reportKeys.reconciliation(params),
    queryFn: () => getReconciliationReport(params),
  });
}
