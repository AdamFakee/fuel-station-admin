import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/axios';
import { DispenseSessionDetail } from '../types';
import { dispenseKeys } from './get-sessions';

export async function getSession(id: string): Promise<DispenseSessionDetail> {
  const res = await apiClient.get<DispenseSessionDetail>(`/dispense/sessions/${id}`);
  return res.data;
}

export function useSession(id: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: dispenseKeys.sessionDetail(id),
    queryFn: () => getSession(id),
    enabled: options?.enabled ?? Boolean(id),
  });
}
