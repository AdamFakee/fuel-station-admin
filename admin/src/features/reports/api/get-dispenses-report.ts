import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/axios';
import { DispenseReportResponse } from '../types';
import { reportKeys } from './get-stock-ledger-report';

export interface DispenseReportParams {
  branch_id?: string;
  pump_id?: string;
  tank_id?: string;
  vehicle_id?: string;
  driver_id?: string;
  status?: string;
  from_date?: string;
  to_date?: string;
  page?: number;
  page_size?: number;
}

export async function getDispensesReport(params?: DispenseReportParams): Promise<DispenseReportResponse> {
  const res = await apiClient.get<DispenseReportResponse>('/reports/dispenses', { params });
  return res.data;
}

export function useDispensesReport(params?: DispenseReportParams) {
  return useQuery({
    queryKey: reportKeys.dispenses(params),
    queryFn: () => getDispensesReport(params),
  });
}
