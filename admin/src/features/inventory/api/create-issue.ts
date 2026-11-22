import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/axios';
import { toast } from 'sonner';
import { CreateIssueInput, StockIssue } from '../types';
import { issueKeys } from './get-issues';
import { showApiError } from '@/lib/api-error';

export async function createIssue(data: CreateIssueInput): Promise<StockIssue> {
  const res = await apiClient.post<StockIssue>('/inventory/issues', data);
  return res.data;
}

export function useCreateIssue() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createIssue,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: issueKeys.lists() });
      toast.success('Lập phiếu xuất điều chỉnh thành công');
    },
    onError: (err: any) => {
      showApiError(err, 'Không thể lập phiếu xuất');
    },
  });
}
