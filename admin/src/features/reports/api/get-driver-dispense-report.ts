import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/axios';
import { DriverDispenseResponse } from '../types';
import { reportKeys } from './get-stock-ledger-report';

export interface DriverDispenseParams {
  branch_id?: string;
  driver_id?: string;
  from_date?: string;
  to_date?: string;
}

export async function getDriverDispenseReport(params?: DriverDispenseParams): Promise<DriverDispenseResponse> {
  const res = await apiClient.get<DriverDispenseResponse>('/reports/driver-dispense', { params });
  return res.data;
}

export function useDriverDispenseReport(params?: DriverDispenseParams) {
  return useQuery({
    queryKey: reportKeys.driverDispense(params),
    queryFn: () => getDriverDispenseReport(params),
  });
}
