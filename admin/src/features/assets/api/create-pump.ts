import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/axios';
import { PumpDetail, PumpInput } from '../types';
import { pumpKeys } from './get-pumps';

export async function createPump(input: PumpInput): Promise<PumpDetail> {
  const payload = {
    code: input.code,
    name: input.name,
    branch_id: input.branch_id,
    tank_id: input.tank_id,
    edge_pump_id: input.edge_pump_id,
    note: input.note,
    sensor_com_port: input.sensor_com_port,
    sensor_serial: input.sensor_serial,
    terminal_code: input.terminal_code,
    terminal_host: input.terminal_host,
    terminal_password: input.terminal_password,
  };

  const res = await apiClient.post<PumpDetail>('/assets/pumps', payload);
  return res.data;
}

export function useCreatePump() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createPump,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: pumpKeys.all });
    },
  });
}
