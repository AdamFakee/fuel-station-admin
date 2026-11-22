import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/axios';
import { toast } from 'sonner';
import { masterKeys } from './get-catalogs-summary';
import { showApiError } from '@/lib/api-error';

export async function revokeVehicleCard(id: string): Promise<{ message: string }> {
  const res = await apiClient.delete<{ message: string }>(`/master/vehicles/${id}/card`);
  return res.data;
}

export function useRevokeVehicleCard() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: revokeVehicleCard,
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: masterKeys.vehicles() });
      queryClient.invalidateQueries({ queryKey: masterKeys.vehicleDetail(id) });
      toast.success('Đã thu hồi thẻ NFC của xe');
    },
    onError: (err: any) => {
      showApiError(err, 'Không thể thu hồi thẻ NFC');
    },
  });
}
