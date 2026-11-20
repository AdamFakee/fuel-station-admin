import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/axios';
import { Supplier } from '../types';
import { supplierKeys } from './get-suppliers';

export interface CreateSupplierInput {
  code: string;
  name: string;
  phone?: string;
  address?: string;
}

export async function createSupplier(data: CreateSupplierInput): Promise<Supplier> {
  const res = await apiClient.post<Supplier>('/inventory/suppliers', data);
  return res.data;
}

export function useCreateSupplier() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createSupplier,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: supplierKeys.all });
    },
  });
}
