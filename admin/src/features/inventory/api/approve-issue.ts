import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/axios';
import { ApproveIssueInput, StockIssue } from '../types';
import { issueKeys } from './get-issues';
import { tankKeys } from '@/features/assets/api/get-tanks';

interface ApproveIssueArgs {
  id: string;
  data: ApproveIssueInput;
}

export async function approveIssue({ id, data }: ApproveIssueArgs): Promise<StockIssue> {
  const res = await apiClient.post<StockIssue>(`/inventory/issues/${id}/approve`, data);
  return res.data;
}

export function useApproveIssue() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: approveIssue,
    onSuccess: (issue) => {
      queryClient.invalidateQueries({ queryKey: issueKeys.all });
      queryClient.invalidateQueries({ queryKey: issueKeys.detail(issue.id) });
      queryClient.invalidateQueries({ queryKey: tankKeys.all });
    },
  });
}
