import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/axios';
import { toast } from 'sonner';
import { masterKeys } from './get-catalogs-summary';
import { showApiError } from '@/lib/api-error';

export async function updateDriverStatus({ id, status }: { id: string; status: 'active' | 'blocked' | 'inactive' }): Promise<{ status: string }> {
  const res = await apiClient.patch<{ status: string }>(`/master/drivers/${id}/status`, { status });
  return res.data;
}

export function useUpdateDriverStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateDriverStatus,
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: masterKeys.drivers() });
      queryClient.invalidateQueries({ queryKey: masterKeys.driverDetail(vars.id) });
      const labels: Record<string, string> = {
        active: 'Đã mở khóa tài xế',
        blocked: 'Đã khóa tài xế',
        inactive: 'Đã chuyển tài xế sang ngừng hoạt động',
      };
      toast.success(labels[vars.status] || 'Cập nhật trạng thái thành công');
    },
    onError: (err: any) => {
      showApiError(err, 'Không thể cập nhật trạng thái tài xế');
    },
  });
}
