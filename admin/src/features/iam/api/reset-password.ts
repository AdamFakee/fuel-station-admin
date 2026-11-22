import { useMutation } from '@tanstack/react-query';
import { apiClient } from '@/lib/axios';
import { toast } from 'sonner';
import { showApiError } from '@/lib/api-error';

export async function resetPassword({ id, new_password }: { id: string; new_password: string }): Promise<void> {
  await apiClient.post(`/iam/users/${id}/reset-password`, { new_password });
}

export function useResetPassword() {
  return useMutation({
    mutationFn: resetPassword,
    onSuccess: () => {
      toast.success('Đặt lại mật khẩu thành công');
    },
    onError: (err: any) => {
      showApiError(err, 'Không thể đặt lại mật khẩu');
    },
  });
}
