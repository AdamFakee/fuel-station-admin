'use client';

import { DatePicker } from '@/components/date-picker';
import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogBody,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { QuotaRule, QuotaRuleFormData, quotaRuleSchema, QuotaTargetType } from '../types';
import { useCreateQuotaRule } from '../api/create-quota-rule';
import { useUpdateQuotaRule } from '../api/update-quota-rule';
import { useQuotaTargets } from '../api/get-quota-targets';
import { toast } from 'sonner';

interface QuotaRuleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingRule?: QuotaRule | null;
}

export function QuotaRuleDialog({ open, onOpenChange, editingRule }: QuotaRuleDialogProps) {
  const isEdit = !!editingRule;
  const createMutation = useCreateQuotaRule();
  const updateMutation = useUpdateQuotaRule();
  const { data: targets } = useQuotaTargets();

  const [selectedTargetType, setSelectedTargetType] = React.useState<QuotaTargetType>('vehicle');

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<QuotaRuleFormData>({
    resolver: zodResolver(quotaRuleSchema),
    defaultValues: {
      code: '',
      target_type: 'vehicle',
      target_id: '',
      period: 'day',
      max_volume_liters: 50,
      min_interval_minutes: 30,
      effective_from: new Date().toISOString().split('T')[0],
      effective_to: '',
    },
  });

  const watchPeriod = watch('period');
  const watchTargetId = watch('target_id');

  React.useEffect(() => {
    if (editingRule) {
      reset({
        code: editingRule.code,
        target_type: editingRule.target_type,
        target_id: editingRule.target_id,
        period: editingRule.period,
        max_volume_liters: editingRule.max_volume_liters,
        min_interval_minutes: editingRule.min_interval_minutes,
        effective_from: editingRule.effective_from,
        effective_to: editingRule.effective_to || '',
      });
      setSelectedTargetType(editingRule.target_type);
    } else {
      reset({
        code: '',
        target_type: 'vehicle',
        target_id: '',
        period: 'day',
        max_volume_liters: 50,
        min_interval_minutes: 30,
        effective_from: new Date().toISOString().split('T')[0],
        effective_to: '',
      });
      setSelectedTargetType('vehicle');
    }
  }, [editingRule, reset]);

  const targetOptions = React.useMemo(() => {
    if (!targets) return [];
    switch (selectedTargetType) {
      case 'vehicle':
        return targets.vehicles || [];
      default:
        return [];
    }
  }, [targets, selectedTargetType]);

  const onSubmit = async (data: QuotaRuleFormData) => {
    try {
      if (isEdit && editingRule) {
        await updateMutation.mutateAsync({
          id: editingRule.id,
          max_volume_liters: data.max_volume_liters,
          min_interval_minutes: data.min_interval_minutes,
          effective_to: data.effective_to || undefined,
        });
        toast.success(`Cập nhật định mức ${editingRule.code} thành công`);
      } else {
        await createMutation.mutateAsync({
          ...data,
          effective_to: data.effective_to || undefined,
        });
        toast.success('Thiết lập quy tắc định mức thành công');
      }
      onOpenChange(false);
    } catch {
      toast.error('Có lỗi xảy ra khi lưu định mức. Vui lòng kiểm tra lại dữ liệu.');
    }
  };

  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? `Chỉnh sửa định mức: ${editingRule?.code}` : 'Thiết lập quy tắc định mức mới'}
          </DialogTitle>
          <DialogDescription>
            {isEdit
              ? 'Điều chỉnh số lít định mức tối đa, thời gian giãn cách hoặc hạn hiệu lực.'
              : 'Khai báo hạn mức nhiên liệu (Lít) áp dụng cho từng xe, nhóm xe hoặc tuyến đường.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)}>
          <DialogBody className="space-y-4">
            {/* Mã quy tắc (Optional) */}
            <div className="space-y-1.5">
              <Label htmlFor="code">Mã quy tắc (Mặc định hệ thống tự sinh)</Label>
              <Input
                id="code"
                placeholder="VD: DM-2026-0001"
                disabled={isEdit || isSubmitting}
                {...register('code')}
              />
            </div>

            {/* Đối tượng áp dụng */}
            <div className="grid grid-cols-1 gap-4">
              <div className="space-y-1.5">
                <Label>Xe áp dụng</Label>
                {isEdit ? (
                  <Input
                    value={editingRule?.target_name || editingRule?.target_code || ''}
                    disabled
                    className="bg-muted font-medium"
                  />
                ) : (
                  <Select
                    value={watchTargetId}
                    onValueChange={(val) => setValue('target_id', val)}
                    disabled={isSubmitting}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="-- Chọn xe áp dụng --" />
                    </SelectTrigger>
                    <SelectContent>
                      {targetOptions.map((opt) => (
                        <SelectItem key={opt.id} value={opt.id}>
                          {opt.name} ({opt.code})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                {errors.target_id && (
                  <p className="text-xs text-destructive">{errors.target_id.message}</p>
                )}
              </div>
            </div>

            {/* Chu kỳ & Định mức lít */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Chu kỳ cấp phát</Label>
                <Select
                  value={watchPeriod}
                  onValueChange={(val: 'per_dispense' | 'day' | 'week' | 'month') => setValue('period', val)}
                  disabled={isEdit || isSubmitting}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Chọn chu kỳ" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="per_dispense">Từng lần bơm (Giới hạn mỗi lần)</SelectItem>
                    <SelectItem value="day">Theo ngày (Ca 24h)</SelectItem>
                    <SelectItem value="week">Theo tuần</SelectItem>
                    <SelectItem value="month">Theo tháng</SelectItem>
                  </SelectContent>
                </Select>
                {errors.period && (
                  <p className="text-xs text-destructive">{errors.period.message}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="max_volume_liters">Hạn mức tối đa (Lít)</Label>
                <Input
                  id="max_volume_liters"
                  type="number"
                  step="0.1"
                  min="0.1"
                  placeholder="VD: 100.0"
                  disabled={isSubmitting}
                  {...register('max_volume_liters', { valueAsNumber: true })}
                  className={errors.max_volume_liters ? 'border-destructive' : ''}
                />
                {errors.max_volume_liters && (
                  <p className="text-xs text-destructive">{errors.max_volume_liters.message}</p>
                )}
              </div>
            </div>

            {/* Giãn cách bơm tối thiểu */}
            <div className="space-y-1.5">
              <Label htmlFor="min_interval_minutes">
                Giãn cách tối thiểu giữa 2 lần bơm liên tiếp (Phút)
              </Label>
              <Input
                id="min_interval_minutes"
                type="number"
                min="0"
                placeholder="VD: 30 phút (chống bơm liên tục)"
                disabled={isSubmitting}
                {...register('min_interval_minutes', { valueAsNumber: true })}
              />
              <p className="text-[11px] text-muted-foreground">
                Để 0 nếu cho phép bơm liên tiếp không giới hạn thời gian cách nhau.
              </p>
            </div>

            {/* Thời gian hiệu lực */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="effective_from">Có hiệu lực từ ngày</Label>
                <DatePicker
                  id="effective_from"
                  disabled={isEdit || isSubmitting}
                  value={watch('effective_from') ?? ''}
                  onChange={(next) => setValue('effective_from', next, { shouldValidate: true })}
                />
                {errors.effective_from && (
                  <p className="text-xs text-destructive">{errors.effective_from.message}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="effective_to">Đến ngày (Để trống nếu vô thời hạn)</Label>
                <DatePicker
                  id="effective_to"
                  clearable
                  disabled={isSubmitting}
                  value={watch('effective_to') ?? ''}
                  onChange={(next) => setValue('effective_to', next)}
                />
              </div>
            </div>
          </DialogBody>

          <DialogFooter className="mt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Hủy
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Đang lưu...' : isEdit ? 'Cập nhật định mức' : 'Tạo quy tắc định mức'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
