import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/axios';
import { toast } from 'sonner';
import { CreateUserInput, UserDetail } from '../types';
import { userKeys } from './get-users';

export async function createUser(data: CreateUserInput): Promise<UserDetail> {
  const res = await apiClient.post<UserDetail>('/iam/users', data);
  return res.data;
}

export function useCreateUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createUser,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: userKeys.lists() });
      toast.success('Tạo tài khoản thành công');
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message || 'Không thể tạo tài khoản';
      toast.error(msg);
    },
  });
}
