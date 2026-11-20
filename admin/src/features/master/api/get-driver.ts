import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/axios';
import { DriverDetail } from '../types';
import { masterKeys } from './get-catalogs-summary';

export async function getDriver(id: string): Promise<DriverDetail> {
  const res = await apiClient.get<DriverDetail>(`/master/drivers/${id}`);
  return res.data;
}

export function useDriver(id: string) {
  return useQuery({
    queryKey: masterKeys.driverDetail(id),
    queryFn: () => getDriver(id),
    enabled: !!id,
  });
}
