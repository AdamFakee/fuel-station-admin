import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/axios';
import { PumpDetail } from '../types';

export interface GetPumpsParams {
  q?: string;
  branch_id?: string;
  enabled?: boolean;
  page?: number;
  page_size?: number;
}

export interface GetPumpsResponse {
  data: PumpDetail[];
  total: number;
  page: number;
  page_size: number;
}

export const pumpKeys = {
  all: ['pumps'] as const,
  list: (params?: GetPumpsParams) => [...pumpKeys.all, 'list', params] as const,
  detail: (id: string) => [...pumpKeys.all, 'detail', id] as const,
};

export async function getPumps(params?: GetPumpsParams): Promise<GetPumpsResponse> {
  const res = await apiClient.get<GetPumpsResponse>('/assets/pumps', { params });
  return res.data;
}

export function usePumps(params?: GetPumpsParams) {
  return useQuery({
    queryKey: pumpKeys.list(params),
    queryFn: () => getPumps(params),
  });
}
