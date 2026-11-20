import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/axios';
import { Branch, BranchInput } from '../types';
import { branchKeys } from './get-branches';

export async function createBranch(input: BranchInput): Promise<Branch> {
  const res = await apiClient.post<Branch>('/assets/branches', input);
  return res.data;
}

export function useCreateBranch() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createBranch,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: branchKeys.all });
    },
  });
}
