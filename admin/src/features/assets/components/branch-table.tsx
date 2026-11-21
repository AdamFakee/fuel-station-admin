'use client';

import { DetailDialog } from '@/components/detail-dialog';
import { rowClick } from '@/lib/row-click';
import { branchDetail } from '@/lib/row-details';
import { TableEmptyRow } from '@/components/table-empty-row';
import { StatusBadge } from '@/components/status-badge';
import * as React from 'react';
import Paginator from '@/components/paginator';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  ACTION_HEAD_CLASS,
  ACTION_CELL_CLASS,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PlusIcon, PencilSquareIcon, NoSymbolIcon } from '@heroicons/react/24/outline';
import { Branch } from '../types';
import { useBranches } from '../api/get-branches';
import { useDeleteBranch } from '../api/delete-branch';
import { BranchDialog } from './branch-dialog';
import { useAuth } from '@/features/auth/hooks/use-auth';
import { formatDateVN } from '@/lib/format';
import { toast } from 'sonner';

export function BranchTable() {
  const [detail, setDetail] = React.useState<Branch | null>(null);
  const { hasPermission } = useAuth();
  const canCreate = hasPermission('org.branch:create');
  const canUpdate = hasPermission('org.branch:update');
  const canDelete = hasPermission('org.branch:delete');
  const showActions = canUpdate || canDelete;
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(15);
  const [search, setSearch] = React.useState('');
  const [selectedBranch, setSelectedBranch] = React.useState<Branch | null>(null);
  const [dialogOpen, setDialogOpen] = React.useState(false);

  React.useEffect(() => {
    setPage(1);
  }, [search]);

  const { data, isLoading } = useBranches({ q: search || undefined, page, page_size: pageSize });
  const deleteMutation = useDeleteBranch();

  const branches = data?.data || [];

  const handleCreate = () => {
    setSelectedBranch(null);
    setDialogOpen(true);
  };

  const handleEdit = (branch: Branch) => {
    setSelectedBranch(branch);
    setDialogOpen(true);
  };

  const handleDeactivate = async (branch: Branch) => {
    if (confirm(`Bạn có chắc chắn muốn ngừng hoạt động trạm xăng ${branch.name}?`)) {
      try {
        await deleteMutation.mutateAsync(branch.id);
        toast.success(`Đã ngừng hoạt động trạm xăng ${branch.name}`);
      } catch (err: any) {
        toast.error(err.response?.data?.message || 'Có lỗi xảy ra');
      }
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      {/* Action Header */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2 max-w-sm flex-1">
          <Input
            placeholder="Tìm theo mã, tên, địa chỉ..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 text-xs"
          />
        </div>

        {canCreate && (
          <Button onClick={handleCreate} size="sm" className="h-9 gap-1.5 shrink-0">
            <PlusIcon className="h-4 w-4" />
            <span>Thêm trạm xăng</span>
          </Button>
        )}
      </div>

      {/* Data Table */}
      <div className="rounded-md border bg-card flex min-h-0 flex-1 flex-col">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40">
              <TableHead className="w-[120px] text-left">Mã trạm xăng</TableHead>
              <TableHead className="text-left">Tên trạm xăng</TableHead>
              <TableHead className="text-left">Địa chỉ</TableHead>
              <TableHead className="text-left">Người quản lý</TableHead>
              <TableHead className="text-right tabular-nums">Số điện thoại</TableHead>
              <TableHead className="text-center w-[110px]">Trạng thái</TableHead>
              <TableHead className="text-right tabular-nums w-[120px]">Ngày tạo</TableHead>
              {showActions && <TableHead className={`${ACTION_HEAD_CLASS} w-[90px]`}>Thao tác</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableEmptyRow colSpan={showActions ? 8 : 7} loading title="Đang tải danh sách trạm xăng..." />
            ) : branches.length === 0 ? (
              <TableEmptyRow colSpan={showActions ? 8 : 7} title="Chưa có trạm xăng nào được khai báo." />
            ) : (
              branches.map((b) => (
                <TableRow key={b.id} className="hover:bg-muted/20" onClick={rowClick(() => setDetail(b))}>
                  <TableCell className="font-mono text-xs font-medium text-left">{b.code}</TableCell>
                  <TableCell className="text-left font-medium text-foreground">{b.name}</TableCell>
                  <TableCell className="text-left text-xs text-muted-foreground">{b.address || '—'}</TableCell>
                  <TableCell className="text-left text-xs">{b.manager_name || '—'}</TableCell>
                  <TableCell className="text-right tabular-nums text-xs font-mono">{b.phone || '—'}</TableCell>
                  <TableCell className="text-center">
                    <StatusBadge tone={b.status === 'active' ? 'success' : 'warning'}>
                      {b.status === 'active' ? 'Hoạt động' : 'Tạm dừng'}
                    </StatusBadge>
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-xs text-muted-foreground">
                    {formatDateVN(b.created_at)}
                  </TableCell>
                  {showActions && (
                    <TableCell className={ACTION_CELL_CLASS}>
                      <div className="flex justify-end gap-1">
                        {canDelete && b.status === 'active' && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDeactivate(b)}
                            title="Ngừng hoạt động"
                            className="h-7 w-7 text-muted-foreground hover:text-destructive"
                          >
                            <NoSymbolIcon className="h-3.5 w-3.5" />
                          </Button>
                        )}
                        {canUpdate && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEdit(b)}
                          title="Chỉnh sửa"
                          className="h-7 w-7 text-muted-foreground hover:text-foreground"
                        >
                          <PencilSquareIcon className="h-3.5 w-3.5" />
                        </Button>
                        )}
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      <DetailDialog
        open={detail !== null}
        onOpenChange={(open) => !open && setDetail(null)}
        title={detail?.name ?? ''}
        description={'Trạm xăng'}
        sections={detail ? branchDetail(detail) : []}
      />
      </div>

      <Paginator
        currentPage={page}
        pageSize={pageSize}
        totalItems={data?.total ?? 0}
        onPageChange={(p, size) => {
          setPage(p);
          setPageSize(size);
        }}
      />

      <BranchDialog open={dialogOpen} onOpenChange={setDialogOpen} branch={selectedBranch} />
    </div>
  );
}
