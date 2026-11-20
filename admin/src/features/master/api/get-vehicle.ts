import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/axios';
import { VehicleDetail } from '../types';
import { masterKeys } from './get-catalogs-summary';

export async function getVehicle(id: string): Promise<VehicleDetail> {
  const res = await apiClient.get<VehicleDetail>(`/master/vehicles/${id}`);
  return res.data;
}

export function useVehicle(id: string) {
  return useQuery({
    queryKey: masterKeys.vehicleDetail(id),
    queryFn: () => getVehicle(id),
    enabled: !!id,
  });
}
