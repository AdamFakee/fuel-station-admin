import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/axios';
import { FuelType } from '../types';

export const fuelTypeKeys = {
  all: ['fuel-types'] as const,
  list: () => [...fuelTypeKeys.all, 'list'] as const,
};

export async function getFuelTypes(): Promise<FuelType[]> {
  const res = await apiClient.get<FuelType[]>('/assets/fuel-types');
  return res.data;
}

export function useFuelTypes() {
  return useQuery({
    queryKey: fuelTypeKeys.list(),
    queryFn: getFuelTypes,
  });
}
