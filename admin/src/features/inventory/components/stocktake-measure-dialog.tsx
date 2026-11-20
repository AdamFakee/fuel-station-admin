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
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { StockReconciliationItem } from '../types';
import { useSubmitMeasuredStock } from '../api/submit-measured-stock';
import { formatNumberVN } from '@/lib/format';
import { toast } from 'sonner';
import { RulerIcon, AlertTriangleIcon, CheckCircle2Icon } from 'lucide-react';

interface StocktakeMeasureDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reconciliation: StockReconciliationItem | null;
}

export function StocktakeMeasureDialog({
  open,
  onOpenChange,
  reconciliation,
}: StocktakeMeasureDialogProps) {
  const [measuredLiters, setMeasuredLiters] = React.useState<string>('');
  const [pumpTotalizerLiters, setPumpTotalizerLiters] = React.useState<string>('');
  const [note, setNote] = React.useState<string>('');

  const submitMutation = useSubmitMeasuredStock();

  React.useEffect(() => {
    if (reconciliation) {
      setMeasuredLiters(
        reconciliation.measured_liters !== undefined && reconciliation.measured_liters !== null
          ? String(reconciliation.measured_liters)
          : ''
      );
      setPumpTotalizerLiters(
        reconciliation.pump_totalizer_liters !== undefined &&
          reconciliation.pump_totalizer_liters !== null
          ? String(reconciliation.pump_totalizer_liters)
          : ''
      );
      setNote(reconciliation.note || '');
    }
  }, [reconciliation, open]);

  if (!reconciliation) return null;

  const bookClosing = reconciliation.book_closing_liters;
  const numMeasured = parseFloat(measuredLiters) || 0;
  const numTotalizer = parseFloat(pumpTotalizerLiters) || 0;

  // Tính chênh lệch thời gian thực
  const hasInput = measuredLiters.trim() !== '' && !isNaN(numMeasured);
  const varianceLiters = hasInput ? numMeasured - bookClosing : 0;
  const variancePct = hasInput && bookClosing > 0 ? (varianceLiters / bookClosing) * 100 : 0;
  const absVariancePct = Math.abs(variancePct);
  const isWithinTolerance = absVariancePct <= reconciliation.tolerance_pct;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hasInput || numMeasured < 0) {
      toast.error('Vui lòng nhập số đo que thăm / cảm biến hợp lệ (>= 0 Lít)');
      return;
    }

    try {
      await submitMutation.mutateAsync({
        id: reconciliation.id,
        data: {
          measured_liters: numMeasured,
          pump_totalizer_liters: numTotalizer > 0 ? numTotalizer : undefined,
          note: note.trim() || undefined,
        },
      });
      toast.success('Đã cập nhật số đo thực tế và tính toán chênh lệch thành công');
      onOpenChange(false);
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Có lỗi xảy ra khi lưu số đo';
      toast.error(errorMsg);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10 text-primary">
                <RulerIcon className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-xl">
                  Nhập số đo kiểm kê thực tế
                </DialogTitle>
                <DialogDescription>
                  Bể chứa: <span className="font-semibold text-foreground">{reconciliation.tank_name}</span> • Ngày đối chiếu: {reconciliation.period_date}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <DialogBody>
            <div className="space-y-4 py-2">
              {/* Box tóm tắt sổ sách */}
              <div className="p-3 bg-muted/60 rounded-lg border text-sm space-y-2">
                <div className="flex justify-between items-center text-xs text-muted-foreground font-medium">
                  <span>SỔ SÁCH HỆ THỐNG GHI NHẬN</span>
                  <span>Ngưỡng sai số: ±{reconciliation.tolerance_pct}%</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                  <div>
                    <span className="text-xs text-muted-foreground block">Đầu kỳ:</span>
                    <span className="font-semibold tabular-nums">{formatNumberVN(reconciliation.opening_liters)} L</span>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground block">Nhập trong kỳ:</span>
                    <span className="font-semibold tabular-nums text-emerald-600">+{formatNumberVN(reconciliation.receipts_liters)} L</span>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground block">Xuất bơm:</span>
                    <span className="font-semibold tabular-nums text-amber-600">-{formatNumberVN(reconciliation.dispensed_liters)} L</span>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground block">Tồn cuối sổ:</span>
                    <span className="font-bold tabular-nums text-primary text-base">{formatNumberVN(bookClosing)} L</span>
                  </div>
                </div>
              </div>

              {/* Input số đo thực tế */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="measured_liters" className="text-sm font-semibold">
                    Số đo thực tế (que thăm / cảm biến) (Lít) <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="measured_liters"
                    type="number"
                    step="0.001"
                    min="0"
                    placeholder="VD: 12500"
                    value={measuredLiters}
                    onChange={(e) => setMeasuredLiters(e.target.value)}
                    required
                    className="font-mono text-base"
                  />
                  <p className="text-xs text-muted-foreground">
                    Thể tích thực tế đo được tại bể ở nhiệt độ hiện hành.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="pump_totalizer_liters" className="text-sm font-semibold">
                    Chỉ số cơ đồng hồ tổng cột bơm (Lít)
                  </Label>
                  <Input
                    id="pump_totalizer_liters"
                    type="number"
                    step="0.001"
                    min="0"
                    placeholder="VD: 45890.5"
                    value={pumpTotalizerLiters}
                    onChange={(e) => setPumpTotalizerLiters(e.target.value)}
                    className="font-mono text-base"
                  />
                  <p className="text-xs text-muted-foreground">
                    Tổng số cộng dồn đồng hồ cột bơm để đối soát (tùy chọn).
                  </p>
                </div>
              </div>

              {/* Preview chênh lệch tự động */}
              {hasInput && (
                <div
                  className={`p-3.5 rounded-lg border flex items-center justify-between transition-colors ${
                    isWithinTolerance
                      ? 'bg-emerald-50/70 border-emerald-200 text-emerald-900 dark:bg-emerald-950/30 dark:border-emerald-800 dark:text-emerald-300'
                      : 'bg-rose-50/70 border-rose-200 text-rose-900 dark:bg-rose-950/30 dark:border-rose-800 dark:text-rose-300'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {isWithinTolerance ? (
                      <CheckCircle2Icon className="h-5 w-5 text-emerald-600 shrink-0" />
                    ) : (
                      <AlertTriangleIcon className="h-5 w-5 text-rose-600 shrink-0" />
                    )}
                    <div>
                      <div className="font-semibold text-sm">
                        {isWithinTolerance
                          ? 'Sai số nằm trong ngưỡng cho phép (Khớp sổ)'
                          : 'CẢNH BÁO: Vượt ngưỡng sai số cho phép!'}
                      </div>
                      <div className="text-xs opacity-90">
                        Chênh lệch: <span className="font-bold tabular-nums">{varianceLiters > 0 ? '+' : ''}{formatNumberVN(varianceLiters)} L</span> ({variancePct > 0 ? '+' : ''}{variancePct.toFixed(2)}%)
                      </div>
                    </div>
                  </div>
                  <Badge variant={isWithinTolerance ? 'default' : 'destructive'} className="shrink-0">
                    {isWithinTolerance ? 'matched' : 'alert'}
                  </Badge>
                </div>
              )}

              {/* Ghi chú */}
              <div className="space-y-2">
                <Label htmlFor="stocktake_note">Ghi chú kiểm kê / Lý do chênh lệch</Label>
                <Textarea
                  id="stocktake_note"
                  rows={2}
                  placeholder="Ghi rõ điều kiện đo, thời tiết, hoặc nghi vấn nguyên nhân chênh lệch nếu có..."
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
              disabled={submitMutation.isPending}
            >
              Hủy
            </Button>
            <Button type="submit" disabled={submitMutation.isPending}>
              {submitMutation.isPending ? 'Đang lưu...' : 'Lưu kết quả đo'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
