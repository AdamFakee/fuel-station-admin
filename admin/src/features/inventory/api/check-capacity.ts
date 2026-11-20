import { apiClient } from '@/lib/axios';
import { CapacityCheckRequest, CapacityCheckResult } from '../types';

export async function checkCapacity(data: CapacityCheckRequest): Promise<CapacityCheckResult> {
  const res = await apiClient.post<CapacityCheckResult>('/inventory/receipts/check-capacity', data);
  return res.data;
}
