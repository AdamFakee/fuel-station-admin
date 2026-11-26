import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/axios';
import { Tank, TankInput } from '../types';
import { tankKeys } from './get-tanks';

export async function updateTank({
  id,
  input,
}: {
  id: string;
  input: Partial<TankInput>;
}): Promise<Tank> {
  const payload: any = {
    name: input.name,
    fuel_type_id: input.fuel_type_id,
  };
  if (input.design_capacity_liters) payload.design_capacity_ml = Math.round(input.design_capacity_liters * 1000);
  if (input.max_usable_capacity_liters) payload.max_usable_capacity_ml = Math.round(input.max_usable_capacity_liters * 1000);
  if (input.low_stock_threshold_liters !== undefined) payload.low_stock_threshold_ml = Math.round(input.low_stock_threshold_liters * 1000);
  if (input.loss_tolerance_pct !== undefined) payload.loss_tolerance_pct = input.loss_tolerance_pct;

  const res = await apiClient.put<Tank>(`/assets/tanks/${id}`, payload);
  return res.data;
}

export function useUpdateTank() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateTank,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: tankKeys.all });
    },
  });
}
