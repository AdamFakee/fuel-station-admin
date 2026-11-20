import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/axios';
import { AuthUser, RawUserResponse, mapAuthUser } from '../types';

export const authKeys = {
  all: ['auth'] as const,
  me: () => [...authKeys.all, 'me'] as const,
};

export async function getMe(): Promise<AuthUser> {
  const res = await apiClient.get<RawUserResponse | { user: RawUserResponse }>('/auth/me');
  const raw = res.data && 'user' in res.data ? res.data.user : (res.data as RawUserResponse);
  return mapAuthUser(raw);
}

export function useMe(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: authKeys.me(),
    queryFn: getMe,
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: false,
    enabled: options?.enabled ?? true,
  });
}
