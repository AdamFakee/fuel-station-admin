import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/axios';
import { toast } from 'sonner';
import { CreateVehicleInput, VehicleDetail } from '../types';
import { masterKeys } from './get-catalogs-summary';

export async function createVehicle(data: CreateVehicleInput): Promise<VehicleDetail> {
  const res = await apiClient.post<VehicleDetail>('/master/vehicles', data);
  return res.data;
}

export function useCreateVehicle() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createVehicle,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: masterKeys.vehicles() });
      toast.success('Khai báo phương tiện thành công');
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message || 'Không thể tạo phương tiện';
      toast.error(msg);
    },
  });
}
