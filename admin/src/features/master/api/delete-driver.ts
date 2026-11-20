import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/axios';
import { toast } from 'sonner';
import { masterKeys } from './get-catalogs-summary';

export async function deleteDriver(id: string): Promise<{ message: string }> {
  const res = await apiClient.delete<{ message: string }>(`/master/drivers/${id}`);
  return res.data;
}

export function useDeleteDriver() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteDriver,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: masterKeys.drivers() });
      toast.success('Đã xóa tài xế khỏi danh mục');
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message || 'Không thể xóa hồ sơ tài xế';
      toast.error(msg);
    },
  });
}
