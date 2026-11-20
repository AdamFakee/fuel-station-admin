import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/axios';
import { Branch, BranchInput } from '../types';
import { branchKeys } from './get-branches';

export async function updateBranch({ id, input }: { id: string; input: Partial<BranchInput> & { status?: string } }): Promise<Branch> {
  const res = await apiClient.put<Branch>(`/assets/branches/${id}`, input);
  return res.data;
}

export function useUpdateBranch() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateBranch,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: branchKeys.all });
    },
  });
}
