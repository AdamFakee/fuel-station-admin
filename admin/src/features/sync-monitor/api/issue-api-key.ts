import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/axios';
import { showApiError } from '@/lib/api-error';
import { IssuedApiKey } from '../types';
import { syncMonitorKeys } from './get-stations';

/** Cấp khóa API mới cho trạm Edge của chi nhánh (cấp lại thì khóa cũ mất hiệu lực ngay). */
export async function issueApiKey(branchId: string): Promise<IssuedApiKey> {
  const res = await apiClient.post<IssuedApiKey>(`/sync-monitor/branches/${branchId}/api-key`);
  return res.data;
}

export function useIssueApiKey() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: issueApiKey,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: syncMonitorKeys.stations() });
    },
    onError: (err: unknown) => {
      showApiError(err, 'Không thể cấp khóa API');
    },
  });
}
