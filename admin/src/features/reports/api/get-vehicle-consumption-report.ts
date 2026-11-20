import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/axios';
import { VehicleConsumptionResponse } from '../types';
import { reportKeys } from './get-stock-ledger-report';

export interface VehicleConsumptionParams {
  branch_id?: string;
  group_id?: string;
  vehicle_id?: string;
  from_date?: string;
  to_date?: string;
}

export async function getVehicleConsumptionReport(params?: VehicleConsumptionParams): Promise<VehicleConsumptionResponse> {
  const res = await apiClient.get<VehicleConsumptionResponse>('/reports/vehicle-consumption', { params });
  return res.data;
}

export function useVehicleConsumptionReport(params?: VehicleConsumptionParams) {
  return useQuery({
    queryKey: reportKeys.vehicleConsumption(params),
    queryFn: () => getVehicleConsumptionReport(params),
  });
}
