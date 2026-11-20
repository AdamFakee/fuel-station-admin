import apiClient from '@/lib/axios';

export interface PagedParams {
  page?: number;
  page_size?: number;
  q?: string;
  sort_by?: string;
  order?: 'asc' | 'desc';
}

export interface PagedResponse<T> {
  data: T[];
  total: number;
  page: number;
  page_size: number;
}

export const baseApiService = {
  get: async <T>(url: string, params?: Record<string, unknown>): Promise<T> => {
    const res = await apiClient.get<T>(url, { params });
    return res.data;
  },
  post: async <T>(url: string, data?: unknown): Promise<T> => {
    const res = await apiClient.post<T>(url, data);
    return res.data;
  },
  put: async <T>(url: string, data?: unknown): Promise<T> => {
    const res = await apiClient.put<T>(url, data);
    return res.data;
  },
  patch: async <T>(url: string, data?: unknown): Promise<T> => {
    const res = await apiClient.patch<T>(url, data);
    return res.data;
  },
  delete: async <T>(url: string): Promise<T> => {
    const res = await apiClient.delete<T>(url);
    return res.data;
  },
};
