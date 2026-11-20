import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/axios';
import { RoleListItem } from '../types';

export const roleKeys = {
  all: ['roles'] as const,
  lists: () => [...roleKeys.all, 'list'] as const,
  details: () => [...roleKeys.all, 'detail'] as const,
  detail: (id: string) => [...roleKeys.details(), id] as const,
};

export async function getRoles(): Promise<RoleListItem[]> {
  const res = await apiClient.get<RoleListItem[]>('/iam/roles');
  return res.data;
}

export function useRoles() {
  return useQuery({
    queryKey: roleKeys.lists(),
    queryFn: getRoles,
  });
}
