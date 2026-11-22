'use client';

import { rowClick } from '@/lib/row-click';
import { TableEmptyRow } from '@/components/table-empty-row';
import { StatusBadge, StatusTone } from '@/components/status-badge';
import { OptionSelect } from '@/components/option-select';
import * as React from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  PlusIcon,
  EyeIcon,
  PencilSquareIcon,
  TrashIcon,
  PaperAirplaneIcon,
  CheckCircleIcon,
  MagnifyingGlassIcon,
} from '@heroicons/react/24/outline';
import { StockReceipt, ReceiptStatus } from '../types';
import { useReceipts } from '../api/get-receipts';
import Paginator from '@/components/paginator';
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
import { showApiError } from '@/lib/api-error';

const statusConfig: Record<
  ReceiptStatus,
  {
    label: string;
    tone: StatusTone;
  }
> = {
  draft: { label: 'Bản nháp', tone: 'neutral' },
  pending: { label: 'Chờ duyệt', tone: 'warning' },
  approved: { label: 'Đã duyệt', tone: 'success' },
  rejected: { label: 'Từ chối', tone: 'danger' },
};

export function ReceiptTable() {
  const { hasPermission } = useAuth();
  const canCreate = hasPermission('inventory.receipt:create');
  const canUpdate = hasPermission('inventory.receipt:update');
  const canDelete = hasPermission('inventory.receipt:delete');
  const canApprove = hasPermission('inventory.receipt:approve');
  const [search, setSearch] = React.useState('');
  const [branchFilter, setBranchFilter] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState('');
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(15);

  // Đổi bộ lọc thì về trang đầu.
  React.useEffect(() => {
    setPage(1);
  }, [search, branchFilter, statusFilter]);

  const [selectedReceipt, setSelectedReceipt] = React.useState<StockReceipt | null>(null);
  const [createEditDialogOpen, setCreateEditDialogOpen] = React.useState(false);
  const [detailDialogOpen, setDetailDialogOpen] = React.useState(false);
  const [approveDialogOpen, setApproveDialogOpen] = React.useState(false);

  // Confirm delete dialog state
  const [deleteTarget, setDeleteTarget] = React.useState<StockReceipt | null>(null);

  const { data: branchData } = useBranches();
  const branches = branchData?.data || [];

  const { data, isLoading } = useReceipts({
    page,
    page_size: pageSize,
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
      showApiError(err, 'Có lỗi xảy ra khi nộp duyệt');
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    try {
      await deleteMutation.mutateAsync(deleteTarget.id);
      toast.success(`Đã xóa phiếu nhập ${deleteTarget.code}`);
      setDeleteTarget(null);
    } catch (err: any) {
      showApiError(err, 'Có lỗi xảy ra khi xóa phiếu');
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      {/* Hành động của trang (nằm trên cùng, không chen vào thanh lọc) */}
      {canCreate && (
        <div className="flex justify-end">
          <Button onClick={handleCreate} className="flex items-center gap-1.5 shrink-0">
            <PlusIcon className="w-4 h-4" />
            Lập phiếu nhập
          </Button>
        </div>
      )}

      {/* Thanh tìm kiếm và bộ lọc */}
      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-card p-4">
        <div className="relative min-w-[240px] flex-1">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Tìm theo mã phiếu, biển số xe, số hóa đơn..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <OptionSelect
            className="w-[210px]"
            value={branchFilter}
            onChange={setBranchFilter}
            emptyLabel="Tất cả trạm xăng"
            options={branches.map((b) => ({ value: b.id, label: b.name }))}
          />

          <OptionSelect
            className="w-[190px]"
            value={statusFilter}
            onChange={setStatusFilter}
            emptyLabel="Tất cả trạng thái"
            options={[
              { value: 'draft', label: 'Bản nháp' },
              { value: 'pending', label: 'Chờ duyệt' },
              { value: 'approved', label: 'Đã duyệt' },
              { value: 'rejected', label: 'Từ chối' },
            ]}
          />
        </div>
      </div>

      {/* Main Table */}
      <div className="flex min-h-0 flex-1 flex-col rounded-md border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[120px]">Mã phiếu</TableHead>
              <TableHead className="w-[150px]">Ngày nhập</TableHead>
              <TableHead>Trạm xăng</TableHead>
              <TableHead>Nhà cung cấp / Xe bồn</TableHead>
              <TableHead>Số hóa đơn</TableHead>
              <TableHead className="text-right tabular-nums text-emerald-600">Tổng thực nhập (L)</TableHead>
              <TableHead className="w-[110px]">Trạng thái</TableHead>
              <TableHead className="text-right w-[150px]">Thao tác</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableEmptyRow colSpan={8} loading title="Đang tải danh sách phiếu nhập..." />
            ) : receipts.length === 0 ? (
              <TableEmptyRow colSpan={8} title="Không tìm thấy phiếu nhập bể nào." />
            ) : (
              receipts.map((r) => {
                const statusMeta = statusConfig[r.status] || {
                  label: r.status,
                  tone: 'neutral' as const,
                };
                const totalLiters = r.total_volume_ml / 1000;

                return (
                  <TableRow key={r.id} onClick={rowClick(() => handleView(r))}>
                    <TableCell className="font-mono font-medium text-xs">{r.code}</TableCell>
                    <TableCell className="text-xs text-muted-foreground tabular-nums">
                      {formatDateTimeVN(r.received_at)}
                    </TableCell>
                    <TableCell className="font-medium text-sm">{r.branch_name}</TableCell>
                    <TableCell className="text-xs">
                      <div>{r.supplier_name || '—'}</div>
                      {r.tanker_plate && <span className="font-mono text-muted-foreground">{r.tanker_plate}</span>}
                    </TableCell>
                    <TableCell className="font-mono text-xs">{r.document_no || '—'}</TableCell>
                    <TableCell className="text-right tabular-nums font-semibold text-emerald-600 text-sm">
                      {formatNumberVN(totalLiters)}
                    </TableCell>
                    <TableCell>
                      <StatusBadge tone={statusMeta.tone}>{statusMeta.label}</StatusBadge>
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
                        {r.status === 'draft' && (
                          <>
                            {canUpdate && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleSubmitForApproval(r)}
                              className="h-8 w-8 p-0 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                              title="Gửi phê duyệt"
                            >
                              <PaperAirplaneIcon className="w-4 h-4" />
                            </Button>
                            )}

                            {canUpdate && (

                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEdit(r)}
                              className="h-8 w-8 p-0"
                              title="Chỉnh sửa"
                            >
                              <PencilSquareIcon className="w-4 h-4" />
                            </Button>

                            )}

                            {canDelete && (

                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setDeleteTarget(r)}
                              className="h-8 w-8 p-0 text-destructive hover:bg-destructive/10"
                              title="Xóa phiếu"
                            >
                              <TrashIcon className="w-4 h-4" />
                            </Button>

                            )}
                          </>
                        )}

                        {/* Actions for pending: Approve / Reject */}
                        {r.status === 'pending' && canApprove && (
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

      {/* Phân trang */}
      {(data?.total ?? 0) > 0 && (
        <Paginator
          currentPage={page}
          pageSize={pageSize}
          totalItems={data?.total ?? 0}
          onPageChange={(newPage, newPageSize) => {
            setPage(newPage);
            setPageSize(newPageSize);
          }}
        />
      )}

      {/* Dialogs */}
      <ReceiptDialog open={createEditDialogOpen} onOpenChange={setCreateEditDialogOpen} receipt={selectedReceipt} />

      <ReceiptDetailDialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen} receipt={selectedReceipt} />

      <ReceiptApproveDialog open={approveDialogOpen} onOpenChange={setApproveDialogOpen} receipt={selectedReceipt} />

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
