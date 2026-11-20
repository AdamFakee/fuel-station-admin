import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/axios';
import { QuotaRule } from '../types';
import { quotaKeys } from './get-quota-rules';

export interface UpdateQuotaRuleInput {
  id: string;
  max_volume_liters: number;
  min_interval_minutes: number;
  effective_to?: string;
}

export async function updateQuotaRule({ id, ...data }: UpdateQuotaRuleInput): Promise<QuotaRule> {
  const res = await apiClient.put<QuotaRule>(`/quotas/rules/${id}`, data);
  return res.data;
}

export function useUpdateQuotaRule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateQuotaRule,
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: quotaKeys.all });
      queryClient.invalidateQueries({ queryKey: quotaKeys.ruleDetail(vars.id) });
    },
  });
}
