import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/axios';
import { tankKeys } from './get-tanks';

export async function deleteTank(id: string): Promise<void> {
  await apiClient.delete(`/assets/tanks/${id}`);
}

export function useDeleteTank() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteTank,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: tankKeys.all });
    },
  });
}
