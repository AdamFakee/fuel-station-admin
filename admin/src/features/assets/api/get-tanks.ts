import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/axios';
import { Tank } from '../types';

export interface GetTanksParams {
  q?: string;
  branch_id?: string;
  status?: string;
  page?: number;
  page_size?: number;
}

export interface GetTanksResponse {
  data: Tank[];
  total: number;
  page: number;
  page_size: number;
}

export const tankKeys = {
  all: ['tanks'] as const,
  list: (params?: GetTanksParams) => [...tankKeys.all, 'list', params] as const,
  detail: (id: string) => [...tankKeys.all, 'detail', id] as const,
};

export async function getTanks(params?: GetTanksParams): Promise<GetTanksResponse> {
  const res = await apiClient.get<GetTanksResponse>('/assets/tanks', { params });
  return res.data;
}

export function useTanks(params?: GetTanksParams) {
  return useQuery({
    queryKey: tankKeys.list(params),
    queryFn: () => getTanks(params),
  });
}
