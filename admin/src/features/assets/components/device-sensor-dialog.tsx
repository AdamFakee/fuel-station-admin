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
  DialogBody,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DeviceView, SensorInput, sensorSchema } from '../types';
import { useUpdateSensor } from '../api/update-sensor';
import { toast } from 'sonner';

interface DeviceSensorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  device?: DeviceView | null;
}

export function DeviceSensorDialog({ open, onOpenChange, device }: DeviceSensorDialogProps) {
  const updateMutation = useUpdateSensor();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<SensorInput>({
    resolver: zodResolver(sensorSchema),
    defaultValues: {
      com_port: 'COM1',
      serial: 1234,
      baud: 9600,
    },
  });

  React.useEffect(() => {
    if (device?.sensor) {
      reset({
        com_port: device.sensor.com_port,
        serial: device.sensor.serial,
        baud: device.sensor.baud,
      });
    }
  }, [device, reset]);

  const onSubmit = async (data: SensorInput) => {
    if (!device) return;
    try {
      await updateMutation.mutateAsync({
        pumpId: device.pump_id,
        input: data,
      });
      toast.success('Cập nhật cấu hình bộ số Montech thành công');
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Có lỗi xảy ra, vui lòng thử lại');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle>Cấu hình Bộ Số Montech RS-485</DialogTitle>
          <DialogDescription>
            Cập nhật thông số kết nối cổng COM và serial 4-byte cho trụ {device?.pump_name} ({device?.pump_code})
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="contents">
          <DialogBody className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="com_port">Cổng COM trên Mini PC *</Label>
              <Input id="com_port" placeholder="VD: COM1, COM7" {...register('com_port')} />
              {errors.com_port && <p className="text-xs text-destructive">{errors.com_port.message}</p>}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="serial">Serial Bộ số (4-byte) *</Label>
                <Input id="serial" type="number" placeholder="1234" {...register('serial')} />
                {errors.serial && <p className="text-xs text-destructive">{errors.serial.message}</p>}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="baud">Baud Rate *</Label>
                <select
                  id="baud"
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-ring"
                  {...register('baud')}
                >
                  <option value={9600}>9600 (Mặc định)</option>
                  <option value={19200}>19200</option>
                  <option value={38400}>38400</option>
                  <option value={115200}>115200</option>
                </select>
                {errors.baud && <p className="text-xs text-destructive">{errors.baud.message}</p>}
              </div>
            </div>
          </DialogBody>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Hủy
            </Button>
            <Button type="submit" disabled={isSubmitting || updateMutation.isPending}>
              Lưu cấu hình
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
