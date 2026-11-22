'use client';

import { OptionSelect } from '@/components/option-select';
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
import { useUpdateSensor } from '../api/update-sensor';
import { useUpdateTerminal } from '../api/update-terminal';
import { useBranches } from '../api/get-branches';
import { useTanks } from '../api/get-tanks';
import { toast } from 'sonner';
import { showApiError } from '@/lib/api-error';

/** Tốc độ baud của bộ số Montech: phần cứng cố định, không cho sửa. */
const SENSOR_BAUD = 9600;

/** Cổng HTTP của máy chấm công Hikvision: cố định 80, không cho sửa. */
const TERMINAL_PORT = 80;

interface PumpDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pump?: PumpDetail | null;
}

const EMPTY_VALUES: PumpInput = {
  code: '',
  name: '',
  branch_id: '',
  tank_id: '',
  edge_pump_id: undefined,
  note: '',
  sensor_name: '',
  sensor_com_port: '',
  sensor_serial: 1234,
  sensor_baud: SENSOR_BAUD,
  terminal_code: '',
  terminal_host: '',
  terminal_port: TERMINAL_PORT,
  terminal_https: false,
  terminal_username: 'admin',
  terminal_password: '',
};

/**
 * Trụ bơm cùng bộ số Montech và máy chấm công Hikvision của nó trong MỘT form: mỗi trụ có đúng một bộ số (cổng COM riêng)
 * và một máy chấm công, nên cấu hình thiết bị đi kèm trụ, không tách màn riêng.
 */
export function PumpDialog({ open, onOpenChange, pump }: PumpDialogProps) {
  const isEdit = !!pump;
  const createMutation = useCreatePump();
  const updateMutation = useUpdatePump();
  const updateSensor = useUpdateSensor();
  const updateTerminal = useUpdateTerminal();

  const { data: branchData } = useBranches();

  // useMemo giữ nguyên tham chiếu mảng giữa các lần render (mảng mới mỗi lần sẽ làm các effect bên dưới chạy lặp vô hạn).
  const branches = React.useMemo(() => branchData?.data ?? [], [branchData]);
  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<PumpInput>({
    resolver: zodResolver(pumpSchema),
    defaultValues: EMPTY_VALUES,
  });

  const selectedBranchId = watch('branch_id');
  // Chỉ lấy bể của trạm xăng đang chọn (API trả tối đa 100 bể mỗi trang).
  const { data: tankData } = useTanks({ branch_id: selectedBranchId || undefined, page_size: 100 });
  const selectedTankId = watch('tank_id');
  const tanks = React.useMemo(() => tankData?.data ?? [], [tankData]);
  const availableTanks = React.useMemo(() => {
    if (!selectedBranchId) return tanks;
    return tanks.filter((t) => t.branch_id === selectedBranchId);
  }, [tanks, selectedBranchId]);

  // Đổi trạm xăng thì bể phải thuộc trạm xăng đó: bể đang chọn không hợp lệ thì chọn bể đầu tiên của trạm xăng (hoặc để trống nếu chưa có).
  React.useEffect(() => {
    if (isEdit || !selectedBranchId) return;
    if (!availableTanks.some((t) => t.id === selectedTankId)) {
      setValue('tank_id', availableTanks[0]?.id ?? '');
    }
  }, [isEdit, selectedBranchId, selectedTankId, availableTanks, setValue]);

  React.useEffect(() => {
    if (pump) {
      reset({
        code: pump.code,
        name: pump.name,
        branch_id: pump.branch_id,
        tank_id: pump.nozzles?.[0]?.tank_id || '',
        edge_pump_id: pump.edge_pump_id,
        note: pump.note || '',
        sensor_name: pump.sensor?.name || '',
        sensor_com_port: pump.sensor?.com_port || '',
        sensor_serial: pump.sensor?.serial ?? 1234,
        sensor_baud: SENSOR_BAUD,
        terminal_code: pump.terminal?.terminal_code || '',
        terminal_host: pump.terminal?.host || '',
        terminal_port: TERMINAL_PORT,
        terminal_https: pump.terminal?.https ?? false,
        terminal_username: pump.terminal?.username || 'admin',
        terminal_password: '',
      });
    } else {
      // Tạo mới: form trống; trạm xăng và bể mặc định do hai effect bên trên/dưới điền khi dữ liệu về.
      reset(EMPTY_VALUES);
    }
  }, [pump, reset, open]);

  // Tạo mới: chọn sẵn trạm xăng đầu tiên khi danh sách trạm xăng đã tải và form chưa chọn trạm xăng nào.
  React.useEffect(() => {
    if (isEdit || !open || selectedBranchId || branches.length === 0) return;
    setValue('branch_id', branches[0].id);
  }, [isEdit, open, selectedBranchId, branches, setValue]);

  const onSubmit = async (data: PumpInput) => {
    try {
      if (isEdit && pump) {
        // Ba lần lưu liên tiếp: trụ, bộ số, máy chấm công. Lần nào lỗi thì dừng và báo; phần đã lưu trước đó vẫn giữ.
        await updateMutation.mutateAsync({
          id: pump.id,
          input: { name: data.name, note: data.note, enabled: pump.enabled },
        });
        await updateSensor.mutateAsync({
          pumpId: pump.id,
          input: {
            name: data.sensor_name || undefined,
            serial: data.sensor_serial,
            com_port: data.sensor_com_port,
            baud: SENSOR_BAUD,
          },
        });
        await updateTerminal.mutateAsync({
          pumpId: pump.id,
          input: {
            terminal_code: data.terminal_code || pump.terminal?.terminal_code || `T${pump.edge_pump_id}`,
            host: data.terminal_host,
            port: TERMINAL_PORT,
            https: data.terminal_https,
            username: data.terminal_username,
            password: data.terminal_password || undefined,
          },
        });
        toast.success('Cập nhật trụ bơm và thiết bị thành công');
      } else {
        if (!data.terminal_password) {
          setError('terminal_password', { message: 'Vui lòng nhập mật khẩu máy chấm công' });
          return;
        }
        await createMutation.mutateAsync(data);
        toast.success('Khai báo trụ bơm và thiết bị thành công');
      }
      onOpenChange(false);
    } catch (err: any) {
      showApiError(err, 'Có lỗi xảy ra, vui lòng thử lại');
    }
  };


  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? `Chỉnh sửa trụ bơm: ${pump?.code}` : 'Khai báo trụ bơm'}</DialogTitle>
          <DialogDescription>
            Mỗi trụ có một bộ số Montech (cổng COM riêng) và một máy chấm công Hikvision.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="contents">
          <DialogBody className="max-h-[65vh] space-y-4 overflow-y-auto py-2">
            <div className="border-b pb-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Trụ và vòi bơm
            </div>

            <div className="grid grid-cols-2 gap-3">
              {isEdit && (
                <div className="space-y-1.5">
                  <Label htmlFor="code">Mã trụ bơm</Label>
                  <Input id="code" disabled {...register('code')} />
                </div>
              )}
              <div className="space-y-1.5">
                <Label htmlFor="name">Tên trụ bơm *</Label>
                <Input id="name" placeholder="VD: Trụ số 1" {...register('name')} />
                {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="branch_id">Trạm xăng *</Label>
                <OptionSelect
                  id="branch_id"
                  disabled={isEdit}
                  emptyLabel="Chọn trạm xăng"
                  value={watch('branch_id') ?? ''}
                  onChange={(next) => setValue('branch_id', next, { shouldValidate: true })}
                  options={branches.map((b) => ({ value: b.id, label: b.name }))}
                />
                {errors.branch_id && <p className="text-xs text-destructive">{errors.branch_id.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="tank_id">Bể chứa cấp cho vòi *</Label>
                <OptionSelect
                  id="tank_id"
                  disabled={isEdit}
                  emptyLabel="Chọn bể chứa"
                  value={selectedTankId ?? ''}
                  onChange={(next) => setValue('tank_id', next, { shouldValidate: true })}
                  options={[
                    // Bể hiện tại của vòi luôn có trong danh sách, kể cả khi chưa tải về.
                    ...(pump?.nozzles?.[0] && !availableTanks.some((t) => t.id === pump.nozzles?.[0]?.tank_id)
                      ? [{ value: pump.nozzles[0].tank_id, label: pump.nozzles[0].tank_name }]
                      : []),
                    ...availableTanks.map((t) => ({ value: t.id, label: `${t.name} (${t.fuel_type_name})` })),
                  ]}
                />
                {!isEdit && selectedBranchId && availableTanks.length === 0 && (
                  <p className="text-xs text-amber-600">Trạm xăng này chưa có bể chứa. Hãy tạo bể trước ở màn Bể chứa nhiên liệu.</p>
                )}
                {errors.tank_id && <p className="text-xs text-destructive">{errors.tank_id.message}</p>}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="note">Ghi chú</Label>
              <Input id="note" placeholder="Thông tin bổ sung về trụ bơm..." {...register('note')} />
            </div>

            <div className="border-b pb-1.5 pt-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Bộ số Montech (RS-485)
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="sensor_name">Tên bộ số</Label>
                <Input id="sensor_name" placeholder="Để trống: tự đặt BS-<mã trụ>" {...register('sensor_name')} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="sensor_com_port">Cổng COM *</Label>
                <Input id="sensor_com_port" placeholder="VD: COM7 (mỗi trụ một cổng riêng)" {...register('sensor_com_port')} />
                {errors.sensor_com_port && <p className="text-xs text-destructive">{errors.sensor_com_port.message}</p>}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="sensor_serial">Serial của bộ số</Label>
                <Input id="sensor_serial" type="number" placeholder="1234" {...register('sensor_serial')} />
                <p className="text-[11px] text-muted-foreground">
                  Địa chỉ trong khung RS-485, phải đúng với bộ số thật (mặc định xuất xưởng 1234). Các trụ được phép trùng serial. Tốc độ baud cố định 9600.
                </p>
              </div>
            </div>

            <div className="border-b pb-1.5 pt-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Máy chấm công Hikvision (ISAPI)
            </div>

            <div className="grid grid-cols-1 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="terminal_host">Địa chỉ IP *</Label>
                <Input id="terminal_host" placeholder="192.168.1.17" {...register('terminal_host')} />
                {errors.terminal_host && <p className="text-xs text-destructive">{errors.terminal_host.message}</p>}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="terminal_code">Mã máy</Label>
                <Input id="terminal_code" placeholder="Để trống: tự đặt theo trụ (T1, T2...)" {...register('terminal_code')} />
              </div>
              <div className="flex items-end pb-2">
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" className="h-4 w-4" {...register('terminal_https')} />
                  Dùng HTTPS
                </label>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="terminal_username">Tài khoản *</Label>
                <Input id="terminal_username" placeholder="admin" {...register('terminal_username')} />
                {errors.terminal_username && <p className="text-xs text-destructive">{errors.terminal_username.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="terminal_password">Mật khẩu {isEdit ? '' : '*'}</Label>
                <Input
                  id="terminal_password"
                  type="password"
                  placeholder={isEdit ? 'Để trống để giữ nguyên' : 'Được mã hóa AES-GCM khi lưu'}
                  {...register('terminal_password')}
                />
                {errors.terminal_password && <p className="text-xs text-destructive">{errors.terminal_password.message}</p>}
              </div>
            </div>
          </DialogBody>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Hủy
            </Button>
            <Button
              type="submit"
              disabled={
                isSubmitting ||
                createMutation.isPending ||
                updateMutation.isPending ||
                updateSensor.isPending ||
                updateTerminal.isPending
              }
            >
              {isEdit ? 'Lưu thay đổi' : 'Tạo trụ bơm'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
