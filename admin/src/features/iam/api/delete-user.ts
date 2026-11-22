import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/axios';
import { toast } from 'sonner';
import { userKeys } from './get-users';
import { showApiError } from '@/lib/api-error';

export async function deleteUser(id: string): Promise<void> {
  await apiClient.delete(`/iam/users/${id}`);
}

export function useDeleteUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteUser,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: userKeys.lists() });
      toast.success('Xóa tài khoản thành công');
    },
    onError: (err: any) => {
      showApiError(err, 'Không thể xóa tài khoản');
    },
  });
}
