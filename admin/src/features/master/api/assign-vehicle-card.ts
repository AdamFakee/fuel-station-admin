import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/axios';
import { toast } from 'sonner';
import { masterKeys } from './get-catalogs-summary';
import { showApiError } from '@/lib/api-error';

export async function assignVehicleCard({ id, cardNumber }: { id: string; cardNumber: string }): Promise<{ card_number: string }> {
  const res = await apiClient.post<{ card_number: string }>(`/master/vehicles/${id}/card`, { card_number: cardNumber });
  return res.data;
}

export function useAssignVehicleCard() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: assignVehicleCard,
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: masterKeys.vehicles() });
      queryClient.invalidateQueries({ queryKey: masterKeys.vehicleDetail(vars.id) });
      toast.success('Gán thẻ NFC thành công');
    },
    onError: (err: any) => {
      showApiError(err, 'Không thể gán thẻ NFC');
    },
  });
}
