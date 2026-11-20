import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/axios';
import { toast } from 'sonner';
import { masterKeys } from './get-catalogs-summary';

export async function assignDriverCard({ id, cardNumber }: { id: string; cardNumber: string }): Promise<{ card_number: string }> {
  const res = await apiClient.post<{ card_number: string }>(`/master/drivers/${id}/credentials/card`, { card_number: cardNumber });
  return res.data;
}

export function useAssignDriverCard() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: assignDriverCard,
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: masterKeys.drivers() });
      queryClient.invalidateQueries({ queryKey: masterKeys.driverDetail(vars.id) });
      toast.success('Gán thẻ NFC cho tài xế thành công');
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message || 'Không thể gán thẻ NFC';
      toast.error(msg);
    },
  });
}
