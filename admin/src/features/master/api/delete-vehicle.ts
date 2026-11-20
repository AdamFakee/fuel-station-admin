import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/axios';
import { toast } from 'sonner';
import { masterKeys } from './get-catalogs-summary';

export async function deleteVehicle(id: string): Promise<{ message: string }> {
  const res = await apiClient.delete<{ message: string }>(`/master/vehicles/${id}`);
  return res.data;
}

export function useDeleteVehicle() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteVehicle,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: masterKeys.vehicles() });
      toast.success('Đã xóa phương tiện khỏi danh mục');
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message || 'Không thể xóa phương tiện';
      toast.error(msg);
    },
  });
}
