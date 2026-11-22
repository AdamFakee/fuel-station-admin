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
import { StockIssue, IssueStatus, IssueKind } from '../types';
import { useIssues } from '../api/get-issues';
import { useDeleteIssue } from '../api/delete-issue';
import { useSubmitIssue } from '../api/submit-issue';
import { useBranches } from '@/features/assets/api/get-branches';
import { IssueDialogForm } from './issue-dialog-form';
import { IssueDetailDialog } from './issue-detail-dialog';
import { IssueApproveDialog } from './issue-approve-dialog';
import { ConfirmDialog } from '@/components/confirm-dialog';
import Paginator from '@/components/paginator';
import { useAuth } from '@/features/auth/hooks/use-auth';
import { formatNumberVN, formatDateTimeVN } from '@/lib/format';
import { toast } from 'sonner';
import { showApiError } from '@/lib/api-error';

const statusConfig: Record<
  IssueStatus,
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

const kindBadgeConfig: Record<IssueKind, { label: string; className: string }> = {
  transfer: {
    label: 'Điều chuyển',
    className: 'bg-blue-100 text-blue-800 border-blue-200',
  },
  loss: {
    label: 'Hao hụt',
    className: 'bg-amber-100 text-amber-800 border-amber-200',
  },
  inspection: {
    label: 'Kiểm định',
    className: 'bg-purple-100 text-purple-800 border-purple-200',
  },
};

export function IssueTable() {
  const { hasPermission } = useAuth();
  const [search, setSearch] = React.useState('');
  const [debouncedSearch, setDebouncedSearch] = React.useState('');
  const [branchFilter, setBranchFilter] = React.useState('');
  const [kindFilter, setKindFilter] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState('');
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(15);

  const [selectedIssue, setSelectedIssue] = React.useState<StockIssue | null>(null);
  const [createEditDialogOpen, setCreateEditDialogOpen] = React.useState(false);
  const [detailDialogOpen, setDetailDialogOpen] = React.useState(false);
  const [approveDialogOpen, setApproveDialogOpen] = React.useState(false);

  // Confirm delete dialog state
  const [deleteTarget, setDeleteTarget] = React.useState<StockIssue | null>(null);

  // Debounce search
  React.useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(handler);
  }, [search]);

  const { data: branchData } = useBranches();
  const branches = branchData?.data || [];

  const { data, isLoading } = useIssues({
    page,
    page_size: pageSize,
    q: debouncedSearch || undefined,
    branch_id: branchFilter || undefined,
    kind: kindFilter || undefined,
    status: statusFilter || undefined,
  });

  const deleteMutation = useDeleteIssue();
  const submitMutation = useSubmitIssue();

  const issues = data?.items || [];
  const total = data?.total || 0;

  const handleCreate = () => {
    setSelectedIssue(null);
    setCreateEditDialogOpen(true);
  };

  const handleEdit = (issue: StockIssue) => {
    setSelectedIssue(issue);
    setCreateEditDialogOpen(true);
  };

  const handleView = (issue: StockIssue) => {
    setSelectedIssue(issue);
    setDetailDialogOpen(true);
  };

  const handleApprove = (issue: StockIssue) => {
    setSelectedIssue(issue);
    setApproveDialogOpen(true);
  };

  const handleSubmitForApproval = async (issue: StockIssue) => {
    try {
      await submitMutation.mutateAsync(issue.id);
      toast.success(`Đã nộp phiếu ${issue.code} chờ phê duyệt`);
    } catch (err: any) {
      showApiError(err, 'Có lỗi xảy ra khi nộp duyệt');
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    try {
      await deleteMutation.mutateAsync(deleteTarget.id);
      setDeleteTarget(null);
    } catch {
      // Error handled by mutation
    }
  };

  const canCreate = hasPermission('inventory.issue:create');
  const canUpdate = hasPermission('inventory.issue:update');
  const canDelete = hasPermission('inventory.issue:delete');
  const canApprove = hasPermission('inventory.issue:approve');

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      {/* Hành động của trang (nằm trên cùng, không chen vào thanh lọc) */}
      {canCreate && (
        <div className="flex justify-end">
          <Button onClick={handleCreate} className="flex items-center gap-1.5 shrink-0" data-testid="btn-create-issue">
            <PlusIcon className="w-4 h-4" />
            Lập phiếu xuất mới
          </Button>
        </div>
      )}

      {/* Thanh tìm kiếm và bộ lọc */}
      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-card p-4">
        <div className="relative min-w-[240px] flex-1">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Tìm theo mã phiếu, lý do..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <OptionSelect
            className="w-[210px]"
            value={branchFilter}
            onChange={(next) => {
              setBranchFilter(next);
              setPage(1);
            }}
            emptyLabel="Tất cả trạm xăng"
            options={branches.map((b) => ({ value: b.id, label: b.name }))}
          />

          <OptionSelect
            className="w-[190px]"
            value={kindFilter}
            onChange={(next) => {
              setKindFilter(next);
              setPage(1);
            }}
            emptyLabel="Tất cả loại xuất"
            options={[
              { value: 'transfer', label: 'Điều chuyển nội bộ' },
              { value: 'loss', label: 'Hao hụt tự nhiên' },
              { value: 'inspection', label: 'Kiểm định cột bơm' },
            ]}
          />

          <OptionSelect
            className="w-[190px]"
            value={statusFilter}
            onChange={(next) => {
              setStatusFilter(next);
              setPage(1);
            }}
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
              <TableHead className="w-[110px]">Loại phiếu</TableHead>
              <TableHead>Trạm xăng</TableHead>
              <TableHead>Bể xuất</TableHead>
              <TableHead>Bể nhận</TableHead>
              <TableHead className="text-right tabular-nums text-orange-600">Lượng xuất (L)</TableHead>
              <TableHead className="w-[110px]">Trạng thái</TableHead>
              <TableHead className="text-right w-[140px]">Ngày lập</TableHead>
              <TableHead className="text-right w-[130px]">Thao tác</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableEmptyRow colSpan={9} loading title="Đang tải danh sách phiếu xuất điều chỉnh..." />
            ) : issues.length === 0 ? (
              <TableEmptyRow colSpan={9} title="Không tìm thấy phiếu xuất nào." />
            ) : (
              issues.map((issue) => {
                const statusMeta = statusConfig[issue.status] || {
                  label: issue.status,
                  tone: 'neutral' as const,
                };
                const kindMeta = kindBadgeConfig[issue.kind] || {
                  label: issue.kind_name || issue.kind,
                  className: '',
                };

                return (
                  <TableRow key={issue.id} data-testid={`issue-row-${issue.code}`} onClick={rowClick(() => handleView(issue))}>
                    <TableCell className="font-mono font-medium text-xs">{issue.code}</TableCell>
                    <TableCell>
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${kindMeta.className}`}
                      >
                        {kindMeta.label}
                      </span>
                    </TableCell>
                    <TableCell className="font-medium text-sm">{issue.branch_name}</TableCell>
                    <TableCell className="text-xs">
                      <div className="font-medium">{issue.tank_name}</div>
                      <div className="text-muted-foreground">{issue.fuel_type_name}</div>
                    </TableCell>
                    <TableCell className="text-xs">
                      {issue.kind === 'transfer' ? (
                        <>
                          <div className="font-medium">{issue.to_tank_name || '—'}</div>
                          <div className="text-muted-foreground">{issue.fuel_type_name}</div>
                        </>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right tabular-nums font-semibold text-orange-600 text-sm">
                      {formatNumberVN(issue.volume_liters)}
                    </TableCell>
                    <TableCell>
                      <StatusBadge tone={statusMeta.tone}>{statusMeta.label}</StatusBadge>
                    </TableCell>
                    <TableCell className="text-right text-xs text-muted-foreground tabular-nums">
                      {formatDateTimeVN(issue.created_at)}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-1">
                        {/* View Button */}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleView(issue)}
                          className="h-8 w-8 p-0"
                          title="Xem chi tiết"
                          data-testid={`btn-view-${issue.code}`}
                        >
                          <EyeIcon className="w-4 h-4 text-muted-foreground" />
                        </Button>

                        {/* Actions for draft: Submit, Edit, Delete */}
                        {issue.status === 'draft' && (
                          <>
                            {canUpdate && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleSubmitForApproval(issue)}
                              className="h-8 w-8 p-0 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                              title="Gửi phê duyệt"
                              data-testid={`btn-submit-${issue.code}`}
                            >
                              <PaperAirplaneIcon className="w-4 h-4" />
                            </Button>
                            )}

                            {canUpdate && (

                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEdit(issue)}
                              className="h-8 w-8 p-0"
                              title="Chỉnh sửa"
                              data-testid={`btn-edit-${issue.code}`}
                            >
                              <PencilSquareIcon className="w-4 h-4" />
                            </Button>

                            )}

                            {canDelete && (

                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setDeleteTarget(issue)}
                              className="h-8 w-8 p-0 text-destructive hover:bg-destructive/10"
                              title="Xóa phiếu"
                              data-testid={`btn-delete-${issue.code}`}
                            >
                              <TrashIcon className="w-4 h-4" />
                            </Button>

                            )}
                          </>
                        )}

                        {/* Actions for pending: Approve / Reject (Accountant only) */}
                        {issue.status === 'pending' && canApprove && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleApprove(issue)}
                            className="h-8 w-8 p-0 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                            title="Phê duyệt / Từ chối"
                            data-testid={`btn-approve-${issue.code}`}
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

      {/* Paginator */}
      {total > 0 && (
        <Paginator
          currentPage={page}
          pageSize={pageSize}
          totalItems={total}
          onPageChange={(newPage, newPageSize) => {
            setPage(newPage);
            setPageSize(newPageSize);
          }}
        />
      )}

      {/* Dialogs */}
      <IssueDialogForm open={createEditDialogOpen} onOpenChange={setCreateEditDialogOpen} issue={selectedIssue} />

      <IssueDetailDialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen} issue={selectedIssue} />

      <IssueApproveDialog open={approveDialogOpen} onOpenChange={setApproveDialogOpen} issue={selectedIssue} />

      {/* Confirm Delete Dialog */}
      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        level="destructive"
        title={`Xóa phiếu xuất điều chỉnh ${deleteTarget?.code}?`}
        description="Phiếu xuất ở trạng thái bản nháp sẽ bị xóa vĩnh viễn khỏi hệ thống."
        confirmText="Xóa phiếu xuất"
        loading={deleteMutation.isPending}
        onConfirm={handleDeleteConfirm}
      />
    </div>
  );
}
