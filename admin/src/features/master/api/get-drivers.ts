import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/axios';
import { PagedResponse, DriverListItem, DriverListParams } from '../types';
import { masterKeys } from './get-catalogs-summary';

export async function getDrivers(params: DriverListParams): Promise<PagedResponse<DriverListItem>> {
  const res = await apiClient.get<PagedResponse<DriverListItem>>('/master/drivers', { params });
  return res.data;
}

export function useDrivers(params: DriverListParams) {
  return useQuery({
    queryKey: masterKeys.driverList(params),
    queryFn: () => getDrivers(params),
  });
}
