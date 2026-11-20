'use client';

import * as React from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  PlusIcon,
  EyeIcon,
  PencilSquareIcon,
  TrashIcon,
  PaperAirplaneIcon,
  CheckCircleIcon,
} from '@heroicons/react/24/outline';
import { StockReceipt, ReceiptStatus } from '../types';
import { useReceipts } from '../api/get-receipts';
import { useDeleteReceipt } from '../api/delete-receipt';
import { useSubmitReceipt } from '../api/submit-receipt';
import { useBranches } from '@/features/assets/api/get-branches';
import { ReceiptDialog } from './receipt-dialog';
import { ReceiptDetailDialog } from './receipt-detail-dialog';
import { ReceiptApproveDialog } from './receipt-approve-dialog';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { useAuth } from '@/features/auth/hooks/use-auth';
import { formatNumberVN, formatDateTimeVN } from '@/lib/format';
import { toast } from 'sonner';

const statusConfig: Record<
  ReceiptStatus,
  { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }
> = {
  draft: { label: 'Bản nháp', variant: 'secondary' },
  pending: { label: 'Chờ duyệt', variant: 'default' },
  approved: { label: 'Đã duyệt', variant: 'default' },
  rejected: { label: 'Từ chối', variant: 'destructive' },
};

export function ReceiptTable() {
  const { isManager } = useAuth();
  const [search, setSearch] = React.useState('');
  const [branchFilter, setBranchFilter] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState('');

  const [selectedReceipt, setSelectedReceipt] = React.useState<StockReceipt | null>(null);
  const [createEditDialogOpen, setCreateEditDialogOpen] = React.useState(false);
  const [detailDialogOpen, setDetailDialogOpen] = React.useState(false);
  const [approveDialogOpen, setApproveDialogOpen] = React.useState(false);

  // Confirm delete dialog state
  const [deleteTarget, setDeleteTarget] = React.useState<StockReceipt | null>(null);

  const { data: branchData } = useBranches();
  const branches = branchData?.data || [];

  const { data, isLoading } = useReceipts({
    q: search || undefined,
    branch_id: branchFilter || undefined,
    status: statusFilter || undefined,
  });

  const deleteMutation = useDeleteReceipt();
  const submitMutation = useSubmitReceipt();

  const receipts = data?.data || [];

  const handleCreate = () => {
    setSelectedReceipt(null);
    setCreateEditDialogOpen(true);
  };

  const handleEdit = (r: StockReceipt) => {
    setSelectedReceipt(r);
    setCreateEditDialogOpen(true);
  };

  const handleView = (r: StockReceipt) => {
    setSelectedReceipt(r);
    setDetailDialogOpen(true);
  };

  const handleApprove = (r: StockReceipt) => {
    setSelectedReceipt(r);
    setApproveDialogOpen(true);
  };

  const handleSubmitForApproval = async (r: StockReceipt) => {
    try {
      await submitMutation.mutateAsync(r.id);
      toast.success(`Đã nộp phiếu ${r.code} chờ phê duyệt`);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Có lỗi xảy ra khi nộp duyệt');
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    try {
      await deleteMutation.mutateAsync(deleteTarget.id);
      toast.success(`Đã xóa phiếu nhập ${deleteTarget.code}`);
      setDeleteTarget(null);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Có lỗi xảy ra khi xóa phiếu');
    }
  };

  return (
    <div className="space-y-4">
      {/* Search & Filter Toolbar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="flex flex-1 flex-col sm:flex-row items-stretch sm:items-center gap-2">
          <Input
            placeholder="Tìm theo mã phiếu, biển số xe, số hóa đơn..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="sm:max-w-xs"
          />

          <select
            className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring sm:max-w-[200px]"
            value={branchFilter}
            onChange={(e) => setBranchFilter(e.target.value)}
          >
            <option value="">Tất cả trạm xăng</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>

          <select
            className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring sm:max-w-[170px]"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="">Tất cả trạng thái</option>
            <option value="draft">Bản nháp</option>
            <option value="pending">Chờ duyệt</option>
            <option value="approved">Đã duyệt</option>
            <option value="rejected">Từ chối</option>
          </select>
        </div>

        {isManager && (
          <Button onClick={handleCreate} className="flex items-center gap-1.5 shrink-0">
            <PlusIcon className="w-4 h-4" />
            Lập phiếu nhập
          </Button>
        )}
      </div>

      {/* Main Table */}
      <div className="rounded-md border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[120px]">Mã phiếu</TableHead>
              <TableHead className="w-[150px]">Ngày nhập</TableHead>
              <TableHead>Trạm / Cửa hàng</TableHead>
              <TableHead>Nhà cung cấp / Xe bồn</TableHead>
              <TableHead>Số hóa đơn</TableHead>
              <TableHead className="text-right">Tổng thực nhập (L)</TableHead>
              <TableHead className="w-[110px]">Trạng thái</TableHead>
              <TableHead className="text-right w-[150px]">Thao tác</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                  Đang tải danh sách phiếu nhập...
                </TableCell>
              </TableRow>
            ) : receipts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                  Không tìm thấy phiếu nhập bể nào.
                </TableCell>
              </TableRow>
            ) : (
              receipts.map((r) => {
                const statusMeta = statusConfig[r.status] || {
                  label: r.status,
                  variant: 'outline' as const,
                };
                const totalLiters = r.total_volume_ml / 1000;

                return (
                  <TableRow key={r.id}>
                    <TableCell className="font-mono font-medium text-xs">
                      {r.code}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground tabular-nums">
                      {formatDateTimeVN(r.received_at)}
                    </TableCell>
                    <TableCell className="font-medium text-sm">
                      {r.branch_name}
                    </TableCell>
                    <TableCell className="text-xs">
                      <div>{r.supplier_name || '—'}</div>
                      {r.tanker_plate && (
                        <span className="font-mono text-muted-foreground">
                          {r.tanker_plate}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {r.document_no || '—'}
                    </TableCell>
                    <TableCell className="text-right tabular-nums font-bold text-primary text-sm">
                      {formatNumberVN(totalLiters)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusMeta.variant} className="text-xs">
                        {statusMeta.label}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-1">
                        {/* View Button */}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleView(r)}
                          className="h-8 w-8 p-0"
                          title="Xem chi tiết"
                        >
                          <EyeIcon className="w-4 h-4 text-muted-foreground" />
                        </Button>

                        {/* Actions for draft: Submit, Edit, Delete */}
                        {r.status === 'draft' && isManager && (
                          <>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleSubmitForApproval(r)}
                              className="h-8 w-8 p-0 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                              title="Gửi phê duyệt"
                            >
                              <PaperAirplaneIcon className="w-4 h-4" />
                            </Button>

                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEdit(r)}
                              className="h-8 w-8 p-0"
                              title="Chỉnh sửa"
                            >
                              <PencilSquareIcon className="w-4 h-4" />
                            </Button>

                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setDeleteTarget(r)}
                              className="h-8 w-8 p-0 text-destructive hover:bg-destructive/10"
                              title="Xóa phiếu"
                            >
                              <TrashIcon className="w-4 h-4" />
                            </Button>
                          </>
                        )}

                        {/* Actions for pending: Approve / Reject */}
                        {r.status === 'pending' && isManager && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleApprove(r)}
                            className="h-8 w-8 p-0 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                            title="Phê duyệt / Từ chối"
                          >
                            <CheckCircleIcon className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Dialogs */}
      <ReceiptDialog
        open={createEditDialogOpen}
        onOpenChange={setCreateEditDialogOpen}
        receipt={selectedReceipt}
      />

      <ReceiptDetailDialog
        open={detailDialogOpen}
        onOpenChange={setDetailDialogOpen}
        receipt={selectedReceipt}
      />

      <ReceiptApproveDialog
        open={approveDialogOpen}
        onOpenChange={setApproveDialogOpen}
        receipt={selectedReceipt}
      />

      {/* Confirm Delete Dialog */}
      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        level="destructive"
        title={`Xóa phiếu nhập ${deleteTarget?.code}?`}
        description="Phiếu nhập ở trạng thái bản nháp sẽ bị xóa vĩnh viễn khỏi hệ thống."
        confirmText="Xóa phiếu nhập"
        loading={deleteMutation.isPending}
        onConfirm={handleDeleteConfirm}
      />
    </div>
  );
}
