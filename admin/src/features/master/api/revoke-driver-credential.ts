import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/axios';
import { toast } from 'sonner';
import { masterKeys } from './get-catalogs-summary';
import { showApiError } from '@/lib/api-error';

export async function revokeDriverCredential({
  driverId,
  credId,
}: {
  driverId: string;
  credId: string;
}): Promise<{ message: string }> {
  const res = await apiClient.delete<{ message: string }>(`/master/drivers/${driverId}/credentials/${credId}`);
  return res.data;
}

export function useRevokeDriverCredential() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: revokeDriverCredential,
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: masterKeys.drivers() });
      queryClient.invalidateQueries({ queryKey: masterKeys.driverDetail(vars.driverId) });
      toast.success('Đã thu hồi phương thức xác thực');
    },
    onError: (err: any) => {
      showApiError(err, 'Không thể thu hồi phương thức xác thực');
    },
  });
}
