import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/axios';
import { toast } from 'sonner';
import { issueKeys } from './get-issues';
import { showApiError } from '@/lib/api-error';

export async function deleteIssue(id: string): Promise<{ message: string }> {
  const res = await apiClient.delete<{ message: string }>(`/inventory/issues/${id}`);
  return res.data;
}

export function useDeleteIssue() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteIssue,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: issueKeys.lists() });
      toast.success('Đã xóa phiếu xuất');
    },
    onError: (err: any) => {
      showApiError(err, 'Không thể xóa phiếu xuất');
    },
  });
}
