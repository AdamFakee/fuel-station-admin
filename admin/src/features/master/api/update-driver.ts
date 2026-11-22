import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/axios';
import { toast } from 'sonner';
import { DriverDetail, UpdateDriverInput } from '../types';
import { masterKeys } from './get-catalogs-summary';
import { showApiError } from '@/lib/api-error';

export async function updateDriver({ id, data }: { id: string; data: UpdateDriverInput }): Promise<DriverDetail> {
  const res = await apiClient.put<DriverDetail>(`/master/drivers/${id}`, data);
  return res.data;
}

export function useUpdateDriver() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateDriver,
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: masterKeys.drivers() });
      queryClient.invalidateQueries({ queryKey: masterKeys.driverDetail(vars.id) });
      toast.success('Cập nhật hồ sơ tài xế thành công');
    },
    onError: (err: any) => {
      showApiError(err, 'Không thể cập nhật hồ sơ tài xế');
    },
  });
}
