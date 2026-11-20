import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/axios';
import { toast } from 'sonner';
import { UpdateUserInput, UserDetail } from '../types';
import { userKeys } from './get-users';

export async function updateUser({ id, data }: { id: string; data: UpdateUserInput }): Promise<UserDetail> {
  const res = await apiClient.put<UserDetail>(`/iam/users/${id}`, data);
  return res.data;
}

export function useUpdateUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateUser,
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: userKeys.lists() });
      queryClient.invalidateQueries({ queryKey: userKeys.detail(updated.id) });
      toast.success('Cập nhật tài khoản thành công');
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message || 'Không thể cập nhật tài khoản';
      toast.error(msg);
    },
  });
}
