import { z } from 'zod';

export type QuotaPeriod = 'per_dispense' | 'day' | 'week' | 'month';
export type QuotaTargetType = 'vehicle' | 'vehicle_group' | 'route';
export type QuotaRuleStatus = 'active' | 'cancelled';

export interface QuotaRule {
  id: string;
  tenant_id: string;
  code: string;
  target_type: QuotaTargetType;
  target_id: string;
  target_code?: string;
  target_name?: string;
  period: QuotaPeriod;
  max_volume_ml: number;
  max_volume_liters: number;
  min_interval_minutes: number;
  effective_from: string;
  effective_to?: string;
  status: QuotaRuleStatus;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export interface QuotaExtra {
  id: string;
  tenant_id: string;
  vehicle_id: string;
  vehicle_plate: string;
  vehicle_code: string;
  extra_volume_ml: number;
  extra_volume_liters: number;
  valid_from: string;
  valid_to: string;
  reason: string;
  granted_by: string;
  granted_by_name: string;
  created_at: string;
}

export interface TargetOption {
  id: string;
  code: string;
  name: string;
  type: QuotaTargetType;
}

export interface QuotaTargets {
  vehicles: TargetOption[];
  vehicle_groups: TargetOption[];
  routes: TargetOption[];
}

export const quotaRuleSchema = z.object({
  code: z.string().optional(),
  target_type: z.enum(['vehicle', 'vehicle_group', 'route'], {
    errorMap: () => ({ message: 'Vui lòng chọn đối tượng áp dụng' }),
  }),
  target_id: z.string().min(1, 'Vui lòng chọn đối tượng cụ thể'),
  period: z.enum(['per_dispense', 'day', 'week', 'month'], {
    errorMap: () => ({ message: 'Vui lòng chọn chu kỳ định mức' }),
  }),
  max_volume_liters: z.number().positive('Số lít định mức phải lớn hơn 0'),
  min_interval_minutes: z.number().min(0, 'Khoảng cách giữa hai lần bơm không được âm'),
  effective_from: z.string().min(1, 'Vui lòng chọn ngày bắt đầu hiệu lực'),
  effective_to: z.string().optional(),
});

export type QuotaRuleFormData = z.infer<typeof quotaRuleSchema>;

export const quotaExtraSchema = z.object({
  vehicle_id: z.string().min(1, 'Vui lòng chọn xe'),
  extra_volume_liters: z.number().positive('Số lít bổ sung phải lớn hơn 0'),
  valid_from: z.string().min(1, 'Vui lòng chọn thời gian bắt đầu'),
  valid_to: z.string().min(1, 'Vui lòng chọn thời gian kết thúc'),
  reason: z.string().min(3, 'Vui lòng nhập lý do cấp bổ sung (tối thiểu 3 ký tự)'),
});

export type QuotaExtraFormData = z.infer<typeof quotaExtraSchema>;
