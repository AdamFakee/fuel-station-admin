import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/axios';
import { toast } from 'sonner';
import { masterKeys } from './get-catalogs-summary';
import { showApiError } from '@/lib/api-error';

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
      showApiError(err, 'Không thể xóa hồ sơ tài xế');
    },
  });
}
