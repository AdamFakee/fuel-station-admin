import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/axios';
import { toast } from 'sonner';
import { UpdateUserStatusInput } from '../types';
import { userKeys } from './get-users';
import { showApiError } from '@/lib/api-error';

export async function updateUserStatus({ id, status }: { id: string; status: 'active' | 'locked' }): Promise<void> {
  await apiClient.patch(`/iam/users/${id}/status`, { status });
}

export function useUpdateUserStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateUserStatus,
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: userKeys.lists() });
      queryClient.invalidateQueries({ queryKey: userKeys.detail(variables.id) });
      toast.success(variables.status === 'active' ? 'Đã mở khóa tài khoản' : 'Đã khóa tài khoản');
    },
    onError: (err: any) => {
      showApiError(err, 'Không thể thay đổi trạng thái tài khoản');
    },
  });
}
