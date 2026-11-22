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
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { StockReceipt } from '../types';
import { useApproveReceipt } from '../api/approve-receipt';
import { formatNumberVN, formatDateTimeVN } from '@/lib/format';
import { CheckCircle2Icon, XCircleIcon, ShieldAlertIcon } from 'lucide-react';
import { toast } from 'sonner';
import { showApiError } from '@/lib/api-error';

interface ReceiptApproveDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  receipt: StockReceipt | null;
}

export function ReceiptApproveDialog({
  open,
  onOpenChange,
  receipt,
}: ReceiptApproveDialogProps) {
  const [rejectReason, setRejectReason] = React.useState('');
  const [mode, setMode] = React.useState<'approve' | 'reject'>('approve');
  const [submitting, setSubmitting] = React.useState(false);

  const approveMutation = useApproveReceipt();

  React.useEffect(() => {
    if (open) {
      setRejectReason('');
      setMode('approve');
    }
  }, [open]);

  if (!receipt) return null;

  const handleAction = async () => {
    const isApproved = mode === 'approve';
    if (!isApproved && !rejectReason.trim()) {
      toast.error('Vui lòng nhập lý do từ chối phiếu nhập');
      return;
    }

    setSubmitting(true);
    try {
      await approveMutation.mutateAsync({
        id: receipt.id,
        data: {
          approved: isApproved,
          reject_reason: isApproved ? undefined : rejectReason.trim(),
        },
      });

      if (isApproved) {
        toast.success(`Đã duyệt thành công phiếu nhập ${receipt.code}`);
      } else {
        toast.info(`Đã từ chối phiếu nhập ${receipt.code}`);
      }
      onOpenChange(false);
    } catch (err: any) {
      showApiError(err, 'Có lỗi xảy ra khi phê duyệt');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>Phê duyệt phiếu nhập bể {receipt.code}</DialogTitle>
          <DialogDescription>
            Quy trình phê duyệt kép (Two-Person Rule): Người duyệt ghi nhận nhập kho vào Sổ thẻ kho (Stock Ledger).
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="space-y-4">
          {/* Summary Box */}
          <div className="border rounded-lg p-4 bg-muted/30 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Trạm xăng:</span>
              <span className="font-semibold">{receipt.branch_name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Ngày nhập hàng:</span>
              <span className="tabular-nums">{formatDateTimeVN(receipt.received_at)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Người lập phiếu:</span>
              <span className="font-medium text-foreground">
                {receipt.created_by_name || receipt.created_by}
              </span>
            </div>
            <div className="flex justify-between border-t pt-2">
              <span className="text-muted-foreground font-medium">Tổng thực nhập:</span>
              <span className="font-bold text-primary tabular-nums text-base">
                {formatNumberVN(receipt.total_volume_ml / 1000)} Lít
              </span>
            </div>
          </div>

          {/* Two-person rule notice */}
          <div className="flex items-start gap-2.5 p-3 rounded-md bg-amber-500/10 border border-amber-500/20 text-xs text-amber-800">
            <ShieldAlertIcon className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
            <div>
              <p className="font-semibold text-amber-900">Kiểm soát kép (Two-Person Rule)</p>
              <p>
                Người duyệt bắt buộc phải là tài khoản khác với người lập phiếu ({receipt.created_by_name || receipt.created_by}).
              </p>
            </div>
          </div>

          {/* Action Choice */}
          <div className="space-y-2 pt-2">
            <Label className="text-sm font-semibold">Quyết định phê duyệt *</Label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setMode('approve')}
                className={`flex items-center justify-center gap-2 p-3 rounded-lg border text-sm font-medium transition-colors ${
                  mode === 'approve'
                    ? 'border-emerald-500 bg-emerald-50 text-emerald-800 font-semibold ring-2 ring-emerald-500/20'
                    : 'border-input hover:bg-muted/50 text-muted-foreground'
                }`}
              >
                <CheckCircle2Icon className="w-4 h-4 text-emerald-600" />
                Duyệt nhập kho
              </button>

              <button
                type="button"
                onClick={() => setMode('reject')}
                className={`flex items-center justify-center gap-2 p-3 rounded-lg border text-sm font-medium transition-colors ${
                  mode === 'reject'
                    ? 'border-destructive bg-destructive/10 text-destructive font-semibold ring-2 ring-destructive/20'
                    : 'border-input hover:bg-muted/50 text-muted-foreground'
                }`}
              >
                <XCircleIcon className="w-4 h-4 text-destructive" />
                Từ chối phiếu
              </button>
            </div>
          </div>

          {/* Reason Input when rejecting */}
          {mode === 'reject' && (
            <div className="space-y-1.5 pt-2">
              <Label htmlFor="reject_reason" className="text-sm font-semibold text-destructive">
                Lý do từ chối *
              </Label>
              <Textarea
                id="reject_reason"
                placeholder="Nhập lý do không phê duyệt phiếu nhập này..."
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                rows={3}
                required
              />
            </div>
          )}
        </DialogBody>

        <DialogFooter className="border-t p-4 bg-muted/50">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            Đóng
          </Button>
          <Button
            type="button"
            variant={mode === 'approve' ? 'default' : 'destructive'}
            onClick={handleAction}
            disabled={submitting}
          >
            {submitting
              ? 'Đang xử lý...'
              : mode === 'approve'
              ? 'Xác nhận duyệt'
              : 'Xác nhận từ chối'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
