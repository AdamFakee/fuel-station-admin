import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { apiClient } from '@/lib/axios';
import type { CreateFeedbackInput, Feedback, FeedbackStatus } from '../types';

export interface FeedbackListParams {
  kind?: string;
  status?: string;
  q?: string;
  page?: number;
  page_size?: number;
}

export interface FeedbackListResponse {
  data: Feedback[];
  total: number;
  page: number;
  page_size: number;
  status_counts: Partial<Record<FeedbackStatus, number>>;
}

export const feedbackKeys = {
  all: ['feedback'] as const,
  list: (params?: FeedbackListParams) => [...feedbackKeys.all, 'list', params] as const,
};

export function useFeedbackList(params: FeedbackListParams) {
  return useQuery({
    queryKey: feedbackKeys.list(params),
    queryFn: async () => (await apiClient.get<FeedbackListResponse>('/feedback', { params })).data,
  });
}

/** Lấy toàn bộ góp ý theo bộ lọc (qua nhiều trang, tối đa 500) để sao chép hàng loạt. */
export async function fetchAllFeedback(params: Omit<FeedbackListParams, 'page' | 'page_size'>): Promise<Feedback[]> {
  const all: Feedback[] = [];
  for (let page = 1; page <= 5; page++) {
    const res = await apiClient.get<FeedbackListResponse>('/feedback', { params: { ...params, page, page_size: 100 } });
    all.push(...res.data.data);
    if (all.length >= res.data.total) break;
  }
  return all;
}

function errorMessage(error: unknown, fallback: string): string {
  const message = (error as { response?: { data?: { message?: string } } })?.response?.data?.message;
  return message || fallback;
}

export function useCreateFeedback() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateFeedbackInput) => (await apiClient.post<Feedback>('/feedback', input)).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: feedbackKeys.all }),
    onError: (error) => toast.error(errorMessage(error, 'Không gửi được góp ý, vui lòng thử lại')),
  });
}

export function useUpdateFeedbackStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status, resolution_note }: { id: string; status: FeedbackStatus; resolution_note?: string }) =>
      (await apiClient.patch<Feedback>(`/feedback/${id}/status`, { status, resolution_note })).data,
    onSuccess: () => {
      toast.success('Đã cập nhật góp ý');
      queryClient.invalidateQueries({ queryKey: feedbackKeys.all });
    },
    onError: (error) => toast.error(errorMessage(error, 'Không cập nhật được góp ý')),
  });
}

export function useDeleteFeedback() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/feedback/${id}`);
    },
    onSuccess: () => {
      toast.success('Đã xóa góp ý');
      queryClient.invalidateQueries({ queryKey: feedbackKeys.all });
    },
    onError: (error) => toast.error(errorMessage(error, 'Không xóa được góp ý')),
  });
}
