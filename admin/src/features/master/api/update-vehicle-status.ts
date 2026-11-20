import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/axios';
import { toast } from 'sonner';
import { masterKeys } from './get-catalogs-summary';

export async function updateVehicleStatus({ id, status }: { id: string; status: 'active' | 'banned' }): Promise<{ status: string }> {
  const res = await apiClient.patch<{ status: string }>(`/master/vehicles/${id}/status`, { status });
  return res.data;
}

export function useUpdateVehicleStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateVehicleStatus,
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: masterKeys.vehicles() });
      queryClient.invalidateQueries({ queryKey: masterKeys.vehicleDetail(vars.id) });
      toast.success(vars.status === 'active' ? 'Đã kích hoạt phương tiện' : 'Đã khóa quyền đổ nhiên liệu của xe');
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message || 'Không thể đổi trạng thái xe';
      toast.error(msg);
    },
  });
}
