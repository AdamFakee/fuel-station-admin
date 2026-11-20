import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/axios';
import { QuotaExtra, QuotaExtraFormData } from '../types';
import { quotaKeys } from './get-quota-rules';

export async function createQuotaExtra(data: QuotaExtraFormData): Promise<QuotaExtra> {
  const res = await apiClient.post<QuotaExtra>('/quotas/extras', data);
  return res.data;
}

export function useCreateQuotaExtra() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createQuotaExtra,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: quotaKeys.all });
    },
  });
}
