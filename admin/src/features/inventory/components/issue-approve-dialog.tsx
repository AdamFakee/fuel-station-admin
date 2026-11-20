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
import { StockIssue } from '../types';
import { useApproveIssue } from '../api/approve-issue';
import { formatNumberVN, formatDateTimeVN } from '@/lib/format';
import { CheckCircle2Icon, XCircleIcon, AlertTriangleIcon } from 'lucide-react';
import { toast } from 'sonner';

interface IssueApproveDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  issue: StockIssue | null;
}

export function IssueApproveDialog({
  open,
  onOpenChange,
  issue,
}: IssueApproveDialogProps) {
  const [rejectReason, setRejectReason] = React.useState('');
  const [mode, setMode] = React.useState<'approve' | 'reject'>('approve');
  const [submitting, setSubmitting] = React.useState(false);

  const approveMutation = useApproveIssue();

  React.useEffect(() => {
    if (open) {
      setRejectReason('');
      setMode('approve');
    }
  }, [open]);

  if (!issue) return null;

  const handleAction = async () => {
    const isApproved = mode === 'approve';
    if (!isApproved && !rejectReason.trim()) {
      toast.error('Vui lòng nhập lý do từ chối phiếu xuất');
      return;
    }

    setSubmitting(true);
    try {
      await approveMutation.mutateAsync({
        id: issue.id,
        data: {
          approved: isApproved,
          reject_reason: !isApproved ? rejectReason.trim() : undefined,
        },
      });
      toast.success(
        isApproved
          ? `Đã phê duyệt phiếu xuất ${issue.code}`
          : `Đã từ chối phiếu xuất ${issue.code}`
      );
      onOpenChange(false);
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Có lỗi xảy ra khi phê duyệt';
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {mode === 'approve' ? (
              <>
                <CheckCircle2Icon className="w-5 h-5 text-emerald-600" />
                Phê duyệt phiếu xuất điều chỉnh
              </>
            ) : (
              <>
                <XCircleIcon className="w-5 h-5 text-destructive" />
                Từ chối phiếu xuất điều chỉnh
              </>
            )}
          </DialogTitle>
          <DialogDescription>
            Phiếu: <strong className="font-mono text-foreground">{issue.code}</strong> • Trạm: {issue.branch_name}
          </DialogDescription>
        </DialogHeader>

        <DialogBody>
          <div className="space-y-4 py-2">
            {/* Mode Selector */}
            <div className="flex gap-2 p-1 bg-muted rounded-lg">
              <Button
                type="button"
                variant={mode === 'approve' ? 'default' : 'ghost'}
                size="sm"
                className="flex-1"
                onClick={() => setMode('approve')}
              >
                <CheckCircle2Icon className="w-4 h-4 mr-1.5" />
                Phê duyệt phiếu
              </Button>
              <Button
                type="button"
                variant={mode === 'reject' ? 'destructive' : 'ghost'}
                size="sm"
                className="flex-1"
                onClick={() => setMode('reject')}
              >
                <XCircleIcon className="w-4 h-4 mr-1.5" />
                Từ chối duyệt
              </Button>
            </div>

            {/* Summary Information */}
            <div className="rounded-md border p-3 bg-muted/30 text-sm space-y-2">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Loại xuất:</span>
                <span className="font-medium text-foreground">{issue.kind_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Bể xuất:</span>
                <span className="font-medium text-foreground">
                  {issue.tank_name} ({issue.fuel_type_name})
                </span>
              </div>
              {issue.kind === 'transfer' && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Bể nhận:</span>
                  <span className="font-medium text-foreground">
                    {issue.to_tank_name || '—'} ({issue.fuel_type_name})
                  </span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-muted-foreground">Lượng xuất:</span>
                <span className="font-bold text-primary tabular-nums">
                  {formatNumberVN(issue.volume_liters)} L
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Người lập:</span>
                <span className="font-medium text-foreground">{issue.created_by_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Thời điểm lập:</span>
                <span className="tabular-nums text-muted-foreground">
                  {formatDateTimeVN(issue.created_at)}
                </span>
              </div>
              <div className="pt-1 border-t text-xs">
                <span className="text-muted-foreground">Lý do: </span>
                <span className="italic text-foreground">{issue.reason}</span>
              </div>
            </div>

            {mode === 'approve' ? (
              <div className="p-3 rounded-md bg-amber-500/10 border border-amber-500/20 text-xs text-amber-700 dark:text-amber-400 flex gap-2">
                <AlertTriangleIcon className="w-4 h-4 shrink-0 mt-0.5" />
                <span>
                  Lưu ý: Sau khi duyệt, hệ thống sẽ ghi sổ kho (Stock Ledger) và cập nhật số lượng tồn thực tế của các bể liên quan. Phiếu đã duyệt sẽ không thể chỉnh sửa hoặc xóa.
                </span>
              </div>
            ) : (
              <div className="space-y-1.5">
                <Label htmlFor="issue-reject-reason" className="text-sm font-medium">
                  Lý do từ chối *
                </Label>
                <Textarea
                  id="issue-reject-reason"
                  rows={3}
                  placeholder="Nhập lý do từ chối để nhân viên tạo phiếu điều chỉnh lại..."
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  required
                />
              </div>
            )}
          </div>
        </DialogBody>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            Hủy
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
