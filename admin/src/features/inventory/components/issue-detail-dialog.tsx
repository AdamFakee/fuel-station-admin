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
import { StockIssue, IssueStatus } from '../types';
import { formatNumberVN, formatDateTimeVN } from '@/lib/format';

interface IssueDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  issue: StockIssue | null;
}

const statusConfig: Record<
  IssueStatus,
  { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }
> = {
  draft: { label: 'Bản nháp', variant: 'secondary' },
  pending: { label: 'Chờ duyệt', variant: 'default' },
  approved: { label: 'Đã duyệt', variant: 'default' },
  rejected: { label: 'Từ chối', variant: 'destructive' },
};

export function IssueDetailDialog({
  open,
  onOpenChange,
  issue,
}: IssueDetailDialogProps) {
  if (!issue) return null;

  const statusMeta = statusConfig[issue.status] || {
    label: issue.status,
    variant: 'outline' as const,
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="md">
        <DialogHeader>
          <div className="flex items-center justify-between gap-2 pr-6">
            <DialogTitle>Chi tiết phiếu xuất điều chỉnh</DialogTitle>
            <Badge variant={statusMeta.variant}>{statusMeta.label}</Badge>
          </div>
          <DialogDescription>
            Mã phiếu: <span className="font-mono font-medium text-foreground">{issue.code}</span>
          </DialogDescription>
        </DialogHeader>

        <DialogBody>
          <div className="space-y-4 py-2 text-sm">
            <div className="grid grid-cols-2 gap-4 pb-3 border-b">
              <div>
                <span className="text-muted-foreground block text-xs">Cửa hàng / Trạm:</span>
                <span className="font-medium">{issue.branch_name}</span>
              </div>
              <div>
                <span className="text-muted-foreground block text-xs">Loại phiếu xuất:</span>
                <span className="font-medium">{issue.kind_name}</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 pb-3 border-b">
              <div>
                <span className="text-muted-foreground block text-xs">Bể nguồn (xuất):</span>
                <span className="font-medium">
                  {issue.tank_name} ({issue.fuel_type_name})
                </span>
              </div>
              <div>
                <span className="text-muted-foreground block text-xs">Bể đích (nhận):</span>
                <span className="font-medium">
                  {issue.kind === 'transfer' ? `${issue.to_tank_name || '—'} (${issue.fuel_type_name})` : '—'}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 pb-3 border-b">
              <div>
                <span className="text-muted-foreground block text-xs">Số lượng xuất:</span>
                <span className="font-bold text-primary text-base tabular-nums">
                  {formatNumberVN(issue.volume_liters)} L
                </span>
              </div>
              <div>
                <span className="text-muted-foreground block text-xs">Dung tích (ml):</span>
                <span className="font-mono text-muted-foreground tabular-nums">
                  {formatNumberVN(issue.volume_ml)} ml
                </span>
              </div>
            </div>

            <div className="pb-3 border-b">
              <span className="text-muted-foreground block text-xs">Lý do xuất:</span>
              <p className="mt-1 text-foreground whitespace-pre-wrap">{issue.reason}</p>
            </div>

            <div className="grid grid-cols-2 gap-4 text-xs">
              <div>
                <span className="text-muted-foreground block">Người lập:</span>
                <span className="font-medium">{issue.created_by_name}</span>
                <span className="block text-muted-foreground tabular-nums">
                  {formatDateTimeVN(issue.created_at)}
                </span>
              </div>
              {issue.decided_by_name && (
                <div>
                  <span className="text-muted-foreground block">Người duyệt / Quyết định:</span>
                  <span className="font-medium">{issue.decided_by_name}</span>
                  <span className="block text-muted-foreground tabular-nums">
                    {formatDateTimeVN(issue.decided_at)}
                  </span>
                </div>
              )}
            </div>

            {issue.status === 'rejected' && issue.reject_reason && (
              <div className="p-3 rounded-md bg-destructive/10 border border-destructive/20 text-xs">
                <span className="font-semibold text-destructive block mb-1">Lý do từ chối:</span>
                <p className="text-destructive/90">{issue.reject_reason}</p>
              </div>
            )}
          </div>
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
