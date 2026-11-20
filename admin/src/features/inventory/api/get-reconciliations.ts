import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/axios';
import { ReconciliationListParams, ReconciliationListResponse } from '../types';
import { stocktakeKeys } from './get-tank-stocks';

export async function getReconciliations(
  params: ReconciliationListParams
): Promise<ReconciliationListResponse> {
  const queryParams: Record<string, any> = {};
  if (params.page) queryParams.page = params.page;
  if (params.page_size) queryParams.page_size = params.page_size;
  if (params.branch_id && params.branch_id !== 'all') queryParams.branch_id = params.branch_id;
  if (params.tank_id && params.tank_id !== 'all') queryParams.tank_id = params.tank_id;
  if (params.status && params.status !== 'all') queryParams.status = params.status;
  if (params.period_date) queryParams.period_date = params.period_date;

  const res = await apiClient.get<ReconciliationListResponse>('/inventory/stocktake', {
    params: queryParams,
  });
  return res.data;
}

export function useReconciliations(params: ReconciliationListParams) {
  return useQuery({
    queryKey: stocktakeKeys.reconciliations(params),
    queryFn: () => getReconciliations(params),
  });
}
