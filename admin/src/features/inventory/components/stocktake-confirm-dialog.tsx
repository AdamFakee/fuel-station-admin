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
import { Checkbox } from '@/components/ui/checkbox';
import { StockReconciliationItem } from '../types';
import { useConfirmReconciliation } from '../api/confirm-reconciliation';
import { formatNumberVN } from '@/lib/format';
import { toast } from 'sonner';
import { ShieldCheckIcon, AlertTriangleIcon } from 'lucide-react';

interface StocktakeConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reconciliation: StockReconciliationItem | null;
}

export function StocktakeConfirmDialog({
  open,
  onOpenChange,
  reconciliation,
}: StocktakeConfirmDialogProps) {
  const [adjustLedger, setAdjustLedger] = React.useState<boolean>(true);
  const [note, setNote] = React.useState<string>('');

  const confirmMutation = useConfirmReconciliation();

  React.useEffect(() => {
    if (open) {
      setAdjustLedger(true);
      setNote('');
    }
  }, [open]);

  if (!reconciliation) return null;

  const isAlert = reconciliation.status === 'alert';
  const varianceLiters = reconciliation.variance_liters ?? 0;
  const variancePct = reconciliation.variance_pct ?? 0;

  const handleConfirm = async () => {
    try {
      await confirmMutation.mutateAsync({
        id: reconciliation.id,
        data: {
          adjust_ledger: adjustLedger,
          note: note.trim() || undefined,
        },
      });
      toast.success('Đã xác nhận kết quả kiểm kê thành công');
      onOpenChange(false);
    } catch (err: unknown) {
      const errorMsg =
        err instanceof Error
          ? err.message
          : 'Có lỗi xảy ra khi xác nhận (lưu ý: người đo không được tự phê duyệt)';
      toast.error(errorMsg);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <ShieldCheckIcon className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-xl">
                Xác nhận kết quả đối soát kiểm kê
              </DialogTitle>
              <DialogDescription>
                Phê duyệt số liệu chênh lệch và quyết định điều chỉnh số dư thẻ kho
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <DialogBody>
          <div className="space-y-4 py-2">
            {/* Thẻ thông tin bể và chênh lệch */}
            <div className="border rounded-lg p-3.5 bg-muted/40 space-y-3">
              <div className="flex justify-between items-center text-sm border-b pb-2">
                <span className="text-muted-foreground">Bể chứa:</span>
                <span className="font-semibold">{reconciliation.tank_name}</span>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-xs text-muted-foreground block">Tồn cuối sổ sách:</span>
                  <span className="font-medium tabular-nums">{formatNumberVN(reconciliation.book_closing_liters)} L</span>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground block">Thực đo que thăm:</span>
                  <span className="font-medium tabular-nums">
                    {reconciliation.measured_liters !== undefined && reconciliation.measured_liters !== null
                      ? `${formatNumberVN(reconciliation.measured_liters)} L`
                      : '-'}
                  </span>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground block">Chênh lệch tuyệt đối:</span>
                  <span className={`font-semibold tabular-nums ${varianceLiters < 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                    {varianceLiters > 0 ? '+' : ''}{formatNumberVN(varianceLiters)} L
                  </span>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground block">Tỉ lệ chênh lệch:</span>
                  <span className={`font-semibold tabular-nums ${isAlert ? 'text-rose-600' : 'text-emerald-600'}`}>
                    {variancePct > 0 ? '+' : ''}{variancePct.toFixed(2)}% (ngưỡng ±{reconciliation.tolerance_pct}%)
                  </span>
                </div>
              </div>
            </div>

            {/* Cảnh báo hao hụt nếu vượt ngưỡng */}
            {isAlert && (
              <div className="p-3 rounded-lg border border-rose-200 bg-rose-50/70 text-rose-900 dark:bg-rose-950/30 dark:border-rose-800 dark:text-rose-300 flex items-start gap-2.5 text-xs">
                <AlertTriangleIcon className="h-4 w-4 shrink-0 text-rose-600 mt-0.5" />
                <div>
                  <span className="font-bold">Lưu ý hao hụt vượt ngưỡng cho phép:</span> Phiếu này đang ở trạng thái cảnh báo lệch ngưỡng. Việc xác nhận kiểm kê cần có giải trình thỏa đáng từ thủ kho/kế toán.
                </div>
              </div>
            )}

            {/* Checkbox ghi nhận bút toán adjust */}
            <div className="flex items-start space-x-3 p-3 rounded-lg border bg-background">
              <Checkbox
                id="adjust_ledger"
                checked={adjustLedger}
                onCheckedChange={(checked) => setAdjustLedger(!!checked)}
                className="mt-0.5"
              />
              <div className="space-y-1">
                <Label htmlFor="adjust_ledger" className="text-sm font-semibold cursor-pointer">
                  Ghi bút toán điều chỉnh (adjust) vào thẻ kho
                </Label>
                <p className="text-xs text-muted-foreground">
                  Nếu chọn, hệ thống sẽ tự động tạo một dòng thẻ kho với lượng biến động{' '}
                  <span className="font-semibold text-foreground">
                    {varianceLiters > 0 ? '+' : ''}{formatNumberVN(varianceLiters)} L
                  </span>{' '}
                  để cân bằng số dư tồn kho sổ sách về bằng đúng số đo thực tế.
                </p>
              </div>
            </div>

            {/* Ghi chú kế toán */}
            <div className="space-y-2">
              <Label htmlFor="confirm_note">Ghi chú xác nhận của Kế toán</Label>
              <Textarea
                id="confirm_note"
                rows={2}
                placeholder="Ý kiến phê duyệt, số quyết định xử lý hao hụt nếu có..."
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </div>
          </div>
        </DialogBody>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={confirmMutation.isPending}
          >
            Hủy
          </Button>
          <Button
            type="button"
            onClick={handleConfirm}
            disabled={confirmMutation.isPending}
            className="bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            {confirmMutation.isPending ? 'Đang xác nhận...' : 'Phê duyệt & Chốt kiểm kê'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
