import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/axios';
import { DeviceView } from '../types';

export const deviceKeys = {
  all: ['devices'] as const,
  list: (branchId?: string) => [...deviceKeys.all, 'list', branchId] as const,
};

export async function getDevices(branchId?: string): Promise<DeviceView[]> {
  const res = await apiClient.get<DeviceView[]>('/assets/devices', {
    params: branchId ? { branch_id: branchId } : undefined,
  });
  return res.data;
}

export function useDevices(branchId?: string) {
  return useQuery({
    queryKey: deviceKeys.list(branchId),
    queryFn: () => getDevices(branchId),
  });
}
