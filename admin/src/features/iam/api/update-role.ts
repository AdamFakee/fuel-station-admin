import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/axios';
import { toast } from 'sonner';
import { RoleDetail, UpdateRoleInput } from '../types';
import { roleKeys } from './get-roles';

export async function updateRole({ id, data }: { id: string; data: UpdateRoleInput }): Promise<RoleDetail> {
  const res = await apiClient.put<RoleDetail>(`/iam/roles/${id}`, data);
  return res.data;
}

export function useUpdateRole() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateRole,
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: roleKeys.lists() });
      queryClient.invalidateQueries({ queryKey: roleKeys.detail(updated.id) });
      toast.success('Cập nhật vai trò thành công');
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message || 'Không thể cập nhật vai trò';
      toast.error(msg);
    },
  });
}
