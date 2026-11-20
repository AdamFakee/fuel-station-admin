import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/axios';
import { QuotaExtra } from '../types';
import { quotaKeys } from './get-quota-rules';

export interface QuotaExtraFilterParams {
  vehicle_id?: string;
  page?: number;
  page_size?: number;
}

export interface QuotaExtraListResponse {
  data: QuotaExtra[];
  total: number;
  page: number;
  page_size: number;
}

export async function getQuotaExtras(params?: QuotaExtraFilterParams): Promise<QuotaExtraListResponse> {
  const res = await apiClient.get<QuotaExtraListResponse>('/quotas/extras', { params });
  return res.data;
}

export function useQuotaExtras(params?: QuotaExtraFilterParams) {
  return useQuery({
    queryKey: quotaKeys.extras(params),
    queryFn: () => getQuotaExtras(params),
  });
}
