import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/axios';
import { PagedResponse, VehicleListItem, VehicleListParams } from '../types';
import { masterKeys } from './get-catalogs-summary';

export async function getVehicles(params: VehicleListParams): Promise<PagedResponse<VehicleListItem>> {
  const res = await apiClient.get<PagedResponse<VehicleListItem>>('/master/vehicles', { params });
  return res.data;
}

export function useVehicles(params: VehicleListParams) {
  return useQuery({
    queryKey: masterKeys.vehicleList(params),
    queryFn: () => getVehicles(params),
  });
}
