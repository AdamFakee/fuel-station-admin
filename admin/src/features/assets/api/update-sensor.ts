import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/axios';
import { PumpSensor, SensorInput } from '../types';
import { deviceKeys } from './get-devices';
import { pumpKeys } from './get-pumps';

export async function updateSensor({
  pumpId,
  input,
}: {
  pumpId: string;
  input: SensorInput;
}): Promise<PumpSensor> {
  const res = await apiClient.put<PumpSensor>(`/assets/devices/sensors/${pumpId}`, input);
  return res.data;
}

export function useUpdateSensor() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateSensor,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: deviceKeys.all });
      queryClient.invalidateQueries({ queryKey: pumpKeys.all });
    },
  });
}
