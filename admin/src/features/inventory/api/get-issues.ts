import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/axios';
import { IssueListParams, IssueListResponse } from '../types';

export const issueKeys = {
  all: ['issues'] as const,
  lists: () => [...issueKeys.all, 'list'] as const,
  list: (params: IssueListParams) => [...issueKeys.lists(), params] as const,
  details: () => [...issueKeys.all, 'detail'] as const,
  detail: (id: string) => [...issueKeys.details(), id] as const,
};

export async function getIssues(params: IssueListParams): Promise<IssueListResponse> {
  const res = await apiClient.get<IssueListResponse>('/inventory/issues', { params });
  return res.data;
}

export function useIssues(params: IssueListParams) {
  return useQuery({
    queryKey: issueKeys.list(params),
    queryFn: () => getIssues(params),
  });
}
