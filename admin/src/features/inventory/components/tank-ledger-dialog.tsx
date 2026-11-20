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
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useTankLedger } from '../api/get-tank-ledger';
import { formatDateTimeVN, formatNumberVN } from '@/lib/format';
import { Loader2Icon, BookOpenIcon } from 'lucide-react';
import { StockLedgerItem } from '../types';

interface TankLedgerDialogProps {
  tankId: string | null;
  tankName: string;
  fuelTypeName?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const kindConfig: Record<
  string,
  { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive' }
> = {
  opening: { label: 'Tồn đầu kỳ', variant: 'outline' },
  receipt: { label: 'Nhập kho', variant: 'default' },
  dispense: { label: 'Xuất bơm', variant: 'secondary' },
  adjust: { label: 'Điều chỉnh', variant: 'outline' },
  issue: { label: 'Xuất khác', variant: 'destructive' },
  transfer_in: { label: 'Điều chuyển nhập', variant: 'outline' },
  transfer_out: { label: 'Điều chuyển xuất', variant: 'outline' },
};

export function TankLedgerDialog({
  tankId,
  tankName,
  fuelTypeName,
  open,
  onOpenChange,
}: TankLedgerDialogProps) {
  const { data: ledger, isLoading } = useTankLedger(tankId || '', 1, 50, Boolean(tankId));
  const items: StockLedgerItem[] = ledger?.items || [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="2xl">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10 text-primary">
              <BookOpenIcon className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-xl">
                Thẻ kho bể: {tankName}
              </DialogTitle>
              <DialogDescription>
                Theo dõi toàn bộ lịch sử biến động dung tích (Lít) và số dư tồn thực tế
                {fuelTypeName ? ` • Nhiên liệu: ${fuelTypeName}` : ''}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <DialogBody>
          {isLoading ? (
            <div className="flex flex-col items-center justify-center p-8 gap-2 text-muted-foreground">
              <Loader2Icon className="h-6 w-6 animate-spin text-primary" />
              <p className="text-sm">Đang tải lịch sử thẻ kho...</p>
            </div>
          ) : items.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">
              <p className="text-base font-medium">Chưa có bản ghi biến động nào</p>
              <p className="text-xs mt-1">Các giao dịch nhập, bơm và điều chỉnh sẽ xuất hiện tại đây.</p>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[180px]">Thời gian</TableHead>
                    <TableHead className="w-[110px]">Giao dịch</TableHead>
                    <TableHead className="w-[160px]">Mã tham chiếu</TableHead>
                    <TableHead className="text-right">Biến động (Lít)</TableHead>
                    <TableHead className="text-right font-semibold">Tồn sau giao dịch</TableHead>
                    <TableHead>Ghi chú</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((entry) => {
                    const typeCfg = kindConfig[entry.kind] || {
                      label: entry.kind,
                      variant: 'outline' as const,
                    };
                    const isPositive = entry.delta_liters > 0;
                    const isZero = entry.delta_liters === 0;

                    return (
                      <TableRow key={entry.id}>
                        <TableCell className="text-xs text-muted-foreground">
                          {formatDateTimeVN(entry.occurred_at)}
                        </TableCell>
                        <TableCell>
                          <Badge variant={typeCfg.variant} className="text-xs font-normal">
                            {typeCfg.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {entry.ref_id ? entry.ref_id.slice(0, 8) + '...' : '-'}
                        </TableCell>
                        <TableCell
                          className={`text-right tabular-nums font-medium ${
                            isPositive
                              ? 'text-emerald-600'
                              : isZero
                              ? 'text-muted-foreground'
                              : 'text-rose-600'
                          }`}
                        >
                          {isPositive ? '+' : ''}
                          {formatNumberVN(entry.delta_liters)} L
                        </TableCell>
                        <TableCell className="text-right tabular-nums font-semibold">
                          {formatNumberVN(entry.balance_after_liters)} L
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate" title={entry.note || ''}>
                          {entry.note || '-'}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </DialogBody>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Đóng
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
