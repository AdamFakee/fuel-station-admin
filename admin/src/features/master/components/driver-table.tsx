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
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  EllipsisHorizontalIcon,
  PencilSquareIcon,
  LockClosedIcon,
  LockOpenIcon,
  IdentificationIcon,
  TrashIcon,
  UserCircleIcon,
  FingerPrintIcon,
  CreditCardIcon,
} from '@heroicons/react/24/outline';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { DriverListItem } from '../types';
import { useUpdateDriverStatus } from '../api/update-driver-status';
import { useDeleteDriver } from '../api/delete-driver';

interface DriverTableProps {
  drivers: DriverListItem[];
  isLoading: boolean;
  canEdit?: boolean;
  canDelete?: boolean;
  onEdit: (driver: DriverListItem) => void;
  onManageCredentials: (driver: DriverListItem) => void;
}

export function DriverTable({
  drivers,
  isLoading,
  canEdit = true,
  canDelete = true,
  onEdit,
  onManageCredentials,
}: DriverTableProps) {
  const updateStatus = useUpdateDriverStatus();
  const deleteDriver = useDeleteDriver();

  const [statusConfirmTarget, setStatusConfirmTarget] = React.useState<DriverListItem | null>(null);
  const [deleteConfirmTarget, setDeleteConfirmTarget] = React.useState<DriverListItem | null>(null);

  const handleConfirmStatusChange = () => {
    if (!statusConfirmTarget) return;
    const newStatus = statusConfirmTarget.status === 'active' ? 'blocked' : 'active';
    updateStatus.mutate(
      { id: statusConfirmTarget.id, status: newStatus },
      { onSuccess: () => setStatusConfirmTarget(null) }
    );
  };

  const handleConfirmDelete = () => {
    if (!deleteConfirmTarget) return;
    deleteDriver.mutate(deleteConfirmTarget.id, {
      onSuccess: () => setDeleteConfirmTarget(null),
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return (
          <Badge variant="outline" className="border-emerald-500/30 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400">
            Đang làm việc
          </Badge>
        );
      case 'blocked':
        return <Badge variant="destructive">Tạm khóa</Badge>;
      case 'inactive':
        return <Badge variant="secondary">Nghỉ việc</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <>
      <div className="rounded-md border border-border bg-card flex min-h-0 flex-1 flex-col">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[110px]">Mã NV</TableHead>
              <TableHead>Họ và tên</TableHead>
              <TableHead className="w-[120px]">Số điện thoại</TableHead>
              <TableHead>Bộ phận</TableHead>
              <TableHead>Thẻ NFC</TableHead>
              <TableHead className="w-[120px]">Khuôn mặt</TableHead>
              <TableHead className="w-[120px]">Vân tay</TableHead>
              <TableHead className="w-[130px]">Trạng thái</TableHead>
              <TableHead className={`${ACTION_HEAD_CLASS} w-[70px]`}>Thao tác</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={9} className="h-32 text-center text-muted-foreground">
                  Đang tải danh sách tài xế & nhân viên...
                </TableCell>
              </TableRow>
            ) : drivers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="h-32 text-center text-muted-foreground">
                  Không tìm thấy tài xế nào phù hợp.
                </TableCell>
              </TableRow>
            ) : (
              drivers.map((d) => (
                <TableRow key={d.id} data-testid={`driver-row-${d.code}`}>
                  <TableCell className="font-mono font-medium text-primary">
                    {d.code}
                  </TableCell>
                  <TableCell className="font-medium">
                    {d.full_name}
                  </TableCell>
                  <TableCell className="font-mono text-sm text-muted-foreground">
                    {d.phone || '-'}
                  </TableCell>
                  <TableCell className="text-sm">
                    {d.department || <span className="text-muted-foreground">-</span>}
                  </TableCell>
                  <TableCell>
                    {d.card_number ? (
                      <Badge variant="outline" className="text-xs bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/30">
                        <CreditCardIcon className="mr-1 h-3 w-3" />
                        {d.card_number}
                      </Badge>
                    ) : (
                      <span className="text-[11px] text-muted-foreground italic">Chưa có thẻ</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {d.has_face ? (
                      <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-300 dark:bg-blue-950/30">
                        <UserCircleIcon className="mr-1 h-3 w-3" />
                        Đã đăng ký
                      </Badge>
                    ) : (
                      <span className="text-[11px] text-muted-foreground italic">Chưa có</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {d.has_fingerprint ? (
                      <Badge variant="outline" className="text-xs bg-purple-50 text-purple-700 border-purple-300 dark:bg-purple-950/30">
                        <FingerPrintIcon className="mr-1 h-3 w-3" />
                        Đã đăng ký
                      </Badge>
                    ) : (
                      <span className="text-[11px] text-muted-foreground italic">Chưa có</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {getStatusBadge(d.status)}
                  </TableCell>
                  <TableCell className={ACTION_CELL_CLASS}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="sm" className="h-8 w-8 p-0" data-testid={`driver-actions-${d.code}`}>
                          <span className="sr-only">Mở menu</span>
                          <EllipsisHorizontalIcon className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {canEdit && (
                          <>
                            <DropdownMenuItem onClick={() => onEdit(d)} data-testid={`edit-driver-${d.code}`}>
                              <PencilSquareIcon className="mr-2 h-4 w-4" />
                              Sửa hồ sơ
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => onManageCredentials(d)} data-testid={`credentials-driver-${d.code}`}>
                              <IdentificationIcon className="mr-2 h-4 w-4" />
                              Thẻ & Sinh trắc học
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setStatusConfirmTarget(d)} data-testid={`status-driver-${d.code}`}>
                              {d.status === 'active' ? (
                                <>
                                  <LockClosedIcon className="mr-2 h-4 w-4 text-amber-500" />
                                  <span className="text-amber-600">Tạm khóa tài xế</span>
                                </>
                              ) : (
                                <>
                                  <LockOpenIcon className="mr-2 h-4 w-4 text-emerald-500" />
                                  <span className="text-emerald-600">Mở khóa hoạt động</span>
                                </>
                              )}
                            </DropdownMenuItem>
                          </>
                        )}
                        {canDelete && (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => setDeleteConfirmTarget(d)}
                              className="text-destructive focus:text-destructive"
                              data-testid={`delete-driver-${d.code}`}
                            >
                              <TrashIcon className="mr-2 h-4 w-4" />
                              Xóa hồ sơ
                            </DropdownMenuItem>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Confirm Lock / Unlock */}
      <ConfirmDialog
        open={!!statusConfirmTarget}
        onOpenChange={(open) => !open && setStatusConfirmTarget(null)}
        level={statusConfirmTarget?.status === 'active' ? 'destructive' : 'info'}
        title={statusConfirmTarget?.status === 'active' ? 'Tạm khóa tài xế' : 'Mở khóa hoạt động tài xế'}
        description={`Bạn có chắc muốn ${statusConfirmTarget?.status === 'active' ? 'tạm khóa' : 'mở khóa'} tài xế ${statusConfirmTarget?.full_name} (Mã: ${statusConfirmTarget?.code})?`}
        confirmText={statusConfirmTarget?.status === 'active' ? 'Khóa tài xế' : 'Mở khóa'}
        loading={updateStatus.isPending}
        onConfirm={handleConfirmStatusChange}
      />

      {/* Confirm Soft Delete */}
      <ConfirmDialog
        open={!!deleteConfirmTarget}
        onOpenChange={(open) => !open && setDeleteConfirmTarget(null)}
        level="destructive"
        title="Xác nhận xóa tài xế"
        description={`Bạn có chắc chắn muốn xóa hồ sơ tài xế ${deleteConfirmTarget?.full_name} (${deleteConfirmTarget?.code})? Mọi thẻ từ và mẫu sinh trắc học liên quan sẽ bị thu hồi.`}
        confirmText="Xóa hồ sơ"
        loading={deleteDriver.isPending}
        onConfirm={handleConfirmDelete}
      />
    </>
  );
}
