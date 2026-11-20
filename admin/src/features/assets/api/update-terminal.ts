import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/axios';
import { AccessTerminal, TerminalInput } from '../types';
import { deviceKeys } from './get-devices';
import { pumpKeys } from './get-pumps';

export async function updateTerminal({
  pumpId,
  input,
}: {
  pumpId: string;
  input: TerminalInput;
}): Promise<AccessTerminal> {
  const res = await apiClient.put<AccessTerminal>(`/assets/devices/terminals/${pumpId}`, input);
  return res.data;
}

export function useUpdateTerminal() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateTerminal,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: deviceKeys.all });
      queryClient.invalidateQueries({ queryKey: pumpKeys.all });
    },
  });
}
