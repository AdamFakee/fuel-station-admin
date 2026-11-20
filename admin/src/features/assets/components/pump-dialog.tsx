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
import { PumpDetail, PumpInput, pumpSchema } from '../types';
import { useCreatePump } from '../api/create-pump';
import { useUpdatePump } from '../api/update-pump';
import { useBranches } from '../api/get-branches';
import { useTanks } from '../api/get-tanks';
import { toast } from 'sonner';

interface PumpDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pump?: PumpDetail | null;
}

export function PumpDialog({ open, onOpenChange, pump }: PumpDialogProps) {
  const isEdit = !!pump;
  const createMutation = useCreatePump();
  const updateMutation = useUpdatePump();

  const { data: branchData } = useBranches();
  const { data: tankData } = useTanks();

  const branches = branchData?.data || [];
  const tanks = tankData?.data || [];

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<PumpInput>({
    resolver: zodResolver(pumpSchema),
    defaultValues: {
      code: '',
      name: '',
      branch_id: '',
      tank_id: '',
      edge_pump_id: 1,
      note: '',
      sensor_com_port: 'COM1',
      sensor_serial: 1234,
      terminal_code: 'T1',
      terminal_host: '192.168.1.100',
      terminal_password: 'Admin@123',
    },
  });

  const selectedBranchId = watch('branch_id');
  const availableTanks = React.useMemo(() => {
    if (!selectedBranchId) return tanks;
    return tanks.filter((t) => t.branch_id === selectedBranchId);
  }, [tanks, selectedBranchId]);

  React.useEffect(() => {
    if (pump) {
      reset({
        code: pump.code,
        name: pump.name,
        branch_id: pump.branch_id,
        tank_id: pump.nozzles?.[0]?.tank_id || '',
        edge_pump_id: pump.edge_pump_id,
        note: pump.note || '',
        sensor_com_port: pump.sensor?.com_port || 'COM1',
        sensor_serial: pump.sensor?.serial || 1234,
        terminal_code: pump.terminal?.terminal_code || 'T1',
        terminal_host: pump.terminal?.host || '192.168.1.100',
        terminal_password: '',
      });
    } else {
      reset({
        code: '',
        name: '',
        branch_id: branches[0]?.id || '',
        tank_id: tanks[0]?.id || '',
        edge_pump_id: undefined,
        note: '',
        sensor_com_port: 'COM1',
        sensor_serial: 1234,
        terminal_code: 'T1',
        terminal_host: '192.168.1.100',
        terminal_password: 'Admin@123',
      });
    }
  }, [pump, branches, tanks, reset]);

  const onSubmit = async (data: PumpInput) => {
    try {
      if (isEdit && pump) {
        await updateMutation.mutateAsync({
          id: pump.id,
          input: {
            name: data.name,
            note: data.note,
            enabled: pump.enabled,
          },
        });
        toast.success('Cập nhật trụ bơm thành công');
      } else {
        await createMutation.mutateAsync(data);
        toast.success('Khai báo trụ bơm và thiết bị thành công');
      }
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Có lỗi xảy ra, vui lòng thử lại');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Chỉnh sửa Trụ Bơm' : 'Khai báo Trụ Bơm & Thiết bị Ngoại vi'}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? 'Cập nhật tên và ghi chú vận hành trụ bơm'
              : 'Thiết lập trụ bơm, vòi xuất nhiên liệu, bộ số Montech và máy chấm công'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="contents">
          <DialogBody className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="code">Mã trụ bơm *</Label>
                <Input id="code" placeholder="VD: TRU-01, PUMP-01" disabled={isEdit} {...register('code')} />
                {errors.code && <p className="text-xs text-destructive">{errors.code.message}</p>}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="name">Tên trụ bơm *</Label>
                <Input id="name" placeholder="VD: Trụ bơm Dầu DO Số 1" {...register('name')} />
                {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="branch_id">Thuộc Chi nhánh *</Label>
                <select
                  id="branch_id"
                  disabled={isEdit}
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-ring"
                  {...register('branch_id')}
                >
                  <option value="">-- Chọn chi nhánh --</option>
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
                {errors.branch_id && <p className="text-xs text-destructive">{errors.branch_id.message}</p>}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="tank_id">Bể chứa nguồn cấp cho vòi *</Label>
                <select
                  id="tank_id"
                  disabled={isEdit}
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-ring"
                  {...register('tank_id')}
                >
                  <option value="">-- Chọn bể chứa --</option>
                  {availableTanks.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.fuel_type_name})
                    </option>
                  ))}
                </select>
                {errors.tank_id && <p className="text-xs text-destructive">{errors.tank_id.message}</p>}
              </div>
            </div>

            {!isEdit && (
              <>
                <div className="border-t pt-3">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Cấu hình Thiết bị Ngoại vi (Bộ số & Máy chấm công)
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="sensor_com_port">Cổng COM Bộ số Montech</Label>
                    <Input id="sensor_com_port" placeholder="VD: COM1, COM7" {...register('sensor_com_port')} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="sensor_serial">Serial Bộ số (4-byte)</Label>
                    <Input id="sensor_serial" type="number" placeholder="1234" {...register('sensor_serial')} />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="terminal_host">IP Máy chấm công Hikvision</Label>
                    <Input id="terminal_host" placeholder="192.168.1.100" {...register('terminal_host')} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="terminal_password">Mật khẩu máy chấm công</Label>
                    <Input
                      id="terminal_password"
                      type="password"
                      placeholder="Mã hóa AES-GCM tự động"
                      {...register('terminal_password')}
                    />
                  </div>
                </div>
              </>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="note">Ghi chú</Label>
              <Input id="note" placeholder="Thông tin bổ sung về trụ bơm..." {...register('note')} />
            </div>
          </DialogBody>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Hủy
            </Button>
            <Button type="submit" disabled={isSubmitting || createMutation.isPending || updateMutation.isPending}>
              {isEdit ? 'Lưu thay đổi' : 'Tạo trụ bơm'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
