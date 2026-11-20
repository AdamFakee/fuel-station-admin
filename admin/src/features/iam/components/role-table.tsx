'use client';

import * as React from 'react';
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  EllipsisHorizontalIcon,
  PencilSquareIcon,
  TrashIcon,
  ShieldCheckIcon,
} from '@heroicons/react/24/outline';
import { formatDateTimeVN, formatNumberVN } from '@/lib/format';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { useDeleteRole } from '../api/delete-role';
import { RoleListItem } from '../types';

interface RoleTableProps {
  roles: RoleListItem[];
  isLoading: boolean;
  onEdit: (role: RoleListItem) => void;
}

export function RoleTable({ roles, isLoading, onEdit }: RoleTableProps) {
  const deleteRole = useDeleteRole();
  const [deleteTarget, setDeleteTarget] = React.useState<RoleListItem | null>(null);

  const handleConfirmDelete = () => {
    if (!deleteTarget) return;
    deleteRole.mutate(deleteTarget.id, {
      onSuccess: () => setDeleteTarget(null),
    });
  };

  if (isLoading) {
    return (
      <div className="rounded-md border p-8 text-center text-sm text-muted-foreground">
        Đang tải danh sách vai trò...
      </div>
    );
  }

  if (roles.length === 0) {
    return (
      <div className="rounded-md border border-dashed p-12 text-center text-sm text-muted-foreground">
        Chưa có vai trò nào trong hệ thống.
      </div>
    );
  }

  return (
    <>
      <div className="rounded-md border bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[140px] text-left">Mã vai trò</TableHead>
              <TableHead className="text-left w-[200px]">Tên vai trò</TableHead>
              <TableHead className="text-left">Mô tả nhiệm vụ</TableHead>
              <TableHead className="text-left w-[120px]">Phân loại</TableHead>
              <TableHead className="text-right tabular-nums w-[110px]">Tài khoản</TableHead>
              <TableHead className="text-right tabular-nums w-[110px]">Số quyền</TableHead>
              <TableHead className="text-right tabular-nums w-[170px]">Cập nhật cuối</TableHead>
              <TableHead className={`${ACTION_HEAD_CLASS} w-[80px]`}>Thao tác</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {roles.map((r) => {
              const canDelete = !r.is_system && r.user_count === 0;

              return (
                <TableRow key={r.id} className="hover:bg-muted/40 transition-colors">
                  <TableCell className="font-mono text-xs font-semibold text-foreground text-left">
                    {r.code}
                  </TableCell>
                  <TableCell className="text-left">
                    <div className="font-semibold text-foreground flex items-center gap-1.5">
                      {r.name}
                      {r.is_system && (
                        <ShieldCheckIcon className="h-4 w-4 text-primary shrink-0" title="Vai trò hệ thống mặc định" />
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-left text-xs text-muted-foreground">
                    {r.description || '—'}
                  </TableCell>
                  <TableCell className="text-left">
                    {r.is_system ? (
                      <Badge variant="secondary" className="bg-primary/10 text-primary border-primary/20 text-xs font-normal">
                        Hệ thống
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-xs font-normal">
                        Tùy chỉnh
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-xs font-medium">
                    {formatNumberVN(r.user_count)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-xs font-medium">
                    {formatNumberVN(r.permission_count)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-xs text-muted-foreground">
                    {formatDateTimeVN(r.updated_at)}
                  </TableCell>
                  <TableCell className={ACTION_CELL_CLASS}>
                    <div className="flex justify-end gap-1">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="outline" size="icon" className="h-8 w-8">
                            <EllipsisHorizontalIcon className="h-4 w-4" />
                            <span className="sr-only">Tùy chọn</span>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-44">
                          <DropdownMenuItem onClick={() => onEdit(r)} className="cursor-pointer">
                            <PencilSquareIcon className="mr-2 h-4 w-4 text-muted-foreground" />
                            Sửa ma trận quyền
                          </DropdownMenuItem>

                          {canDelete && (
                            <DropdownMenuItem
                              onClick={() => setDeleteTarget(r)}
                              className="cursor-pointer text-destructive focus:text-destructive"
                            >
                              <TrashIcon className="mr-2 h-4 w-4" />
                              Xóa vai trò
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {deleteTarget && (
        <ConfirmDialog
          open={Boolean(deleteTarget)}
          onOpenChange={(open) => !open && setDeleteTarget(null)}
          level="destructive"
          title={`Xác nhận xóa vai trò ${deleteTarget.name}?`}
          description={`Vai trò mã ${deleteTarget.code} sẽ bị gỡ bỏ hoàn toàn khỏi hệ thống.`}
          confirmText="Xóa vai trò"
          loading={deleteRole.isPending}
          onConfirm={handleConfirmDelete}
        />
      )}
    </>
  );
}
