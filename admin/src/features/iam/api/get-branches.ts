import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/axios';
import { BranchOption } from '../types';

export const branchKeys = {
  all: ['branches'] as const,
};

export async function getBranches(): Promise<BranchOption[]> {
  const res = await apiClient.get<BranchOption[]>('/iam/branches');
  return res.data;
}

export function useBranches() {
  return useQuery({
    queryKey: branchKeys.all,
    queryFn: getBranches,
    staleTime: 10 * 60 * 1000,
  });
}
