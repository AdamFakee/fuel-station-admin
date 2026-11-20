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
