'use client';

import * as React from 'react';
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
import {
  ExclamationTriangleIcon,
  ShieldExclamationIcon,
  InformationCircleIcon,
} from '@heroicons/react/24/outline';
import { cn } from '@/lib/utils';

export type ConfirmLevel = 'info' | 'destructive' | 'security' | 'money';

export interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  level: ConfirmLevel;
  title: string;
  description?: string;
  consequences?: string[];
  confirmText?: string;
  cancelText?: string;
  requireType?: string; // Default is "OK" for security and money
  loading?: boolean;
  onConfirm: () => void;
}

export function ConfirmDialog({
  open,
  onOpenChange,
  level,
  title,
  description,
  consequences,
  confirmText = 'Xác nhận',
  cancelText = 'Hủy',
  requireType = 'OK',
  loading = false,
  onConfirm,
}: ConfirmDialogProps) {
  const [typedValue, setTypedValue] = React.useState('');

  const isTypedRequired = level === 'security' || level === 'money';
  const isMatch = !isTypedRequired || typedValue.trim().toUpperCase() === requireType.trim().toUpperCase();

  React.useEffect(() => {
    if (!open) {
      setTypedValue('');
    }
  }, [open]);

  const handleConfirm = () => {
    if (isMatch && !loading) {
      onConfirm();
    }
  };

  const iconMap = {
    info: <InformationCircleIcon className="h-6 w-6 text-blue-500" />,
    destructive: <ExclamationTriangleIcon className="h-6 w-6 text-red-500" />,
    security: <ShieldExclamationIcon className="h-6 w-6 text-amber-500" />,
    money: <ExclamationTriangleIcon className="h-6 w-6 text-red-600" />,
  };

  const buttonVariant =
    level === 'destructive' || level === 'money'
      ? 'destructive'
      : level === 'security'
      ? 'default'
      : 'default';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="sm">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="shrink-0">{iconMap[level]}</div>
            <DialogTitle>{title}</DialogTitle>
          </div>
          {description && <DialogDescription className="mt-1">{description}</DialogDescription>}
        </DialogHeader>

        <DialogBody className="space-y-4">
          {consequences && consequences.length > 0 && (
            <div className="rounded-md bg-muted/60 p-3 text-xs text-muted-foreground space-y-1">
              <span className="font-semibold text-foreground block">Hậu quả có thể xảy ra:</span>
              <ul className="list-disc list-inside space-y-0.5">
                {consequences.map((c, i) => (
                  <li key={i}>{c}</li>
                ))}
              </ul>
            </div>
          )}

          {isTypedRequired && (
            <div className="space-y-2 pt-1">
              <Label htmlFor="confirm-typed" className="text-xs text-muted-foreground">
                Để xác nhận, vui lòng gõ <span className="font-bold text-foreground font-mono">{requireType}</span> vào ô bên dưới:
              </Label>
              <Input
                id="confirm-typed"
                value={typedValue}
                onChange={(e) => setTypedValue(e.target.value)}
                placeholder={requireType}
                className="font-mono"
                autoComplete="off"
              />
            </div>
          )}
        </DialogBody>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            {cancelText}
          </Button>
          <Button
            variant={buttonVariant}
            onClick={handleConfirm}
            disabled={!isMatch || loading}
          >
            {loading ? 'Đang xử lý...' : confirmText}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
