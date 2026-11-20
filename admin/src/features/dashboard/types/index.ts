export interface TankStockItem {
  tank_id: string;
  tank_code: string;
  tank_name: string;
  branch_id: string;
  branch_name: string;
  fuel_type_code: string;
  fuel_type_name: string;
  stock_liters: number;
  max_capacity_liters: number;
  stock_pct: number;
  is_low: boolean;
  has_opening: boolean;
}

export interface PumpStatusItem {
  pump_id: string;
  pump_code: string;
  pump_name: string;
  edge_pump_id: number;
  branch_name: string;
  is_station_online: boolean;
  today_dispensed_liters: number;
  today_dispense_count: number;
}

export interface RecentSessionItem {
  id: string;
  code: string;
  pump_name: string;
  vehicle_plate: string;
  driver_name: string;
  dispensed_liters: number;
  status: 'completed' | 'cancelled' | 'failed';
  finished_at?: string;
  received_at: string;
}

export interface DashboardKpi {
  today_total_liters: number;
  today_total_sessions: number;
  today_completed_sessions: number;
  today_failed_sessions: number;
  active_pumps: number;
  online_stations: number;
  low_stock_tanks: number;
}

export interface DashboardResponse {
  kpi: DashboardKpi;
  tanks: TankStockItem[];
  pumps: PumpStatusItem[];
  recent_sessions: RecentSessionItem[];
  generated_at: string;
}
