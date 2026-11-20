import { z } from 'zod';

// ------------------------------------------------------------------------------------------------
// ENTITY MODELS
// ------------------------------------------------------------------------------------------------

export interface Branch {
  id: string;
  tenant_id: string;
  code: string;
  name: string;
  address?: string;
  manager_name?: string;
  phone?: string;
  status: 'active' | 'inactive';
  created_at: string;
  updated_at: string;
}

export interface FuelType {
  id: string;
  tenant_id: string;
  code: string;
  name: string;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Tank {
  id: string;
  tenant_id: string;
  branch_id: string;
  branch_name: string;
  code: string;
  name: string;
  fuel_type_id: string;
  fuel_type_name: string;
  design_capacity_ml: number;
  max_usable_capacity_ml: number;
  low_stock_threshold_ml: number;
  loss_tolerance_pct: number;
  status: 'active' | 'inactive';
  current_stock_ml: number;
  created_at: string;
  updated_at: string;
}

export interface Nozzle {
  id: string;
  tenant_id: string;
  pump_id: string;
  nozzle_no: number;
  tank_id: string;
  tank_name: string;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface PumpSensor {
  id: string;
  tenant_id: string;
  pump_id: string;
  /** Tên gợi nhớ của bộ số (mặc định BS-<mã trụ>). */
  name: string;
  serial: number;
  com_port: string;
  baud: number;
  version: number;
  created_at: string;
  updated_at: string;
}

export interface AccessTerminal {
  id: string;
  tenant_id: string;
  pump_id: string;
  terminal_code: string;
  host: string;
  port: number;
  https: boolean;
  username: string;
  has_password: boolean;
  version: number;
  created_at: string;
  updated_at: string;
}

export interface PumpDetail {
  id: string;
  tenant_id: string;
  branch_id: string;
  branch_name: string;
  code: string;
  edge_pump_id: number;
  name: string;
  note?: string;
  enabled: boolean;
  version: number;
  nozzles?: Nozzle[];
  sensor?: PumpSensor;
  terminal?: AccessTerminal;
  created_at: string;
  updated_at: string;
}

export interface DeviceView {
  pump_id: string;
  pump_code: string;
  pump_name: string;
  branch_id: string;
  branch_name: string;
  sensor?: PumpSensor;
  terminal?: AccessTerminal;
}

// ------------------------------------------------------------------------------------------------
// FORM SCHEMAS (ZOD)
// ------------------------------------------------------------------------------------------------

export const branchSchema = z.object({
  code: z
    .string()
    .min(1, 'Mã chi nhánh không được để trống')
    .regex(/^[A-Za-z0-9_-]{1,32}$/, 'Mã chỉ gồm chữ, số, gạch ngang (tối đa 32 ký tự)'),
  name: z.string().min(1, 'Tên chi nhánh không được để trống'),
  address: z.string().optional(),
  manager_name: z.string().optional(),
  phone: z.string().optional(),
});
export type BranchInput = z.infer<typeof branchSchema>;

export const tankSchema = z.object({
  code: z
    .string()
    .min(1, 'Mã bể không được để trống')
    .regex(/^[A-Za-z0-9_-]{1,32}$/, 'Mã chỉ gồm chữ, số, gạch ngang (tối đa 32 ký tự)'),
  name: z.string().min(1, 'Tên bể không được để trống'),
  branch_id: z.string().min(1, 'Vui lòng chọn chi nhánh'),
  fuel_type_id: z.string().min(1, 'Vui lòng chọn loại nhiên liệu'),
  design_capacity_liters: z.coerce.number().min(100, 'Dung tích thiết kế tối thiểu 100 Lít'),
  max_usable_capacity_liters: z.coerce.number().min(100, 'Dung tích khả dụng tối thiểu 100 Lít'),
  low_stock_threshold_liters: z.coerce.number().min(0, 'Ngưỡng cảnh báo không âm'),
  loss_tolerance_pct: z.coerce.number().min(0.01).max(5, 'Độ dung sai hao hụt từ 0.01% đến 5%'),
  opening_stock_liters: z.coerce.number().min(0, 'Tồn đầu kỳ không âm').optional(),
});
export type TankInput = z.infer<typeof tankSchema>;

export const pumpSchema = z.object({
  // Mã trụ do hệ thống sinh; chỉ có giá trị khi sửa (hiển thị, không gửi đi).
  code: z.string().optional(),
  name: z.string().min(1, 'Tên trụ không được để trống'),
  branch_id: z.string().min(1, 'Vui lòng chọn chi nhánh'),
  tank_id: z.string().min(1, 'Vui lòng chọn bể kết nối vòi bơm'),
  edge_pump_id: z.coerce.number().min(0).optional(),
  note: z.string().optional(),
  sensor_name: z.string().optional(),
  sensor_com_port: z.string().min(1, 'Cổng COM không được để trống'),
  sensor_serial: z.coerce.number().min(0),
  sensor_baud: z.coerce.number().min(1200),
  terminal_code: z.string().optional(),
  terminal_host: z.string().min(1, 'Địa chỉ máy chấm công không được để trống'),
  terminal_port: z.coerce.number().min(1, 'Cổng từ 1 đến 65535').max(65535, 'Cổng từ 1 đến 65535'),
  terminal_https: z.boolean(),
  terminal_username: z.string().min(1, 'Tài khoản không được để trống'),
  terminal_password: z.string().optional(),
});
export type PumpInput = z.infer<typeof pumpSchema>;

export const sensorSchema = z.object({
  name: z.string().optional(),
  serial: z.coerce.number().min(0),
  com_port: z.string().min(1, 'Cổng COM không được để trống'),
  baud: z.coerce.number().min(1200),
});
export type SensorInput = z.infer<typeof sensorSchema>;

export const terminalSchema = z.object({
  terminal_code: z.string().min(1, 'Mã máy không được để trống'),
  host: z.string().min(1, 'IP / Host không được để trống'),
  port: z.coerce.number().min(1).max(65535),
  https: z.boolean(),
  username: z.string().min(1, 'Username không được để trống'),
  password: z.string().optional(),
});
export type TerminalInput = z.infer<typeof terminalSchema>;
