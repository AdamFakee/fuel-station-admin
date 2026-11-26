'use client';

import { DetailDialog } from '@/components/detail-dialog';
import { rowClick } from '@/lib/row-click';
import { vehicleDetail } from '@/lib/row-details';
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
  CreditCardIcon,
  TrashIcon,
} from '@heroicons/react/24/outline';
import { formatDateTimeVN } from '@/lib/format';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { VehicleListItem } from '../types';
import { useUpdateVehicleStatus } from '../api/update-vehicle-status';
import { useDeleteVehicle } from '../api/delete-vehicle';

interface VehicleTableProps {
  vehicles: VehicleListItem[];
  /** Số thứ tự của dòng đầu trang (trang 2 với 15 dòng/trang là 15), để STT đánh tiếp qua các trang. */
  startIndex?: number;
  isLoading: boolean;
  canEdit?: boolean;
  canDelete?: boolean;
  onEdit: (vehicle: VehicleListItem) => void;
  onManageCard: (vehicle: VehicleListItem) => void;
}

export function VehicleTable({
  vehicles,
  startIndex = 0,
  isLoading,
  canEdit = true,
  canDelete = true,
  onEdit,
  onManageCard,
}: VehicleTableProps) {
  const [detail, setDetail] = React.useState<VehicleListItem | null>(null);
  const updateStatus = useUpdateVehicleStatus();
  const deleteVehicle = useDeleteVehicle();

  const [statusConfirmTarget, setStatusConfirmTarget] = React.useState<VehicleListItem | null>(null);
  const [deleteConfirmTarget, setDeleteConfirmTarget] = React.useState<VehicleListItem | null>(null);

  const handleConfirmStatusChange = () => {
    if (!statusConfirmTarget) return;
    const newStatus = statusConfirmTarget.status === 'active' ? 'banned' : 'active';
    updateStatus.mutate(
      { id: statusConfirmTarget.id, status: newStatus },
      { onSuccess: () => setStatusConfirmTarget(null) },
    );
  };

  const handleConfirmDelete = () => {
    if (!deleteConfirmTarget) return;
    deleteVehicle.mutate(deleteConfirmTarget.id, {
      onSuccess: () => setDeleteConfirmTarget(null),
    });
  };

  return (
    <>
      <div className="rounded-md border border-border bg-card flex min-h-0 flex-1 flex-col">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[60px] text-center">STT</TableHead>
              <TableHead className="w-[110px]">Mã xe</TableHead>
              <TableHead className="w-[140px]">Biển số</TableHead>
              <TableHead>Loại xe & Nhiên liệu</TableHead>
              <TableHead>Thẻ NFC</TableHead>
              <TableHead className="w-[120px]">Trạng thái</TableHead>
              <TableHead className={`${ACTION_HEAD_CLASS} w-[70px]`}>Thao tác</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableEmptyRow colSpan={7} loading title="Đang tải danh sách phương tiện..." />
            ) : vehicles.length === 0 ? (
              <TableEmptyRow colSpan={7} title="Không tìm thấy phương tiện nào phù hợp." />
            ) : (
              vehicles.map((v, index) => (
                <TableRow key={v.id} data-testid={`vehicle-row-${v.code}`} onClick={rowClick(() => setDetail(v))}>
                  <TableCell className="text-center text-muted-foreground tabular-nums">{startIndex + index + 1}</TableCell>
                  <TableCell className="font-mono font-medium text-primary">{v.code}</TableCell>
                  <TableCell>
                    <span className="inline-block rounded bg-secondary px-2 py-0.5 font-mono text-sm font-semibold tracking-wider text-secondary-foreground">
                      {v.plate}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-0.5">
                      <span className="text-sm font-medium">{v.vehicle_type_name || 'Xe chuẩn'}</span>
                      <span className="text-xs text-muted-foreground">Nhiên liệu: {v.fuel_type_name}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    {v.card_number ? (
                      <span className="font-mono text-sm text-foreground">{v.card_number}</span>
                    ) : (
                      <span className="text-xs text-muted-foreground italic">Chưa gán thẻ</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <StatusBadge tone={v.status === 'active' ? 'success' : 'danger'}>
                      {v.status === 'active' ? 'Hoạt động' : 'Bị khóa'}
                    </StatusBadge>
                  </TableCell>
                  <TableCell className={ACTION_CELL_CLASS}>
                    {(canEdit || canDelete) && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 w-8 p-0"
                            data-testid={`vehicle-actions-${v.code}`}
                          >
                            <span className="sr-only">Mở menu</span>
                            <EllipsisHorizontalIcon className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {canEdit && (
                            <>
                              <DropdownMenuItem onClick={() => onEdit(v)} data-testid={`edit-vehicle-${v.code}`}>
                                <PencilSquareIcon className="mr-2 h-4 w-4" />
                                Sửa thông tin
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => onManageCard(v)} data-testid={`card-vehicle-${v.code}`}>
                                <CreditCardIcon className="mr-2 h-4 w-4" />
                                Gán / Đổi thẻ NFC
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => setStatusConfirmTarget(v)}
                                data-testid={`status-vehicle-${v.code}`}
                              >
                                {v.status === 'active' ? (
                                  <>
                                    <LockClosedIcon className="mr-2 h-4 w-4 text-amber-500" />
                                    <span className="text-amber-600">Khóa quyền đổ</span>
                                  </>
                                ) : (
                                  <>
                                    <LockOpenIcon className="mr-2 h-4 w-4 text-emerald-500" />
                                    <span className="text-emerald-600">Mở khóa quyền đổ</span>
                                  </>
                                )}
                              </DropdownMenuItem>
                            </>
                          )}
                          {canDelete && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() => setDeleteConfirmTarget(v)}
                                className="text-destructive focus:text-destructive"
                                data-testid={`delete-vehicle-${v.code}`}
                              >
                                <TrashIcon className="mr-2 h-4 w-4" />
                                Xóa phương tiện
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
        title={detail?.plate ?? ''}
        description={'Phương tiện'}
        sections={detail ? vehicleDetail(detail) : []}
      />
      </div>

      {/* Confirm Lock / Unlock */}
      <ConfirmDialog
        open={!!statusConfirmTarget}
        onOpenChange={(open) => !open && setStatusConfirmTarget(null)}
        level={statusConfirmTarget?.status === 'active' ? 'destructive' : 'info'}
        title={statusConfirmTarget?.status === 'active' ? 'Khóa quyền đổ nhiên liệu của xe' : 'Mở khóa quyền đổ cho xe'}
        description={`Bạn có chắc muốn ${statusConfirmTarget?.status === 'active' ? 'khóa' : 'mở khóa'} phương tiện ${statusConfirmTarget?.code} (${statusConfirmTarget?.plate})? Khi bị khóa, trụ bơm sẽ từ chối cấp phát cho xe này.`}
        confirmText={statusConfirmTarget?.status === 'active' ? 'Khóa xe' : 'Mở khóa'}
        loading={updateStatus.isPending}
        onConfirm={handleConfirmStatusChange}
      />

      {/* Confirm Soft Delete */}
      <ConfirmDialog
        open={!!deleteConfirmTarget}
        onOpenChange={(open) => !open && setDeleteConfirmTarget(null)}
        level="destructive"
        title="Xác nhận xóa phương tiện"
        description={`Bạn có chắc chắn muốn xóa phương tiện ${deleteConfirmTarget?.code} (${deleteConfirmTarget?.plate}) khỏi danh mục hệ thống? Thẻ NFC tương ứng sẽ tự động bị thu hồi.`}
        confirmText="Xóa phương tiện"
        loading={deleteVehicle.isPending}
        onConfirm={handleConfirmDelete}
      />
    </>
  );
}
