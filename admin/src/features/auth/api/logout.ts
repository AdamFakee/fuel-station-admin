import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/axios';
import { authKeys } from './get-me';

export async function logout(): Promise<void> {
  await apiClient.post('/auth/logout');
}

export function useLogout() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: logout,
    onSuccess: () => {
      queryClient.setQueryData(authKeys.me(), null);
      if (typeof window !== 'undefined') {
        window.location.href = '/login';
      }
    },
  });
}
