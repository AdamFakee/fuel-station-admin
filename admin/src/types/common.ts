export interface BaseEntity {
  id: string;
  created_at: string;
  updated_at: string;
}

export interface PagingParams {
  page?: number;
  page_size?: number;
  q?: string;
}

export interface PagedResult<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
}

export interface ApiErrorResponse {
  code: string;
  message: string;
}
