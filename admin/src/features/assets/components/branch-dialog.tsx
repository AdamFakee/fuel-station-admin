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
import { Branch, BranchInput, branchSchema } from '../types';
import { useCreateBranch } from '../api/create-branch';
import { useUpdateBranch } from '../api/update-branch';
import { toast } from 'sonner';

interface BranchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  branch?: Branch | null;
}

export function BranchDialog({ open, onOpenChange, branch }: BranchDialogProps) {
  const isEdit = !!branch;
  const createMutation = useCreateBranch();
  const updateMutation = useUpdateBranch();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<BranchInput>({
    resolver: zodResolver(branchSchema),
    defaultValues: {
      code: '',
      name: '',
      address: '',
      manager_name: '',
      phone: '',
    },
  });

  React.useEffect(() => {
    if (branch) {
      reset({
        code: branch.code,
        name: branch.name,
        address: branch.address || '',
        manager_name: branch.manager_name || '',
        phone: branch.phone || '',
      });
    } else {
      reset({
        code: '',
        name: '',
        address: '',
        manager_name: '',
        phone: '',
      });
    }
  }, [branch, reset]);

  const onSubmit = async (data: BranchInput) => {
    try {
      if (isEdit && branch) {
        await updateMutation.mutateAsync({
          id: branch.id,
          input: data,
        });
        toast.success('Cập nhật chi nhánh thành công');
      } else {
        await createMutation.mutateAsync(data);
        toast.success('Thêm chi nhánh thành công');
      }
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Có lỗi xảy ra, vui lòng thử lại');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Chỉnh sửa Nhà máy / Chi nhánh' : 'Khai báo Nhà máy / Chi nhánh mới'}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? 'Cập nhật thông tin chi nhánh vận hành trạm xăng dầu'
              : 'Thêm mới chi nhánh vào hệ thống quản lý'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="contents">
          <DialogBody className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="code">Mã chi nhánh *</Label>
              <Input
                id="code"
                placeholder="VD: CN-01, TRAM-HN"
                disabled={isEdit}
                {...register('code')}
              />
              {errors.code && <p className="text-xs text-destructive">{errors.code.message}</p>}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="name">Tên chi nhánh *</Label>
              <Input id="name" placeholder="VD: Trạm Xăng Dầu Số 1" {...register('name')} />
              {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="address">Địa chỉ</Label>
              <Input id="address" placeholder="VD: 123 Đường Giải Phóng, Hà Nội" {...register('address')} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="manager_name">Người quản lý</Label>
                <Input id="manager_name" placeholder="VD: Nguyễn Văn A" {...register('manager_name')} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="phone">Số điện thoại</Label>
                <Input id="phone" placeholder="VD: 0901234567" {...register('phone')} />
              </div>
            </div>
          </DialogBody>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Hủy
            </Button>
            <Button type="submit" disabled={isSubmitting || createMutation.isPending || updateMutation.isPending}>
              {isEdit ? 'Lưu thay đổi' : 'Tạo chi nhánh'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
