import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/axios';
import { PagedResponse, UserListItem, UserListParams } from '../types';

export const userKeys = {
  all: ['users'] as const,
  lists: () => [...userKeys.all, 'list'] as const,
  list: (params: UserListParams) => [...userKeys.lists(), params] as const,
  details: () => [...userKeys.all, 'detail'] as const,
  detail: (id: string) => [...userKeys.details(), id] as const,
};

export async function getUsers(params: UserListParams): Promise<PagedResponse<UserListItem>> {
  const res = await apiClient.get<PagedResponse<UserListItem>>('/iam/users', { params });
  return res.data;
}

export function useUsers(params: UserListParams) {
  return useQuery({
    queryKey: userKeys.list(params),
    queryFn: () => getUsers(params),
  });
}
