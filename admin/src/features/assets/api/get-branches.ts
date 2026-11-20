import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/axios';
import { Branch } from '../types';

export interface GetBranchesParams {
  q?: string;
  status?: string;
  page?: number;
  page_size?: number;
}

export interface GetBranchesResponse {
  data: Branch[];
  total: number;
  page: number;
  page_size: number;
}

export const branchKeys = {
  all: ['branches'] as const,
  list: (params?: GetBranchesParams) => [...branchKeys.all, 'list', params] as const,
  detail: (id: string) => [...branchKeys.all, 'detail', id] as const,
};

export async function getBranches(params?: GetBranchesParams): Promise<GetBranchesResponse> {
  const res = await apiClient.get<GetBranchesResponse>('/assets/branches', { params });
  return res.data;
}

export function useBranches(params?: GetBranchesParams) {
  return useQuery({
    queryKey: branchKeys.list(params),
    queryFn: () => getBranches(params),
  });
}
