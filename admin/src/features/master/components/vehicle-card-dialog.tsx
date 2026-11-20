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
import { Badge } from '@/components/ui/badge';
import { CreditCardIcon } from '@heroicons/react/24/outline';
import { VehicleListItem } from '../types';
import { useAssignVehicleCard } from '../api/assign-vehicle-card';
import { useRevokeVehicleCard } from '../api/revoke-vehicle-card';

interface VehicleCardDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vehicle?: VehicleListItem | null;
}

export function VehicleCardDialog({
  open,
  onOpenChange,
  vehicle,
}: VehicleCardDialogProps) {
  const assignCard = useAssignVehicleCard();
  const revokeCard = useRevokeVehicleCard();

  const [cardNumber, setCardNumber] = React.useState('');
  const [error, setError] = React.useState('');

  React.useEffect(() => {
    setCardNumber(vehicle?.card_number || '');
    setError('');
  }, [vehicle, open]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!vehicle) return;

    const trimmed = cardNumber.trim();
    if (!trimmed) {
      setError('Vui lòng nhập số thẻ NFC');
      return;
    }
    if (!/^[0-9]{1,32}$/.test(trimmed)) {
      setError('Số thẻ NFC phải là chuỗi chữ số thập phân (VD: 1001234567)');
      return;
    }

    assignCard.mutate(
      { id: vehicle.id, cardNumber: trimmed },
      { onSuccess: () => onOpenChange(false) }
    );
  };

  const handleRevoke = () => {
    if (!vehicle) return;
    revokeCard.mutate(vehicle.id, {
      onSuccess: () => onOpenChange(false),
    });
  };

  const isPending = assignCard.isPending || revokeCard.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CreditCardIcon className="h-5 w-5 text-primary" />
            Quản lý thẻ NFC xe: {vehicle?.plate}
          </DialogTitle>
          <DialogDescription>
            Định danh thẻ NFC gắn trên phương tiện dùng để quẹt thẻ tại trụ bơm trước khi kích hoạt quy trình xác thực kép.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          {vehicle?.card_number && (
            <div className="rounded-md border border-border bg-muted/40 p-3 flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Thẻ NFC hiện tại:</p>
                <Badge variant="outline" className="font-mono text-xs font-semibold text-emerald-600 mt-1">
                  {vehicle.card_number}
                </Badge>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="text-xs text-destructive hover:bg-destructive/10"
                onClick={handleRevoke}
                disabled={isPending}
                data-testid="revoke-card-btn"
              >
                Thu hồi thẻ
              </Button>
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="input-card-number">
              {vehicle?.card_number ? 'Đổi sang số thẻ NFC mới' : 'Số thẻ NFC (Dạng thập phân)'}
            </Label>
            <Input
              id="input-card-number"
              placeholder="VD: 3862658937"
              value={cardNumber}
              onChange={(e) => {
                setCardNumber(e.target.value);
                setError('');
              }}
              className={error ? 'border-destructive' : ''}
              data-testid="input-card-number"
            />
            {error ? (
              <p className="text-xs text-destructive">{error}</p>
            ) : (
              <p className="text-xs text-muted-foreground">
                Lưu ý: Nhập đúng định dạng thập phân mà đầu đọc NFC trả về (VD: 3862658937).
              </p>
            )}
          </div>

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Hủy
            </Button>
            <Button type="submit" disabled={isPending} data-testid="submit-card-btn">
              {isPending ? 'Đang lưu...' : 'Lưu thẻ NFC'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
