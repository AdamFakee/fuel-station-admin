import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/axios';
import { QuotaRule, QuotaRuleFormData } from '../types';
import { quotaKeys } from './get-quota-rules';

export async function createQuotaRule(data: QuotaRuleFormData): Promise<QuotaRule> {
  const res = await apiClient.post<QuotaRule>('/quotas/rules', data);
  return res.data;
}

export function useCreateQuotaRule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createQuotaRule,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: quotaKeys.all });
    },
  });
}
