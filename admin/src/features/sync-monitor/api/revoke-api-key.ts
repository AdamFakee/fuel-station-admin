import { branchKeys } from '@/features/assets/api/get-branches';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { apiClient } from '@/lib/axios';
import { showApiError } from '@/lib/api-error';
import { syncMonitorKeys } from './get-stations';

/** Thu hồi khóa API: trạm đang dùng khóa này bị từ chối ngay và chuyển sang ngừng hoạt động. */
export async function revokeApiKey(branchId: string): Promise<void> {
  await apiClient.delete(`/sync-monitor/branches/${branchId}/api-key`);
}

export function useRevokeApiKey() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: revokeApiKey,
    onSuccess: () => {
      // Danh sách trạm xăng cho biết trạm đã từng được cấp khóa chưa (quyết định có nút xóa hay không)
      queryClient.invalidateQueries({ queryKey: syncMonitorKeys.stations() });
      queryClient.invalidateQueries({ queryKey: branchKeys.all });
      toast.success('Đã thu hồi khóa API, trạm ngừng hoạt động');
    },
    onError: (err: unknown) => {
      showApiError(err, 'Không thể thu hồi khóa API');
    },
  });
}
