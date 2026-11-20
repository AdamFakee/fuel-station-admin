import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/axios';
import { PumpDetail } from '../types';
import { pumpKeys } from './get-pumps';

export async function updatePump({
  id,
  input,
}: {
  id: string;
  input: { name: string; note?: string; enabled: boolean };
}): Promise<PumpDetail> {
  const res = await apiClient.put<PumpDetail>(`/assets/pumps/${id}`, input);
  return res.data;
}

export function useUpdatePump() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updatePump,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: pumpKeys.all });
    },
  });
}
