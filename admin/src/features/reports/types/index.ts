export interface StockLedgerSummaryItem {
  tank_id: string;
  tank_code: string;
  tank_name: string;
  fuel_type_name: string;
  branch_name: string;
  capacity_liters: number;
  opening_liters: number;
  receipt_liters: number;
  dispense_liters: number;
  issue_liters: number;
  adjust_liters: number;
  closing_liters: number;
}

export interface StockLedgerLineItem {
  id: number;
  tank_id: string;
  tank_code: string;
  tank_name: string;
  seq: number;
  occurred_at: string;
  kind: string;
  kind_label: string;
  ref_type: string | null;
  ref_code: string | null;
  note: string | null;
  in_liters: number;
  out_liters: number;
  balance_liters: number;
}

export interface StockLedgerResponse {
  summary: StockLedgerSummaryItem[];
  ledger: StockLedgerLineItem[];
  /** Tổng số dòng thẻ kho khớp bộ lọc (không chỉ trang đang xem). */
  ledger_total: number;
  ledger_page: number;
  ledger_page_size: number;
}

export interface ReceiptReportItem {
  id: string;
  receipt_code: string;
  received_at: string;
  tanker_plate: string | null;
  document_no: string | null;
  status: string;
  note: string | null;
  supplier_name: string | null;
  branch_name: string;
  tank_name: string;
  fuel_type_name: string;
  document_liters: number;
  actual_liters: number;
  variance_liters: number;
  created_by_name: string;
  decided_by_name: string | null;
  decided_at: string | null;
}

export interface ReceiptReportResponse {
  items: ReceiptReportItem[];
  total_document_liters: number;
  total_actual_liters: number;
  total_variance_liters: number;
  total_count: number;
}

export interface DispenseReportItem {
  id: string;
  code: string;
  finished_at: string | null;
  started_at: string | null;
  pump_name: string;
  tank_name: string | null;
  fuel_type_name: string | null;
  branch_name: string;
  vehicle_plate: string | null;
  vehicle_code: string | null;
  driver_name: string | null;
  driver_code: string | null;
  dispensed_liters: number;
  pump_total_liters: number | null;
  sale_seq: number | null;
  status: string;
}

export interface DispenseReportResponse {
  items: DispenseReportItem[];
  total_sessions: number;
  total_dispensed_liters: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface VehicleConsumptionItem {
  vehicle_id: string;
  vehicle_code: string;
  vehicle_plate: string;
  type_name: string | null;
  session_count: number;
  total_dispensed_liters: number;
}

export interface VehicleConsumptionResponse {
  items: VehicleConsumptionItem[];
  total_vehicles: number;
  total_sessions: number;
  total_dispensed_liters: number;
}

export interface DriverDispenseItem {
  driver_id: string;
  driver_code: string;
  driver_name: string;
  phone: string | null;
  session_count: number;
  total_dispensed_liters: number;
  avg_liters_per_session: number;
  vehicles_used: string;
}

export interface DriverDispenseResponse {
  items: DriverDispenseItem[];
  total_drivers: number;
  total_sessions: number;
  total_dispensed_liters: number;
}

export type ReportTemplateType =
  | 'stock-ledger'
  | 'receipts'
  | 'dispenses'
  | 'vehicle-consumption'
  | 'driver-dispense';

export interface ReportFilterState {
  branchId?: string;
  tankId?: string;
  fromDate?: string;
  toDate?: string;
  status?: string;
  page?: number;
  pageSize?: number;
}
