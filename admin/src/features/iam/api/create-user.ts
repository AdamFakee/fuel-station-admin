import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/axios';
import { toast } from 'sonner';
import { CreateUserInput, UserDetail } from '../types';
import { userKeys } from './get-users';
import { showApiError } from '@/lib/api-error';

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
      showApiError(err, 'Không thể tạo tài khoản');
    },
  });
}
