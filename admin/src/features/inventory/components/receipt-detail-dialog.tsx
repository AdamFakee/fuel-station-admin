'use client';

import { useFullReceipt } from '../api/get-receipt';
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
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { StockReceipt, ReceiptStatus } from '../types';
import { formatDateTimeVN, formatNumberVN } from '@/lib/format';
import { ShieldCheckIcon, UserCheckIcon, XCircleIcon } from 'lucide-react';

interface ReceiptDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  receipt: StockReceipt | null;
}

const statusConfig: Record<
  ReceiptStatus,
  { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }
> = {
  draft: { label: 'Bản nháp', variant: 'secondary' },
  pending: { label: 'Chờ duyệt', variant: 'default' },
  approved: { label: 'Đã duyệt', variant: 'default' },
  rejected: { label: 'Từ chối', variant: 'destructive' },
};

export function ReceiptDetailDialog({
  open,
  onOpenChange,
  receipt: listItem,
}: ReceiptDetailDialogProps) {
  const receipt = useFullReceipt(listItem, open);
  if (!receipt) return null;

  const currentStatus = statusConfig[receipt.status] || {
    label: receipt.status,
    variant: 'outline' as const,
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="2xl">
        <DialogHeader>
          <div className="flex items-center justify-between pr-6">
            <div className="flex items-center gap-3">
              <DialogTitle className="text-xl">Phiếu nhập {receipt.code}</DialogTitle>
              <Badge variant={currentStatus.variant} className="text-xs">
                {currentStatus.label}
              </Badge>
            </div>
          </div>
          <DialogDescription>
            Chi tiết lượng nhập, chênh lệch thực tế và lịch sử duyệt phiếu.
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="space-y-6">
          {/* Metadata Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 rounded-lg bg-muted/30 border text-sm">
            <div>
              <span className="text-xs text-muted-foreground block">Trạm xăng:</span>
              <span className="font-semibold">{receipt.branch_name}</span>
            </div>
            <div>
              <span className="text-xs text-muted-foreground block">Thời gian nhập:</span>
              <span className="font-medium tabular-nums">
                {formatDateTimeVN(receipt.received_at)}
              </span>
            </div>
            <div>
              <span className="text-xs text-muted-foreground block">Nhà cung cấp:</span>
              <span>{receipt.supplier_name || '—'}</span>
            </div>
            <div>
              <span className="text-xs text-muted-foreground block">Biển số xe bồn:</span>
              <span className="font-mono">{receipt.tanker_plate || '—'}</span>
            </div>
            <div>
              <span className="text-xs text-muted-foreground block">Số chứng từ:</span>
              <span className="font-mono">{receipt.document_no || '—'}</span>
            </div>
            <div>
              <span className="text-xs text-muted-foreground block">Tổng thực nhập:</span>
              <span className="font-bold text-primary tabular-nums">
                {formatNumberVN(receipt.total_volume_ml / 1000)} L
              </span>
            </div>
            <div>
              <span className="text-xs text-muted-foreground block">Người lập phiếu:</span>
              <span>{receipt.created_by_name || receipt.created_by}</span>
            </div>
            <div>
              <span className="text-xs text-muted-foreground block">Ngày lập:</span>
              <span className="tabular-nums">{formatDateTimeVN(receipt.created_at)}</span>
            </div>
          </div>

          {/* Rejection notice if rejected */}
          {receipt.status === 'rejected' && receipt.reject_reason && (
            <div className="flex items-start gap-3 p-3 rounded-lg border border-destructive/20 bg-destructive/10 text-destructive text-sm">
              <XCircleIcon className="w-5 h-5 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Lý do từ chối:</p>
                <p>{receipt.reject_reason}</p>
                <p className="text-xs mt-1 text-destructive/80">
                  Từ chối bởi {receipt.decided_by_name} lúc {formatDateTimeVN(receipt.decided_at)}
                </p>
              </div>
            </div>
          )}

          {/* Approval info if approved */}
          {receipt.status === 'approved' && (
            <div className="flex items-center gap-3 p-3 rounded-lg border border-emerald-500/20 bg-emerald-50 text-emerald-800 text-sm">
              <UserCheckIcon className="w-5 h-5 shrink-0" />
              <div>
                <span>Duyệt bởi: <strong>{receipt.decided_by_name}</strong> lúc {formatDateTimeVN(receipt.decided_at)}</span>
                <span className="text-xs block text-emerald-700">
                  Đã tự động ghi nhận thẻ kho (Stock Ledger) và cập nhật số dư tồn thực tế của bể.
                </span>
              </div>
            </div>
          )}

          {/* Lines Table */}
          <div className="space-y-2">
            <h4 className="text-sm font-semibold">Chi tiết từng bể chứa</h4>
            <div className="border rounded-md overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Bể chứa</TableHead>
                    <TableHead>Nhiên liệu</TableHead>
                    <TableHead className="text-right">Theo hóa đơn (L)</TableHead>
                    <TableHead className="text-right font-semibold">Thực nhận (L)</TableHead>
                    <TableHead className="text-right">Chênh lệch (L)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(receipt.lines ?? []).map((line) => {
                    const docL = line.document_volume_ml / 1000;
                    const actL = line.actual_volume_ml / 1000;
                    const varL = line.variance_ml / 1000;
                    return (
                      <TableRow key={line.id}>
                        <TableCell className="font-medium">
                          {line.tank_name} ({line.tank_code})
                        </TableCell>
                        <TableCell>{line.fuel_type_name}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatNumberVN(docL)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums font-semibold text-primary">
                          {formatNumberVN(actL)}
                        </TableCell>
                        <TableCell
                          className={`text-right tabular-nums font-semibold ${
                            varL < 0
                              ? 'text-destructive'
                              : varL > 0
                              ? 'text-emerald-600'
                              : 'text-muted-foreground'
                          }`}
                        >
                          {varL > 0 ? `+${formatNumberVN(varL)}` : formatNumberVN(varL)}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </div>

          {receipt.note && (
            <div className="text-sm">
              <span className="text-xs font-semibold text-muted-foreground block">Ghi chú:</span>
              <p className="mt-1 text-foreground">{receipt.note}</p>
            </div>
          )}
        </DialogBody>

        <DialogFooter className="border-t p-4 bg-muted/50">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Đóng
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
