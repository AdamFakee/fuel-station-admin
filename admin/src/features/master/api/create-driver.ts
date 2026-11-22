import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/axios';
import { toast } from 'sonner';
import { CreateDriverInput, DriverDetail } from '../types';
import { masterKeys } from './get-catalogs-summary';
import { showApiError } from '@/lib/api-error';

export async function createDriver(data: CreateDriverInput): Promise<DriverDetail> {
  const res = await apiClient.post<DriverDetail>('/master/drivers', data);
  return res.data;
}

export function useCreateDriver() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createDriver,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: masterKeys.drivers() });
      toast.success('Thêm tài xế mới thành công');
    },
    onError: (err: any) => {
      showApiError(err, 'Không thể tạo hồ sơ tài xế');
    },
  });
}
