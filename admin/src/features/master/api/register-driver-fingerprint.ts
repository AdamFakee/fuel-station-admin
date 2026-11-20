import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/axios';
import { toast } from 'sonner';
import { CredentialItem } from '../types';
import { masterKeys } from './get-catalogs-summary';

export async function registerDriverFingerprint({
  id,
  biometricTemplateId,
}: {
  id: string;
  biometricTemplateId: string;
}): Promise<CredentialItem> {
  const res = await apiClient.post<CredentialItem>(`/master/drivers/${id}/credentials/fingerprint`, {
    biometric_template_id: biometricTemplateId,
  });
  return res.data;
}

export function useRegisterDriverFingerprint() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: registerDriverFingerprint,
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: masterKeys.drivers() });
      queryClient.invalidateQueries({ queryKey: masterKeys.driverDetail(vars.id) });
      toast.success('Đăng ký mẫu vân tay thành công');
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message || 'Không thể đăng ký mẫu vân tay';
      toast.error(msg);
    },
  });
}
