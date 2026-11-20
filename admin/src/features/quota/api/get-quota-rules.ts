import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/axios';
import { QuotaRule } from '../types';

export interface QuotaRuleFilterParams {
  status?: string;
  target_type?: string;
  q?: string;
  page?: number;
  page_size?: number;
}

export interface QuotaRuleListResponse {
  data: QuotaRule[];
  total: number;
  page: number;
  page_size: number;
}

export const quotaKeys = {
  all: ['quotas'] as const,
  rules: (params?: QuotaRuleFilterParams) => [...quotaKeys.all, 'rules', params] as const,
  ruleDetail: (id: string) => [...quotaKeys.all, 'rule', id] as const,
  extras: (params?: object) => [...quotaKeys.all, 'extras', params] as const,
  targets: () => [...quotaKeys.all, 'targets'] as const,
};

export async function getQuotaRules(params?: QuotaRuleFilterParams): Promise<QuotaRuleListResponse> {
  const res = await apiClient.get<QuotaRuleListResponse>('/quotas/rules', { params });
  return res.data;
}

export function useQuotaRules(params?: QuotaRuleFilterParams) {
  return useQuery({
    queryKey: quotaKeys.rules(params),
    queryFn: () => getQuotaRules(params),
  });
}
