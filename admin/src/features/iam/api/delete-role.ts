import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/axios';
import { toast } from 'sonner';
import { roleKeys } from './get-roles';

export async function deleteRole(id: string): Promise<void> {
  await apiClient.delete(`/iam/roles/${id}`);
}

export function useDeleteRole() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteRole,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: roleKeys.lists() });
      toast.success('Xóa vai trò thành công');
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message || 'Không thể xóa vai trò';
      toast.error(msg);
    },
  });
}
