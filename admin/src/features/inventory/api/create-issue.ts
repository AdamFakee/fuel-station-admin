import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/axios';
import { toast } from 'sonner';
import { CreateIssueInput, StockIssue } from '../types';
import { issueKeys } from './get-issues';

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
      const msg = err.response?.data?.message || 'Không thể lập phiếu xuất';
      toast.error(msg);
    },
  });
}
