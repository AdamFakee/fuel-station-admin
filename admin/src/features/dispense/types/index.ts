export interface DispenseSessionListItem {
  id: string;
  code: string;
  edge_ref: string;
  branch_id: string;
  branch_name: string;
  pump_id: string;
  pump_name: string;
  tank_id?: string;
  tank_name?: string;
  fuel_type_name?: string;
  vehicle_id?: string;
  vehicle_plate?: string;
  vehicle_code?: string;
  driver_id?: string;
  driver_name?: string;
  driver_code?: string;
  limit_ml?: number;
  limit_liters?: number;
  dispensed_ml: number;
  dispensed_liters: number;
  pump_total_ml?: number;
  pump_total_liters?: number;
  sensor_serial?: number;
  sale_seq?: number;
  status: 'completed' | 'cancelled' | 'failed';
  edge_state: string;
  started_at?: string;
  finished_at?: string;
  received_at: string;
  created_at: string;
}

export interface SessionTimelineEvent {
  from_state?: string;
  to_state: string;
  occurred_at: string;
}

export interface SessionAccessEvent {
  id: number;
  kind: string;
  method?: 'card' | 'face' | 'fingerprint';
  external_id?: string;
  party_name?: string;
  decision: 'accept' | 'reject';
  reason?: string;
  occurred_at: string;
}

export interface DispenseSessionDetail extends DispenseSessionListItem {
  raw_hex?: string;
  timeline: SessionTimelineEvent[];
  access_events: SessionAccessEvent[];
}

export interface AccessEventListItem {
  id: number;
  edge_ref: string;
  branch_id: string;
  branch_name: string;
  occurred_at: string;
  kind: string;
  method?: 'card' | 'face' | 'fingerprint';
  external_id?: string;
  vehicle_plate?: string;
  driver_name?: string;
  party_name?: string;
  decision: 'accept' | 'reject';
  reason?: string;
  session_id?: string;
  detail?: any;
  received_at: string;
}

export interface DispenseSummary {
  total_sessions: number;
  completed_sessions: number;
  cancelled_sessions: number;
  failed_sessions: number;
  total_dispensed_liters: number;
  rejected_auth_count: number;
}

export interface SessionListParams {
  page?: number;
  page_size?: number;
  q?: string;
  branch_id?: string;
  pump_id?: string;
  vehicle_id?: string;
  driver_id?: string;
  status?: string;
  from_date?: string;
  to_date?: string;
}

export interface AccessEventParams {
  page?: number;
  page_size?: number;
  q?: string;
  branch_id?: string;
  decision?: string;
  method?: string;
  from_date?: string;
  to_date?: string;
}

export interface PagedResponse<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}
