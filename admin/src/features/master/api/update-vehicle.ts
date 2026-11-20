import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/axios';
import { toast } from 'sonner';
import { UpdateVehicleInput, VehicleDetail } from '../types';
import { masterKeys } from './get-catalogs-summary';

export async function updateVehicle({ id, data }: { id: string; data: UpdateVehicleInput }): Promise<VehicleDetail> {
  const res = await apiClient.put<VehicleDetail>(`/master/vehicles/${id}`, data);
  return res.data;
}

export function useUpdateVehicle() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateVehicle,
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: masterKeys.vehicles() });
      queryClient.invalidateQueries({ queryKey: masterKeys.vehicleDetail(vars.id) });
      toast.success('Cập nhật phương tiện thành công');
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message || 'Không thể cập nhật phương tiện';
      toast.error(msg);
    },
  });
}
