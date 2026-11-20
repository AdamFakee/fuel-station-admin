import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/axios';
import { PermissionItem } from '../types';

export const permissionKeys = {
  all: ['permissions'] as const,
};

export async function getPermissions(): Promise<PermissionItem[]> {
  const res = await apiClient.get<PermissionItem[]>('/iam/permissions');
  return res.data;
}

export function usePermissions() {
  return useQuery({
    queryKey: permissionKeys.all,
    queryFn: getPermissions,
    staleTime: 60 * 60 * 1000, // 1 hour
  });
}
