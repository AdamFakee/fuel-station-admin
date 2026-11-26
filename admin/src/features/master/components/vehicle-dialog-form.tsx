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
import { useCreateVehicle } from '../api/create-vehicle';
import { useUpdateVehicle } from '../api/update-vehicle';
import { useAssignVehicleCard } from '../api/assign-vehicle-card';
import { useRevokeVehicleCard } from '../api/revoke-vehicle-card';
import { CatalogsSummary, VehicleListItem } from '../types';

interface VehicleDialogFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  catalogs?: CatalogsSummary;
  vehicle?: VehicleListItem | null;
}

/**
 * Thêm hoặc sửa xe, gồm cả thẻ NFC. Giống form tài xế: mọi thay đổi, kể cả gỡ thẻ, chỉ có hiệu lực khi bấm "Lưu thay đổi";
 * trước đó đều hoàn tác được.
 */
export function VehicleDialogForm({
  open,
  onOpenChange,
  catalogs,
  vehicle,
}: VehicleDialogFormProps) {
  const isEdit = !!vehicle;
  const createVehicle = useCreateVehicle();
  const updateVehicle = useUpdateVehicle();
  const assignCard = useAssignVehicleCard();
  const revokeCard = useRevokeVehicleCard();

  const [code, setCode] = React.useState('');
  const [plate, setPlate] = React.useState('');
  const [fuelTypeId, setFuelTypeId] = React.useState('');
  const [vehicleTypeId, setVehicleTypeId] = React.useState('');
  const [cardNumber, setCardNumber] = React.useState('');
  const [note, setNote] = React.useState('');
  const [errors, setErrors] = React.useState<Record<string, string>>({});

  React.useEffect(() => {
    if (vehicle) {
      setCode(vehicle.code);
      setPlate(vehicle.plate);
      setFuelTypeId(vehicle.fuel_type_id);
      setVehicleTypeId(vehicle.vehicle_type_id || 'none');
      setCardNumber(vehicle.card_number || '');
      setNote(vehicle.note || '');
    } else {
      setCode('');
      setPlate('');
      setFuelTypeId('');
      setVehicleTypeId('none');
      setCardNumber('');
      setNote('');
    }
    setErrors({});
  }, [vehicle, open]);

  const originalCard = vehicle?.card_number ?? '';
  // Đang sửa mà ô thẻ để trống (bấm "Gỡ thẻ" hoặc tự xoá số) nghĩa là gỡ thẻ khi lưu
  const willRemoveCard = isEdit && !!originalCard && !cardNumber.trim();

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!plate.trim()) {
      errs.plate = 'Vui lòng nhập biển số xe';
    }
    if (!fuelTypeId) {
      errs.fuelTypeId = 'Vui lòng chọn loại nhiên liệu';
    }
    // Xe mới bắt buộc có thẻ; khi sửa được để trống (gỡ thẻ)
    if (!isEdit && !cardNumber.trim()) {
      errs.cardNumber = 'Vui lòng nhập số thẻ NFC';
    } else if (cardNumber.trim() && !/^[0-9]{1,32}$/.test(cardNumber.trim())) {
      errs.cardNumber = 'Số thẻ NFC phải là chuỗi chữ số thập phân';
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  /** Thay đổi thẻ, gửi sau khi thông tin xe đã lưu. */
  const saveCard = (id: string) => {
    const newCard = cardNumber.trim();
    if (willRemoveCard) revokeCard.mutate(id);
    else if (newCard && newCard !== originalCard) assignCard.mutate({ id, cardNumber: newCard });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    const vTypeId = vehicleTypeId !== 'none' ? vehicleTypeId : undefined;

    if (isEdit && vehicle) {
      updateVehicle.mutate(
        {
          id: vehicle.id,
          data: {
            plate: plate.trim().toUpperCase(),
            vehicle_type_id: vTypeId,
            fuel_type_id: fuelTypeId,
            note: note.trim(),
          },
        },
        {
          onSuccess: () => {
            saveCard(vehicle.id);
            onOpenChange(false);
          },
        }
      );
    } else {
      createVehicle.mutate(
        {
          plate: plate.trim().toUpperCase(),
          vehicle_type_id: vTypeId,
          fuel_type_id: fuelTypeId,
          card_number: cardNumber.trim(),
          note: note.trim(),
        },
        {
          onSuccess: () => onOpenChange(false),
        }
      );
    }
  };

  const isPending = createVehicle.isPending || updateVehicle.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? `Chỉnh sửa phương tiện: ${vehicle?.code}` : 'Khai báo phương tiện mới'}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? 'Cập nhật biển số, loại nhiên liệu, thẻ NFC và thông tin xe. Xe đổ được ở mọi trạm xăng.'
              : 'Thêm phương tiện mới vào hệ thống quản lý trạm. Mã xe do hệ thống tự sinh để đồng bộ xuống máy chấm công.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-4">
            {/* Mã xe: hệ thống tự sinh, chỉ hiển thị khi sửa */}
            {isEdit && (
              <div className="space-y-1.5">
                <Label htmlFor="vehicle-code">Mã xe</Label>
                <Input id="vehicle-code" value={code} disabled data-testid="input-vehicle-code" />
              </div>
            )}

            {/* Biển số xe */}
            <div className="space-y-1.5">
              <Label htmlFor="vehicle-plate">Biển số xe <span className="text-destructive">*</span></Label>
              <Input
                id="vehicle-plate"
                placeholder="VD: 29C-88888"
                value={plate}
                onChange={(e) => setPlate(e.target.value.toUpperCase())}
                className={errors.plate ? 'border-destructive' : ''}
                data-testid="input-vehicle-plate"
              />
              {errors.plate && <p className="text-xs text-destructive">{errors.plate}</p>}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Loại nhiên liệu */}
            <div className="space-y-1.5">
              <Label>Loại nhiên liệu <span className="text-destructive">*</span></Label>
              {/* Bỏ qua chuỗi rỗng Radix tự báo khi mở lại form (xem OptionSelect) */}
              <Select value={fuelTypeId} onValueChange={(next) => next && setFuelTypeId(next)}>
                <SelectTrigger data-testid="select-vehicle-fuel">
                  <SelectValue placeholder="Chọn nhiên liệu" />
                </SelectTrigger>
                <SelectContent>
                  {catalogs?.fuel_types?.map((f) => (
                    <SelectItem key={f.id} value={f.id}>
                      {f.name} ({f.code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.fuelTypeId && <p className="text-xs text-destructive">{errors.fuelTypeId}</p>}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Loại xe */}
            <div className="space-y-1.5">
              <Label>Loại phương tiện</Label>
              <Select value={vehicleTypeId} onValueChange={(next) => next && setVehicleTypeId(next)}>
                <SelectTrigger data-testid="select-vehicle-type">
                  <SelectValue placeholder="Chọn loại xe (tùy chọn)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">-- Không phân loại --</SelectItem>
                  {catalogs?.vehicle_types?.map((vt) => (
                    <SelectItem key={vt.id} value={vt.id}>
                      {vt.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Thẻ NFC: bắt buộc khi tạo; khi sửa nhập số mới để thay, để trống để gỡ */}
          <div className="space-y-1.5">
            <Label htmlFor="vehicle-card">
              Số thẻ NFC {!isEdit && <span className="text-destructive">*</span>}
            </Label>
            <div className="flex items-center gap-2">
              <Input
                id="vehicle-card"
                placeholder="VD: 1001234567"
                value={cardNumber}
                onChange={(e) => setCardNumber(e.target.value)}
                className={errors.cardNumber ? 'border-destructive' : ''}
                data-testid="input-vehicle-card"
              />
              {willRemoveCard ? (
                <Button type="button" variant="ghost" size="sm" onClick={() => setCardNumber(originalCard)}>
                  Hoàn tác
                </Button>
              ) : (
                isEdit &&
                originalCard && (
                  <Button type="button" variant="ghost" size="sm" className="text-destructive" onClick={() => setCardNumber('')}>
                    Gỡ thẻ
                  </Button>
                )
              )}
            </div>
            {willRemoveCard && <p className="text-xs text-destructive">Sẽ gỡ thẻ {originalCard} khi lưu</p>}
            {errors.cardNumber && <p className="text-xs text-destructive">{errors.cardNumber}</p>}
          </div>

          {/* Ghi chú */}
          <div className="space-y-1.5">
            <Label htmlFor="vehicle-note">Ghi chú</Label>
            <Textarea
              id="vehicle-note"
              rows={2}
              placeholder="Thông tin thêm về phương tiện..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
              data-testid="input-vehicle-note"
            />
          </div>

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Hủy bỏ
            </Button>
            <Button type="submit" disabled={isPending} data-testid="submit-vehicle-btn">
              {isPending ? 'Đang lưu...' : isEdit ? 'Lưu thay đổi' : 'Tạo phương tiện'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
