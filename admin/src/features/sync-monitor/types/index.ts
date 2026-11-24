export interface EdgeStationStatus {
  id: string;
  branch_id: string;
  branch_code: string;
  branch_name: string;
  code: string;
  name: string;
  status: 'active' | 'inactive';
  is_online: boolean;
  last_seen_at?: string;
  last_sync_at?: string;
  pending_queue: number;
  agent_version?: string;
  last_error?: string;
  created_at: string;
  updated_at: string;
  /** false: chi nhánh chưa có trạm Edge (id, code rỗng), chưa cấp khóa lần nào. */
  has_station: boolean;
  /** Trạm đang có khóa API còn hiệu lực. Khóa thật không bao giờ được trả lại. */
  has_api_key: boolean;
  /** 7 ký tự cuối của khóa đang dùng; không có nếu chưa cấp hoặc khóa cấp từ trước khi có gợi ý. */
  api_key_hint?: string;
}

/** Kết quả cấp khóa. `api_key` chỉ có đúng một lần trong phản hồi này. */
export interface IssuedApiKey {
  branch_id: string;
  /** Giá trị `station_id` điền vào edge.conf của mini server. */
  station_code: string;
  api_key: string;
  issued_at: string;
  /** true: trạm đã có khóa trước đó, khóa cũ mất hiệu lực ngay. */
  reissued: boolean;
}

export interface SyncMonitorSummary {
  total_stations: number;
  online_stations: number;
  offline_stations: number;
  total_pending_queue: number;
  error_stations: number;
}

export interface SyncMonitorResponse {
  summary: SyncMonitorSummary;
  stations: EdgeStationStatus[];
}
