import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/axios';
import { UserDetail } from '../types';
import { userKeys } from './get-users';

export async function getUser(id: string): Promise<UserDetail> {
  const res = await apiClient.get<UserDetail>(`/iam/users/${id}`);
  return res.data;
}

export function useUser(id: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: userKeys.detail(id),
    queryFn: () => getUser(id),
    enabled: options?.enabled ?? Boolean(id),
  });
}
