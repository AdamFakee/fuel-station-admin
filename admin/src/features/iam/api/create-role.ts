import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/axios';
import { toast } from 'sonner';
import { CreateRoleInput, RoleDetail } from '../types';
import { roleKeys } from './get-roles';

export async function createRole(data: CreateRoleInput): Promise<RoleDetail> {
  const res = await apiClient.post<RoleDetail>('/iam/roles', data);
  return res.data;
}

export function useCreateRole() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createRole,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: roleKeys.lists() });
      toast.success('Tạo vai trò thành công');
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message || 'Không thể tạo vai trò';
      toast.error(msg);
    },
  });
}
