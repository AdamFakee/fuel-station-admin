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
  isLoading: boolean;
  canEdit?: boolean;
  canDelete?: boolean;
  onEdit: (vehicle: VehicleListItem) => void;
  onManageCard: (vehicle: VehicleListItem) => void;
}

export function VehicleTable({
  vehicles,
  isLoading,
  canEdit = true,
  canDelete = true,
  onEdit,
  onManageCard,
}: VehicleTableProps) {
  const updateStatus = useUpdateVehicleStatus();
  const deleteVehicle = useDeleteVehicle();

  const [statusConfirmTarget, setStatusConfirmTarget] = React.useState<VehicleListItem | null>(null);
  const [deleteConfirmTarget, setDeleteConfirmTarget] = React.useState<VehicleListItem | null>(null);

  const handleConfirmStatusChange = () => {
    if (!statusConfirmTarget) return;
    const newStatus = statusConfirmTarget.status === 'active' ? 'banned' : 'active';
    updateStatus.mutate(
      { id: statusConfirmTarget.id, status: newStatus },
      { onSuccess: () => setStatusConfirmTarget(null) }
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
              <TableHead className="w-[110px]">Mã xe</TableHead>
              <TableHead className="w-[140px]">Biển số</TableHead>
              <TableHead>Loại xe & Nhiên liệu</TableHead>
              <TableHead>Thẻ NFC</TableHead>
              <TableHead>Cửa hàng được phép</TableHead>
              <TableHead className="w-[120px]">Trạng thái</TableHead>
              <TableHead className={`${ACTION_HEAD_CLASS} w-[70px]`}>Thao tác</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={7} className="h-32 text-center text-muted-foreground">
                  Đang tải danh sách phương tiện...
                </TableCell>
              </TableRow>
            ) : vehicles.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="h-32 text-center text-muted-foreground">
                  Không tìm thấy phương tiện nào phù hợp.
                </TableCell>
              </TableRow>
            ) : (
              vehicles.map((v) => (
                <TableRow key={v.id} data-testid={`vehicle-row-${v.code}`}>
                  <TableCell className="font-mono font-medium text-primary">
                    {v.code}
                  </TableCell>
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
                      <Badge variant="secondary" className="font-mono text-xs text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 dark:text-emerald-400">
                        <CreditCardIcon className="mr-1 h-3 w-3" />
                        {v.card_number}
                      </Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground italic">Chưa gán thẻ</span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm">
                    {v.branch_names && v.branch_names.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {v.branch_names.map((name) => (
                          <Badge key={name} variant="secondary" className="text-xs font-normal">
                            {name}
                          </Badge>
                        ))}
                      </div>
                    ) : (
                      <span className="text-xs text-amber-600">Chưa được phép ở cửa hàng nào</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {v.status === 'active' ? (
                      <Badge variant="outline" className="border-emerald-500/30 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400">
                        Hoạt động
                      </Badge>
                    ) : (
                      <Badge variant="destructive">
                        Bị khóa
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className={ACTION_CELL_CLASS}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="sm" className="h-8 w-8 p-0" data-testid={`vehicle-actions-${v.code}`}>
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
                            <DropdownMenuItem onClick={() => setStatusConfirmTarget(v)} data-testid={`status-vehicle-${v.code}`}>
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
