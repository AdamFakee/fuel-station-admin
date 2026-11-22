export type ReceiptStatus = 'draft' | 'pending' | 'approved' | 'rejected';

export interface Supplier {
  id: string;
  tenant_id: string;
  code: string;
  name: string;
  phone?: string;
  address?: string;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface StockReceiptLine {
  id: string;
  tenant_id: string;
  receipt_id: string;
  tank_id: string;
  tank_code: string;
  tank_name: string;
  fuel_type_id: string;
  fuel_type_name: string;
  level_before_ml?: number;
  document_volume_ml: number;
  actual_volume_ml: number;
  level_after_ml?: number;
  variance_ml: number;
}

export interface StockReceipt {
  id: string;
  tenant_id: string;
  branch_id: string;
  branch_name: string;
  code: string;
  received_at: string;
  supplier_id?: string;
  supplier_name?: string;
  tanker_plate?: string;
  document_no?: string;
  status: ReceiptStatus;
  note?: string;
  created_by: string;
  created_by_name: string;
  decided_by?: string;
  decided_by_name?: string;
  decided_at?: string;
  reject_reason?: string;
  total_volume_ml: number;
  lines: StockReceiptLine[];
  created_at: string;
  updated_at: string;
}

export interface StockReceiptLineInput {
  tank_id: string;
  fuel_type_id: string;
  level_before_ml?: number;
  document_volume_ml: number;
  actual_volume_ml: number;
  level_after_ml?: number;
}

export interface CreateReceiptRequest {
  branch_id: string;
  received_at: string;
  supplier_id?: string;
  tanker_plate?: string;
  document_no?: string;
  note?: string;
  lines: StockReceiptLineInput[];
}

export interface UpdateReceiptRequest {
  branch_id: string;
  received_at: string;
  supplier_id?: string;
  tanker_plate?: string;
  document_no?: string;
  note?: string;
  lines: StockReceiptLineInput[];
}

export interface ApproveReceiptRequest {
  approved: boolean;
  reject_reason?: string;
}

export interface ReceiptListParams {
  q?: string;
  branch_id?: string;
  status?: string;
  page?: number;
  page_size?: number;
}

export interface ReceiptListResponse {
  data: StockReceipt[];
  total: number;
  page: number;
  page_size: number;
}

export interface CapacityCheckRequest {
  tank_id: string;
  incoming_volume_ml: number;
}

export interface CapacityCheckResult {
  tank_id: string;
  tank_name: string;
  current_stock_ml: number;
  max_usable_capacity_ml: number;
  available_room_ml: number;
  incoming_volume_ml: number;
  exceeds_capacity: boolean;
}

// ------------------------------------------------------------------------------------------------
// STOCK ISSUE TYPES (M11)
// ------------------------------------------------------------------------------------------------

export type IssueKind = 'transfer' | 'loss' | 'inspection';
export type IssueStatus = 'draft' | 'pending' | 'approved' | 'rejected';

export interface StockIssue {
  id: string;
  tenant_id: string;
  branch_id: string;
  branch_name: string;
  code: string;
  kind: IssueKind;
  kind_name: string;
  tank_id: string;
  tank_code: string;
  tank_name: string;
  fuel_type_id: string;
  fuel_type_name: string;
  to_tank_id?: string;
  to_tank_code?: string;
  to_tank_name?: string;
  volume_ml: number;
  volume_liters: number;
  reason: string;
  status: IssueStatus;
  created_by: string;
  created_by_name: string;
  decided_by?: string;
  decided_by_name?: string;
  decided_at?: string;
  reject_reason?: string;
  created_at: string;
  updated_at: string;
}

export interface CreateIssueInput {
  branch_id: string;
  kind: IssueKind;
  tank_id: string;
  to_tank_id?: string;
  volume_liters: number;
  reason: string;
}

export interface UpdateIssueInput {
  branch_id: string;
  kind: IssueKind;
  tank_id: string;
  to_tank_id?: string;
  volume_liters: number;
  reason: string;
}

export interface ApproveIssueInput {
  approved: boolean;
  reject_reason?: string;
}

export interface IssueListParams {
  page?: number;
  page_size?: number;
  q?: string;
  branch_id?: string;
  status?: string;
  kind?: string;
}

export interface IssueListResponse {
  items: StockIssue[];
  total: number;
  page: number;
  page_size: number;
}

// ------------------------------------------------------------------------------------------------
// M12: STOCKTAKE, RECONCILIATION, TANK STOCK & ALERTS
// ------------------------------------------------------------------------------------------------

export interface TankStockItem {
  tenant_id: string;
  tank_id: string;
  branch_id: string;
  branch_name: string;
  code: string;
  name: string;
  fuel_type_id: string;
  fuel_type_name: string;
  stock_ml: number;
  stock_liters: number;
  max_usable_capacity_ml: number;
  max_capacity_liters: number;
  low_stock_threshold_ml: number;
  low_stock_threshold_liters: number;
  stock_pct: number;
  is_low: boolean;
  has_opening: boolean;
}

export interface StockLedgerItem {
  id: number;
  tenant_id: string;
  tank_id: string;
  tank_code: string;
  tank_name: string;
  seq: number;
  occurred_at: string;
  kind: 'opening' | 'receipt' | 'dispense' | 'issue' | 'transfer_out' | 'transfer_in' | 'adjust';
  delta_ml: number;
  delta_liters: number;
  balance_after_ml: number;
  balance_after_liters: number;
  ref_type?: string;
  ref_id?: string;
  note?: string;
  created_by?: string;
  created_by_name?: string;
  created_at: string;
}
