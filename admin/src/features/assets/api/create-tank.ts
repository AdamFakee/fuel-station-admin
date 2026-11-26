import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/axios';
import { Tank, TankInput } from '../types';
import { tankKeys } from './get-tanks';

export async function createTank(input: TankInput): Promise<Tank> {
  const payload = {
    name: input.name,
    branch_id: input.branch_id,
    fuel_type_id: input.fuel_type_id,
    design_capacity_ml: Math.round(input.design_capacity_liters * 1000),
    max_usable_capacity_ml: Math.round(input.max_usable_capacity_liters * 1000),
    low_stock_threshold_ml: Math.round(input.low_stock_threshold_liters * 1000),
    loss_tolerance_pct: input.loss_tolerance_pct,
    opening_stock_ml: Math.round((input.opening_stock_liters || 0) * 1000),
  };

  const res = await apiClient.post<Tank>('/assets/tanks', payload);
  return res.data;
}

export function useCreateTank() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createTank,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: tankKeys.all });
    },
  });
}
