import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/axios';
import { quotaKeys } from './get-quota-rules';

export async function cancelQuotaRule(id: string): Promise<void> {
  await apiClient.post(`/quotas/rules/${id}/cancel`);
}

export function useCancelQuotaRule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: cancelQuotaRule,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: quotaKeys.all });
    },
  });
}
