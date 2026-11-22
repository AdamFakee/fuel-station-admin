import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/axios';
import { toast } from 'sonner';
import { CreateRoleInput, RoleDetail } from '../types';
import { roleKeys } from './get-roles';
import { showApiError } from '@/lib/api-error';

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
      showApiError(err, 'Không thể tạo vai trò');
    },
  });
}
