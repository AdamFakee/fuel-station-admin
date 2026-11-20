'use client';

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
import { Badge } from '@/components/ui/badge';
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
  const { isManager } = useAuth();
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
    if (confirm(`Bạn có chắc chắn muốn ngừng hoạt động chi nhánh ${branch.name}?`)) {
      try {
        await deleteMutation.mutateAsync(branch.id);
        toast.success(`Đã ngừng hoạt động chi nhánh ${branch.name}`);
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

        {isManager && (
          <Button onClick={handleCreate} size="sm" className="h-9 gap-1.5 shrink-0">
            <PlusIcon className="h-4 w-4" />
            <span>Thêm chi nhánh</span>
          </Button>
        )}
      </div>

      {/* Data Table */}
      <div className="rounded-md border bg-card flex min-h-0 flex-1 flex-col">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40">
              <TableHead className="w-[120px] text-left">Mã chi nhánh</TableHead>
              <TableHead className="text-left">Tên chi nhánh</TableHead>
              <TableHead className="text-left">Địa chỉ</TableHead>
              <TableHead className="text-left">Người quản lý</TableHead>
              <TableHead className="text-right tabular-nums">Số điện thoại</TableHead>
              <TableHead className="text-center w-[110px]">Trạng thái</TableHead>
              <TableHead className="text-right tabular-nums w-[120px]">Ngày tạo</TableHead>
              {isManager && <TableHead className={`${ACTION_HEAD_CLASS} w-[90px]`}>Thao tác</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={isManager ? 8 : 7} className="h-24 text-center text-muted-foreground text-xs">
                  Đang tải danh sách chi nhánh...
                </TableCell>
              </TableRow>
            ) : branches.length === 0 ? (
              <TableRow>
                <TableCell colSpan={isManager ? 8 : 7} className="h-24 text-center text-muted-foreground text-xs">
                  Chưa có chi nhánh nào được khai báo.
                </TableCell>
              </TableRow>
            ) : (
              branches.map((b) => (
                <TableRow key={b.id} className="hover:bg-muted/20">
                  <TableCell className="font-mono text-xs font-medium text-left">{b.code}</TableCell>
                  <TableCell className="text-left font-medium text-foreground">{b.name}</TableCell>
                  <TableCell className="text-left text-xs text-muted-foreground">{b.address || '—'}</TableCell>
                  <TableCell className="text-left text-xs">{b.manager_name || '—'}</TableCell>
                  <TableCell className="text-right tabular-nums text-xs font-mono">{b.phone || '—'}</TableCell>
                  <TableCell className="text-center">
                    <Badge variant={b.status === 'active' ? 'default' : 'secondary'} className="text-[10px] px-2 py-0">
                      {b.status === 'active' ? 'Hoạt động' : 'Tạm dừng'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-xs text-muted-foreground">
                    {formatDateVN(b.created_at)}
                  </TableCell>
                  {isManager && (
                    <TableCell className={ACTION_CELL_CLASS}>
                      <div className="flex justify-end gap-1">
                        {b.status === 'active' && (
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
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEdit(b)}
                          title="Chỉnh sửa"
                          className="h-7 w-7 text-muted-foreground hover:text-foreground"
                        >
                          <PencilSquareIcon className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
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
