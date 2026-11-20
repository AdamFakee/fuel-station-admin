'use client';

import * as React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
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
import { useCreateDriver } from '../api/create-driver';
import { useUpdateDriver } from '../api/update-driver';
import { CatalogsSummary, DriverListItem } from '../types';

interface DriverDialogFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  catalogs?: CatalogsSummary;
  driver?: DriverListItem | null;
}

export function DriverDialogForm({
  open,
  onOpenChange,
  catalogs,
  driver,
}: DriverDialogFormProps) {
  const isEdit = !!driver;
  const createDriver = useCreateDriver();
  const updateDriver = useUpdateDriver();

  const [code, setCode] = React.useState('');
  const [fullName, setFullName] = React.useState('');
  const [phone, setPhone] = React.useState('');
  const [department, setDepartment] = React.useState('');
  const [cardNumber, setCardNumber] = React.useState('');
  const [note, setNote] = React.useState('');
  const [errors, setErrors] = React.useState<Record<string, string>>({});

  React.useEffect(() => {
    if (driver) {
      setCode(driver.code);
      setFullName(driver.full_name);
      setPhone(driver.phone || '');
      setDepartment(driver.department || '');
      setCardNumber(driver.card_number || '');
      setNote(driver.note || '');
    } else {
      setCode('');
      setFullName('');
      setPhone('');
      setDepartment('');
      setCardNumber('');
      setNote('');
    }
    setErrors({});
  }, [driver, catalogs, open]);

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!isEdit) {
      if (!code.trim()) {
        errs.code = 'Vui lòng nhập mã nhân viên';
      } else if (!/^[A-Za-z0-9]{1,32}$/.test(code.trim())) {
        errs.code = 'Mã nhân viên phải gồm 1-32 ký tự chữ và số (khớp máy chấm công)';
      }
    }
    if (!fullName.trim()) {
      errs.fullName = 'Vui lòng nhập họ và tên';
    }
    if (cardNumber.trim() && !/^[0-9]{1,32}$/.test(cardNumber.trim())) {
      errs.cardNumber = 'Số thẻ NFC phải là chuỗi chữ số thập phân';
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    if (isEdit && driver) {
      updateDriver.mutate(
        {
          id: driver.id,
          data: {
            full_name: fullName.trim(),
            phone: phone.trim() || undefined,
            department: department.trim() || undefined,
            note: note.trim() || undefined,
          },
        },
        {
          onSuccess: () => onOpenChange(false),
        }
      );
    } else {
      createDriver.mutate(
        {
          code: code.trim().toUpperCase(),
          full_name: fullName.trim(),
          phone: phone.trim() || undefined,
          department: department.trim() || undefined,
          card_number: cardNumber.trim() || undefined,
          note: note.trim() || undefined,
        },
        {
          onSuccess: () => onOpenChange(false),
        }
      );
    }
  };

  const isPending = createDriver.isPending || updateDriver.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? `Cập nhật hồ sơ tài xế: ${driver?.code}` : 'Thêm tài xế / nhân viên mới'}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? 'Chỉnh sửa thông tin hành chính, số điện thoại và phòng ban làm việc.'
              : 'Đăng ký hồ sơ nhân viên vận hành hoặc tài xế. Mã nhân viên tương ứng với employeeNo trên máy chấm công Hikvision.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-4">
            {/* Mã NV */}
            <div className="space-y-1.5">
              <Label htmlFor="driver-code">Mã nhân viên (employeeNo) <span className="text-destructive">*</span></Label>
              <Input
                id="driver-code"
                placeholder="VD: TX001"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                disabled={isEdit}
                className={errors.code ? 'border-destructive' : ''}
                data-testid="input-driver-code"
              />
              {errors.code && <p className="text-xs text-destructive">{errors.code}</p>}
            </div>

            {/* Họ và tên */}
            <div className="space-y-1.5">
              <Label htmlFor="driver-name">Họ và tên <span className="text-destructive">*</span></Label>
              <Input
                id="driver-name"
                placeholder="VD: Nguyễn Văn Lái"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className={errors.fullName ? 'border-destructive' : ''}
                data-testid="input-driver-name"
              />
              {errors.fullName && <p className="text-xs text-destructive">{errors.fullName}</p>}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Số điện thoại */}
            <div className="space-y-1.5">
              <Label htmlFor="driver-phone">Số điện thoại</Label>
              <Input
                id="driver-phone"
                placeholder="VD: 0912345678"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                data-testid="input-driver-phone"
              />
            </div>

          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Phòng ban / Đội xe */}
            <div className="space-y-1.5">
              <Label htmlFor="driver-dept">Phòng ban / Đội xe</Label>
              <Input
                id="driver-dept"
                placeholder="VD: Đội xe 1"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                data-testid="input-driver-dept"
              />
            </div>
          </div>

          {/* Thẻ NFC ban đầu (khi tạo mới) */}
          {!isEdit && (
            <div className="space-y-1.5">
              <Label htmlFor="driver-card">Số thẻ NFC ban đầu (tùy chọn)</Label>
              <Input
                id="driver-card"
                placeholder="VD: 2001234567"
                value={cardNumber}
                onChange={(e) => setCardNumber(e.target.value)}
                className={errors.cardNumber ? 'border-destructive' : ''}
                data-testid="input-driver-card"
              />
              {errors.cardNumber && <p className="text-xs text-destructive">{errors.cardNumber}</p>}
            </div>
          )}

          {/* Ghi chú */}
          <div className="space-y-1.5">
            <Label htmlFor="driver-note">Ghi chú</Label>
            <Textarea
              id="driver-note"
              rows={2}
              placeholder="Thông tin bằng lái, lưu ý vận hành..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
              data-testid="input-driver-note"
            />
          </div>

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Hủy bỏ
            </Button>
            <Button type="submit" disabled={isPending} data-testid="submit-driver-btn">
              {isPending ? 'Đang lưu...' : isEdit ? 'Lưu thay đổi' : 'Thêm tài xế'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
