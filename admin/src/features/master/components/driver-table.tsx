'use client';

import { DetailDialog } from '@/components/detail-dialog';
import { rowClick } from '@/lib/row-click';
import { driverDetail } from '@/lib/row-details';
import { TableEmptyRow } from '@/components/table-empty-row';
import { StatusBadge } from '@/components/status-badge';
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
  TrashIcon,
} from '@heroicons/react/24/outline';
import { FaceThumbnail } from '@/components/face-thumbnail';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { DriverListItem } from '../types';
import { useUpdateDriverStatus } from '../api/update-driver-status';
import { useDeleteDriver } from '../api/delete-driver';
import { DRIVER_STATUS, statusStyle } from '@/lib/status-labels';

interface DriverTableProps {
  drivers: DriverListItem[];
  isLoading: boolean;
  canEdit?: boolean;
  canDelete?: boolean;
  onEdit: (driver: DriverListItem) => void;
}

export function DriverTable({
  drivers,
  isLoading,
  canEdit = true,
  canDelete = true,
  onEdit,
}: DriverTableProps) {
  const [detail, setDetail] = React.useState<DriverListItem | null>(null);
  const updateStatus = useUpdateDriverStatus();
  const deleteDriver = useDeleteDriver();

  const [statusConfirmTarget, setStatusConfirmTarget] = React.useState<DriverListItem | null>(null);
  const [deleteConfirmTarget, setDeleteConfirmTarget] = React.useState<DriverListItem | null>(null);

  const handleConfirmStatusChange = () => {
    if (!statusConfirmTarget) return;
    const newStatus = statusConfirmTarget.status === 'active' ? 'blocked' : 'active';
    updateStatus.mutate(
      { id: statusConfirmTarget.id, status: newStatus },
      { onSuccess: () => setStatusConfirmTarget(null) },
    );
  };

  const handleConfirmDelete = () => {
    if (!deleteConfirmTarget) return;
    deleteDriver.mutate(deleteConfirmTarget.id, {
      onSuccess: () => setDeleteConfirmTarget(null),
    });
  };

  const getStatusBadge = (status: string) => {
    const { tone, label } = statusStyle(DRIVER_STATUS, status);
    return <StatusBadge tone={tone}>{label}</StatusBadge>;
  };

  return (
    <>
      <div className="rounded-md border border-border bg-card flex min-h-0 flex-1 flex-col">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[110px]">Mã tài xế</TableHead>
              <TableHead>Họ và tên</TableHead>
              <TableHead className="w-[120px]">Số điện thoại</TableHead>
              <TableHead>Thẻ NFC</TableHead>
              <TableHead className="w-[120px]">Khuôn mặt</TableHead>
              <TableHead className="w-[130px]">Trạng thái</TableHead>
              <TableHead className={`${ACTION_HEAD_CLASS} w-[70px]`}>Thao tác</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableEmptyRow colSpan={7} loading title="Đang tải danh sách tài xế..." />
            ) : drivers.length === 0 ? (
              <TableEmptyRow colSpan={7} title="Không tìm thấy tài xế nào phù hợp." />
            ) : (
              drivers.map((d) => (
                <TableRow key={d.id} data-testid={`driver-row-${d.code}`} onClick={rowClick(() => setDetail(d))}>
                  <TableCell className="font-mono font-medium text-primary">{d.code}</TableCell>
                  <TableCell className="font-medium">{d.full_name}</TableCell>
                  <TableCell className="font-mono text-sm text-muted-foreground">{d.phone || '-'}</TableCell>
                  <TableCell>
                    {d.card_number ? (
                      <span className="font-mono text-sm text-foreground">{d.card_number}</span>
                    ) : (
                      <span className="text-[11px] text-muted-foreground italic">Chưa có thẻ</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {d.has_face ? (
                      <FaceThumbnail fileId={d.face_file_id} size={36} />
                    ) : (
                      <span className="text-[11px] text-muted-foreground italic">Chưa có</span>
                    )}
                  </TableCell>
                  <TableCell>{getStatusBadge(d.status)}</TableCell>
                  <TableCell className={ACTION_CELL_CLASS}>
                    {(canEdit || canDelete) && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 w-8 p-0"
                            data-testid={`driver-actions-${d.code}`}
                          >
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
                              <DropdownMenuItem
                                onClick={() => setStatusConfirmTarget(d)}
                                data-testid={`status-driver-${d.code}`}
                              >
                                {d.status === 'active' ? (
                                  <>
                                    <LockClosedIcon className="mr-2 h-4 w-4 text-amber-500" />
                                    <span className="text-amber-600">Khóa tài xế</span>
                                  </>
                                ) : (
                                  <>
                                    <LockOpenIcon className="mr-2 h-4 w-4 text-emerald-500" />
                                    <span className="text-emerald-600">Mở khóa tài xế</span>
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
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      <DetailDialog
        open={detail !== null}
        onOpenChange={(open) => !open && setDetail(null)}
        title={detail?.full_name ?? ''}
        description={'Tài xế'}
        sections={detail ? driverDetail(detail) : []}
      />
      </div>

      {/* Confirm Lock / Unlock */}
      <ConfirmDialog
        open={!!statusConfirmTarget}
        onOpenChange={(open) => !open && setStatusConfirmTarget(null)}
        level={statusConfirmTarget?.status === 'active' ? 'destructive' : 'info'}
        title={statusConfirmTarget?.status === 'active' ? 'Khóa tài xế' : 'Mở khóa tài xế'}
        description={`Bạn có chắc muốn ${statusConfirmTarget?.status === 'active' ? 'khóa' : 'mở khóa'} tài xế ${statusConfirmTarget?.full_name} (Mã: ${statusConfirmTarget?.code})?`}
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
