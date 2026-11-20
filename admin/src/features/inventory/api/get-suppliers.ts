import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/axios';
import { Supplier } from '../types';

export const supplierKeys = {
  all: ['inventory-suppliers'] as const,
  list: () => [...supplierKeys.all, 'list'] as const,
};

export async function getSuppliers(): Promise<Supplier[]> {
  const res = await apiClient.get<Supplier[]>('/inventory/suppliers');
  return res.data;
}

export function useSuppliers() {
  return useQuery({
    queryKey: supplierKeys.list(),
    queryFn: getSuppliers,
  });
}
