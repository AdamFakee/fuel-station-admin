import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/axios';
import { stocktakeKeys } from './get-tank-stocks';

export async function resolveAlert(id: string): Promise<void> {
  await apiClient.post(`/inventory/alerts/${id}/resolve`);
}

export function useResolveAlert() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: resolveAlert,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: stocktakeKeys.all });
    },
  });
}
