import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/axios';
import { CatalogsSummary } from '../types';

export const masterKeys = {
  all: ['master'] as const,
  catalogsSummary: () => [...masterKeys.all, 'catalogs-summary'] as const,
  vehicles: () => [...masterKeys.all, 'vehicles'] as const,
  vehicleList: (params: any) => [...masterKeys.vehicles(), 'list', params] as const,
  vehicleDetail: (id: string) => [...masterKeys.vehicles(), 'detail', id] as const,
  drivers: () => [...masterKeys.all, 'drivers'] as const,
  driverList: (params: any) => [...masterKeys.drivers(), 'list', params] as const,
  driverDetail: (id: string) => [...masterKeys.drivers(), 'detail', id] as const,
};

export async function getCatalogsSummary(): Promise<CatalogsSummary> {
  const res = await apiClient.get<CatalogsSummary>('/master/catalogs/summary');
  return res.data;
}

export function useCatalogsSummary() {
  return useQuery({
    queryKey: masterKeys.catalogsSummary(),
    queryFn: getCatalogsSummary,
    staleTime: 60 * 1000,
  });
}
