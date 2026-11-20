import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/axios';
import { RoleDetail } from '../types';
import { roleKeys } from './get-roles';

export async function getRole(id: string): Promise<RoleDetail> {
  const res = await apiClient.get<RoleDetail>(`/iam/roles/${id}`);
  return res.data;
}

export function useRole(id: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: roleKeys.detail(id),
    queryFn: () => getRole(id),
    enabled: options?.enabled ?? Boolean(id),
  });
}
