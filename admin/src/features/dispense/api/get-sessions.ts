import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/axios';
import { DispenseSessionListItem, PagedResponse, SessionListParams } from '../types';

export const dispenseKeys = {
  all: ['dispense'] as const,
  sessions: () => [...dispenseKeys.all, 'sessions'] as const,
  sessionList: (params: SessionListParams) => [...dispenseKeys.sessions(), params] as const,
  sessionDetail: (id: string) => [...dispenseKeys.all, 'session', id] as const,
  accessEvents: (params: any) => [...dispenseKeys.all, 'access-events', params] as const,
  summary: (branchId?: string) => [...dispenseKeys.all, 'summary', branchId] as const,
};

export async function getSessions(params: SessionListParams): Promise<PagedResponse<DispenseSessionListItem>> {
  const res = await apiClient.get<PagedResponse<DispenseSessionListItem>>('/dispense/sessions', { params });
  return res.data;
}

export function useSessions(params: SessionListParams) {
  return useQuery({
    queryKey: dispenseKeys.sessionList(params),
    queryFn: () => getSessions(params),
  });
}
