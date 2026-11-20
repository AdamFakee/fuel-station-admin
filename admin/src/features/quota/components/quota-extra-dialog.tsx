'use client';

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
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { QuotaExtraFormData, quotaExtraSchema } from '../types';
import { useCreateQuotaExtra } from '../api/create-quota-extra';
import { useQuotaTargets } from '../api/get-quota-targets';
import { toast } from 'sonner';

interface QuotaExtraDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function QuotaExtraDialog({ open, onOpenChange }: QuotaExtraDialogProps) {
  const createMutation = useCreateQuotaExtra();
  const { data: targets } = useQuotaTargets();

  const now = new Date();
  const nextDay = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  const formatLocalISO = (d: Date) => {
    const tzOffset = d.getTimezoneOffset() * 60000;
    return new Date(d.getTime() - tzOffset).toISOString().slice(0, 16);
  };

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<QuotaExtraFormData>({
    resolver: zodResolver(quotaExtraSchema),
    defaultValues: {
      vehicle_id: '',
      extra_volume_liters: 50,
      valid_from: formatLocalISO(now),
      valid_to: formatLocalISO(nextDay),
      reason: '',
    },
  });

  const watchVehicleId = watch('vehicle_id');

  React.useEffect(() => {
    if (open) {
      const cur = new Date();
      const end = new Date(cur.getTime() + 24 * 60 * 60 * 1000);
      reset({
        vehicle_id: '',
        extra_volume_liters: 50,
        valid_from: formatLocalISO(cur),
        valid_to: formatLocalISO(end),
        reason: '',
      });
    }
  }, [open, reset]);

  const onSubmit = async (data: QuotaExtraFormData) => {
    try {
      await createMutation.mutateAsync({
        ...data,
        valid_from: new Date(data.valid_from).toISOString(),
        valid_to: new Date(data.valid_to).toISOString(),
      });
      toast.success('Cấp bổ sung hạn mức đột xuất thành công');
      onOpenChange(false);
    } catch {
      toast.error('Có lỗi xảy ra khi cấp bổ sung hạn mức. Vui lòng kiểm tra lại.');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle>Cấp bổ sung hạn mức nhiên liệu đột xuất</DialogTitle>
          <DialogDescription>
            Phê duyệt hạn mức bổ sung (Lít) ngoài định mức thông thường cho xe phục vụ chuyến phát sinh.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)}>
          <DialogBody className="space-y-4">
            {/* Chọn xe */}
            <div className="space-y-1.5">
              <Label>Phương tiện được cấp bổ sung</Label>
              <Select
                value={watchVehicleId}
                onValueChange={(val) => setValue('vehicle_id', val)}
                disabled={createMutation.isPending}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="-- Chọn xe (Biển số) --" />
                </SelectTrigger>
                <SelectContent>
                  {targets?.vehicles?.map((v) => (
                    <SelectItem key={v.id} value={v.id}>
                      {v.name} ({v.code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.vehicle_id && (
                <p className="text-xs text-destructive">{errors.vehicle_id.message}</p>
              )}
            </div>

            {/* Số lít bổ sung */}
            <div className="space-y-1.5">
              <Label htmlFor="extra_volume_liters">Số lít nhiên liệu cấp thêm (Lít)</Label>
              <Input
                id="extra_volume_liters"
                type="number"
                step="0.5"
                min="0.5"
                placeholder="VD: 50.0"
                disabled={createMutation.isPending}
                {...register('extra_volume_liters', { valueAsNumber: true })}
                className={errors.extra_volume_liters ? 'border-destructive' : ''}
              />
              {errors.extra_volume_liters && (
                <p className="text-xs text-destructive">{errors.extra_volume_liters.message}</p>
              )}
            </div>

            {/* Thời gian hiệu lực */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="valid_from">Bắt đầu từ</Label>
                <Input
                  id="valid_from"
                  type="datetime-local"
                  disabled={createMutation.isPending}
                  {...register('valid_from')}
                />
                {errors.valid_from && (
                  <p className="text-xs text-destructive">{errors.valid_from.message}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="valid_to">Kết thúc lúc</Label>
                <Input
                  id="valid_to"
                  type="datetime-local"
                  disabled={createMutation.isPending}
                  {...register('valid_to')}
                />
                {errors.valid_to && (
                  <p className="text-xs text-destructive">{errors.valid_to.message}</p>
                )}
              </div>
            </div>

            {/* Lý do */}
            <div className="space-y-1.5">
              <Label htmlFor="reason">Lý do cấp bổ sung (Bắt buộc cho kiểm toán)</Label>
              <Textarea
                id="reason"
                rows={3}
                placeholder="VD: Xe chạy tăng bo chuyến hàng khẩn cấp tuyến miền Tây..."
                disabled={createMutation.isPending}
                {...register('reason')}
                className={errors.reason ? 'border-destructive' : ''}
              />
              {errors.reason && (
                <p className="text-xs text-destructive">{errors.reason.message}</p>
              )}
            </div>
          </DialogBody>

          <DialogFooter className="mt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={createMutation.isPending}
            >
              Hủy
            </Button>
            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending ? 'Đang cấp bổ sung...' : 'Xác nhận cấp bổ sung'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
