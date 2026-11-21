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
import { Tank, TankInput, tankSchema } from '../types';
import { useCreateTank } from '../api/create-tank';
import { useUpdateTank } from '../api/update-tank';
import { useBranches } from '../api/get-branches';
import { useFuelTypes } from '../api/get-fuel-types';
import { toast } from 'sonner';

interface TankDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tank?: Tank | null;
}

export function TankDialog({ open, onOpenChange, tank }: TankDialogProps) {
  const isEdit = !!tank;
  const createMutation = useCreateTank();
  const updateMutation = useUpdateTank();

  const { data: branchData } = useBranches();
  const { data: fuelTypes } = useFuelTypes();

  const branches = branchData?.data || [];

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<TankInput>({
    resolver: zodResolver(tankSchema),
    defaultValues: {
      code: '',
      name: '',
      branch_id: '',
      fuel_type_id: '',
      design_capacity_liters: 25000,
      max_usable_capacity_liters: 24000,
      low_stock_threshold_liters: 3000,
      loss_tolerance_pct: 0.5,
      opening_stock_liters: 0,
    },
  });

  React.useEffect(() => {
    if (tank) {
      reset({
        code: tank.code,
        name: tank.name,
        branch_id: tank.branch_id,
        fuel_type_id: tank.fuel_type_id,
        design_capacity_liters: tank.design_capacity_ml / 1000,
        max_usable_capacity_liters: tank.max_usable_capacity_ml / 1000,
        low_stock_threshold_liters: tank.low_stock_threshold_ml / 1000,
        loss_tolerance_pct: tank.loss_tolerance_pct,
        opening_stock_liters: tank.current_stock_ml / 1000,
      });
    } else {
      reset({
        code: '',
        name: '',
        branch_id: branches[0]?.id || '',
        fuel_type_id: fuelTypes?.[0]?.id || '',
        design_capacity_liters: 25000,
        max_usable_capacity_liters: 24000,
        low_stock_threshold_liters: 3000,
        loss_tolerance_pct: 0.5,
        opening_stock_liters: 0,
      });
    }
  }, [tank, branches, fuelTypes, reset]);

  const onSubmit = async (data: TankInput) => {
    try {
      if (isEdit && tank) {
        await updateMutation.mutateAsync({
          id: tank.id,
          input: data,
        });
        toast.success('Cập nhật bể chứa thành công');
      } else {
        await createMutation.mutateAsync(data);
        toast.success('Khai báo bể chứa thành công');
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
          <DialogTitle>{isEdit ? 'Chỉnh sửa Thông số Bể Chứa' : 'Khai báo Bể Chứa Nhiên Liệu Mới'}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? 'Cập nhật định mức dung tích, dung sai và ngưỡng cảnh báo tồn thấp'
              : 'Khai báo bể chứa mới và thiết lập số dư tồn đầu kỳ (tính theo Lít)'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="contents">
          <DialogBody className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="code">Mã bể chứa *</Label>
                <Input id="code" placeholder="VD: BE-01, TK-DO01" disabled={isEdit} {...register('code')} />
                {errors.code && <p className="text-xs text-destructive">{errors.code.message}</p>}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="name">Tên bể chứa *</Label>
                <Input id="name" placeholder="VD: Bể Dầu DO 01" {...register('name')} />
                {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="branch_id">Thuộc Trạm xăng *</Label>
                <OptionSelect
                  id="branch_id"
                  disabled={isEdit}
                  emptyLabel="Chọn trạm xăng"
                  value={watch('branch_id') ?? ''}
                  onChange={(next) => setValue('branch_id', next, { shouldValidate: true })}
                  options={branches.map((b) => ({ value: b.id, label: `${b.name} (${b.code})` }))}
                />
                {errors.branch_id && <p className="text-xs text-destructive">{errors.branch_id.message}</p>}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="fuel_type_id">Loại nhiên liệu *</Label>
                <OptionSelect
                  id="fuel_type_id"
                  emptyLabel="Chọn nhiên liệu"
                  value={watch('fuel_type_id') ?? ''}
                  onChange={(next) => setValue('fuel_type_id', next, { shouldValidate: true })}
                  options={(fuelTypes ?? []).map((ft) => ({ value: ft.id, label: `${ft.name} (${ft.code})` }))}
                />
                {errors.fuel_type_id && <p className="text-xs text-destructive">{errors.fuel_type_id.message}</p>}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="design_capacity_liters">Dung tích thiết kế (Lít) *</Label>
                <Input
                  id="design_capacity_liters"
                  type="number"
                  placeholder="VD: 25000"
                  {...register('design_capacity_liters')}
                />
                {errors.design_capacity_liters && (
                  <p className="text-xs text-destructive">{errors.design_capacity_liters.message}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="max_usable_capacity_liters">Khả dụng tối đa (Lít) *</Label>
                <Input
                  id="max_usable_capacity_liters"
                  type="number"
                  placeholder="VD: 24000"
                  {...register('max_usable_capacity_liters')}
                />
                {errors.max_usable_capacity_liters && (
                  <p className="text-xs text-destructive">{errors.max_usable_capacity_liters.message}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="low_stock_threshold_liters">Ngưỡng cảnh báo tồn (Lít) *</Label>
                <Input
                  id="low_stock_threshold_liters"
                  type="number"
                  placeholder="VD: 3000"
                  {...register('low_stock_threshold_liters')}
                />
                {errors.low_stock_threshold_liters && (
                  <p className="text-xs text-destructive">{errors.low_stock_threshold_liters.message}</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="loss_tolerance_pct">Tỷ lệ hao hụt cho phép (%) *</Label>
                <Input
                  id="loss_tolerance_pct"
                  type="number"
                  step="0.01"
                  placeholder="VD: 0.5"
                  {...register('loss_tolerance_pct')}
                />
                {errors.loss_tolerance_pct && (
                  <p className="text-xs text-destructive">{errors.loss_tolerance_pct.message}</p>
                )}
              </div>

              {!isEdit && (
                <div className="space-y-1.5">
                  <Label htmlFor="opening_stock_liters">Tồn đầu kỳ khởi tạo (Lít)</Label>
                  <Input
                    id="opening_stock_liters"
                    type="number"
                    placeholder="VD: 15000"
                    {...register('opening_stock_liters')}
                  />
                  <p className="text-[11px] text-muted-foreground">Tự động ghi sổ thẻ kho bản ghi đầu tiên</p>
                </div>
              )}
            </div>
          </DialogBody>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Hủy
            </Button>
            <Button type="submit" disabled={isSubmitting || createMutation.isPending || updateMutation.isPending}>
              {isEdit ? 'Lưu thay đổi' : 'Khai báo bể'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
