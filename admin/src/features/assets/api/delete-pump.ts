import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/axios';
import { pumpKeys } from './get-pumps';

export async function deletePump(id: string): Promise<void> {
  await apiClient.delete(`/assets/pumps/${id}`);
}

export function useDeletePump() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deletePump,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: pumpKeys.all });
    },
  });
}
