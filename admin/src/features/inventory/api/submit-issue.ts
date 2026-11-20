import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/axios';
import { StockIssue } from '../types';
import { issueKeys } from './get-issues';

export async function submitIssue(id: string): Promise<StockIssue> {
  const res = await apiClient.post<StockIssue>(`/inventory/issues/${id}/submit`);
  return res.data;
}

export function useSubmitIssue() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: submitIssue,
    onSuccess: (issue) => {
      queryClient.invalidateQueries({ queryKey: issueKeys.all });
      queryClient.invalidateQueries({ queryKey: issueKeys.detail(issue.id) });
    },
  });
}
