import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/axios';
import { AccessEventListItem, AccessEventParams, PagedResponse } from '../types';
import { dispenseKeys } from './get-sessions';

export async function getAccessEvents(params: AccessEventParams): Promise<PagedResponse<AccessEventListItem>> {
  const res = await apiClient.get<PagedResponse<AccessEventListItem>>('/dispense/access-events', { params });
  return res.data;
}

export function useAccessEvents(params: AccessEventParams) {
  return useQuery({
    queryKey: dispenseKeys.accessEvents(params),
    queryFn: () => getAccessEvents(params),
  });
}
