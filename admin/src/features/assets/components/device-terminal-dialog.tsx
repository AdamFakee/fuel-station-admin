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
import { DeviceView, TerminalInput, terminalSchema } from '../types';
import { useUpdateTerminal } from '../api/update-terminal';
import { toast } from 'sonner';

interface DeviceTerminalDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  device?: DeviceView | null;
}

export function DeviceTerminalDialog({ open, onOpenChange, device }: DeviceTerminalDialogProps) {
  const updateMutation = useUpdateTerminal();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<TerminalInput>({
    resolver: zodResolver(terminalSchema),
    defaultValues: {
      terminal_code: 'T1',
      host: '192.168.1.100',
      port: 80,
      https: false,
      username: 'admin',
      password: '',
    },
  });

  React.useEffect(() => {
    if (device?.terminal) {
      reset({
        terminal_code: device.terminal.terminal_code,
        host: device.terminal.host,
        port: device.terminal.port,
        https: device.terminal.https,
        username: device.terminal.username,
        password: '',
      });
    }
  }, [device, reset]);

  const onSubmit = async (data: TerminalInput) => {
    if (!device) return;
    try {
      await updateMutation.mutateAsync({
        pumpId: device.pump_id,
        input: data,
      });
      toast.success('Cập nhật máy chấm công Hikvision thành công');
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Có lỗi xảy ra, vui lòng thử lại');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle>Cấu hình Máy Chấm Công Hikvision (ISAPI)</DialogTitle>
          <DialogDescription>
            Cấu hình địa chỉ IP, cổng và tài khoản ISAPI cho trụ {device?.pump_name} ({device?.pump_code})
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="contents">
          <DialogBody className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="terminal_code">Mã máy chấm công *</Label>
                <Input id="terminal_code" placeholder="VD: T1, T2" {...register('terminal_code')} />
                {errors.terminal_code && <p className="text-xs text-destructive">{errors.terminal_code.message}</p>}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="host">Địa chỉ IP / Host *</Label>
                <Input id="host" placeholder="VD: 192.168.1.100" {...register('host')} />
                {errors.host && <p className="text-xs text-destructive">{errors.host.message}</p>}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="port">Cổng kết nối (Port) *</Label>
                <Input id="port" type="number" placeholder="80" {...register('port')} />
                {errors.port && <p className="text-xs text-destructive">{errors.port.message}</p>}
              </div>

              <div className="space-y-1.5 flex flex-col justify-end">
                <label className="flex items-center gap-2 cursor-pointer pb-2">
                  <input type="checkbox" className="rounded" {...register('https')} />
                  <span className="text-xs font-medium">Sử dụng HTTPS (SSL)</span>
                </label>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="username">Tài khoản quản trị máy *</Label>
                <Input id="username" placeholder="admin" {...register('username')} />
                {errors.username && <p className="text-xs text-destructive">{errors.username.message}</p>}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="password">Mật khẩu mới (Nếu đổi)</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Để trống nếu giữ nguyên"
                  {...register('password')}
                />
              </div>
            </div>

            <div className="rounded-md bg-muted/50 p-2.5 text-[11px] text-muted-foreground border">
              Mật khẩu máy chấm công được mã hóa tự động bằng thuật toán AES-GCM trước khi lưu trữ trong cơ sở dữ liệu.
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
