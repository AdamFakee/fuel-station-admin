import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/axios';
import { StockIssue } from '../types';
import { issueKeys } from './get-issues';

export async function getIssue(id: string): Promise<StockIssue> {
  const res = await apiClient.get<StockIssue>(`/inventory/issues/${id}`);
  return res.data;
}

export function useIssue(id: string) {
  return useQuery({
    queryKey: issueKeys.detail(id),
    queryFn: () => getIssue(id),
    enabled: !!id,
  });
}
