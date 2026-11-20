import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/axios';
import { toast } from 'sonner';
import { StockIssue, UpdateIssueInput } from '../types';
import { issueKeys } from './get-issues';

export async function updateIssue({ id, data }: { id: string; data: UpdateIssueInput }): Promise<StockIssue> {
  const res = await apiClient.put<StockIssue>(`/inventory/issues/${id}`, data);
  return res.data;
}

export function useUpdateIssue() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateIssue,
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: issueKeys.lists() });
      queryClient.invalidateQueries({ queryKey: issueKeys.detail(vars.id) });
      toast.success('Cập nhật phiếu xuất thành công');
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message || 'Không thể cập nhật phiếu xuất';
      toast.error(msg);
    },
  });
}
