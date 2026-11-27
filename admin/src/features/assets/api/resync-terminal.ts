import { useMutation } from '@tanstack/react-query';
import { apiClient } from '@/lib/axios';

/** Yêu cầu trạm đẩy lại toàn bộ tài xế và xe xuống máy chấm công của một trụ. Trạm thực hiện ở lần đồng bộ kế tiếp. */
export async function resyncTerminal(pumpId: string): Promise<void> {
  await apiClient.post(`/assets/devices/terminals/${pumpId}/resync`);
}

export function useResyncTerminal() {
  return useMutation({ mutationFn: resyncTerminal });
}
