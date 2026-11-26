'use client';

import { DetailDialog } from '@/components/detail-dialog';
import { rowClick } from '@/lib/row-click';
import { userDetail } from '@/lib/row-details';
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
  KeyIcon,
  TrashIcon,
} from '@heroicons/react/24/outline';
import { formatDateTimeVN } from '@/lib/format';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { useAuth } from '@/features/auth/hooks/use-auth';
import { useUpdateUserStatus } from '../api/update-user-status';
import { useDeleteUser } from '../api/delete-user';
import { UserListItem } from '../types';
import { USER_STATUS, statusStyle } from '@/lib/status-labels';

interface UserTableProps {
  users: UserListItem[];
  isLoading: boolean;
  onEdit: (user: UserListItem) => void;
  onResetPassword: (user: UserListItem) => void;
  currentUserId?: string;
}

export function UserTable({ users, isLoading, onEdit, onResetPassword, currentUserId }: UserTableProps) {
  const [detail, setDetail] = React.useState<UserListItem | null>(null);
  const { hasPermission } = useAuth();
  const canUpdate = hasPermission('iam.user:update');
  const canDelete = hasPermission('iam.user:delete');
  const showActions = canUpdate || canDelete;
  const updateStatus = useUpdateUserStatus();
  const deleteUser = useDeleteUser();

  // Status confirm state
  const [statusConfirmTarget, setStatusConfirmTarget] = React.useState<UserListItem | null>(null);
  const [deleteConfirmTarget, setDeleteConfirmTarget] = React.useState<UserListItem | null>(null);

  const handleToggleStatus = (user: UserListItem) => {
    setStatusConfirmTarget(user);
  };

  const handleConfirmStatusChange = () => {
    if (!statusConfirmTarget) return;
    const newStatus = statusConfirmTarget.status === 'active' ? 'locked' : 'active';
    updateStatus.mutate(
      { id: statusConfirmTarget.id, status: newStatus },
      { onSuccess: () => setStatusConfirmTarget(null) },
    );
  };

  const handleConfirmDelete = () => {
    if (!deleteConfirmTarget) return;
    deleteUser.mutate(deleteConfirmTarget.id, {
      onSuccess: () => setDeleteConfirmTarget(null),
    });
  };

  if (isLoading) {
    return (
      <div className="rounded-md border p-8 text-center text-sm text-muted-foreground">
        Đang tải danh sách tài khoản...
      </div>
    );
  }

  if (users.length === 0) {
    return (
      <div className="flex min-h-[240px] flex-1 items-center justify-center rounded-md border border-dashed p-12 text-center text-sm text-muted-foreground">
        Không tìm thấy tài khoản nào phù hợp với điều kiện tìm kiếm.
      </div>
    );
  }

  return (
    <>
      <div className="rounded-md border bg-card overflow-hidden flex min-h-0 flex-1 flex-col">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[120px] text-left">Mã NV</TableHead>
              <TableHead className="text-left">Họ và tên</TableHead>
              <TableHead className="text-left">Email đăng nhập</TableHead>
              <TableHead className="text-left">Vai trò</TableHead>
              <TableHead className="text-left w-[110px]">Trạng thái</TableHead>
              <TableHead className="text-right tabular-nums w-[170px]">Đăng nhập cuối</TableHead>
              {showActions && <TableHead className={`${ACTION_HEAD_CLASS} w-[80px]`}>Thao tác</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((u) => {
              const isSelf = u.id === currentUserId;
              const isLocked = u.status === 'locked';

              return (
                <TableRow key={u.id} className="hover:bg-muted/40 transition-colors" onClick={rowClick(() => setDetail(u))}>
                  <TableCell className="font-mono text-xs font-semibold text-foreground text-left">
                    {u.employee_code}
                  </TableCell>
                  <TableCell className="text-left">
                    <div className="font-medium text-foreground">{u.full_name}</div>
                    {u.phone && <div className="text-xs text-muted-foreground">{u.phone}</div>}
                  </TableCell>
                  <TableCell className="text-left">
                    <div className="text-sm text-foreground">{u.email}</div>
                  </TableCell>
                  <TableCell className="text-left">
                    <Badge variant="outline" className="font-normal text-xs">
                      {u.role_name}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-left">
                    <StatusBadge tone={statusStyle(USER_STATUS, u.status).tone}>{statusStyle(USER_STATUS, u.status).label}</StatusBadge>
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-xs text-muted-foreground">
                    {formatDateTimeVN(u.last_login_at)}
                  </TableCell>
                  {showActions && (
                    <TableCell className={ACTION_CELL_CLASS}>
                      <div className="flex justify-end gap-1">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="icon" className="h-8 w-8">
                              <EllipsisHorizontalIcon className="h-4 w-4" />
                              <span className="sr-only">Tùy chọn</span>
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-48">
                            {canUpdate && (
                              <>
                                <DropdownMenuItem onClick={() => onEdit(u)} className="cursor-pointer">
                                  <PencilSquareIcon className="mr-2 h-4 w-4 text-muted-foreground" />
                                  Sửa thông tin
                                </DropdownMenuItem>

                                <DropdownMenuItem onClick={() => onResetPassword(u)} className="cursor-pointer">
                                  <KeyIcon className="mr-2 h-4 w-4 text-muted-foreground" />
                                  Đặt lại mật khẩu
                                </DropdownMenuItem>

                                <DropdownMenuSeparator />

                                <DropdownMenuItem
                                  onClick={() => handleToggleStatus(u)}
                                  disabled={isSelf}
                                  className={
                                    isLocked ? 'cursor-pointer text-emerald-600' : 'cursor-pointer text-amber-600'
                                  }
                                >
                                  {isLocked ? (
                                    <>
                                      <LockOpenIcon className="mr-2 h-4 w-4" />
                                      Mở khóa tài khoản
                                    </>
                                  ) : (
                                    <>
                                      <LockClosedIcon className="mr-2 h-4 w-4" />
                                      Khóa tài khoản
                                    </>
                                  )}
                                </DropdownMenuItem>
                              </>
                            )}

                            {canDelete && (
                              <DropdownMenuItem
                                onClick={() => setDeleteConfirmTarget(u)}
                                disabled={isSelf}
                                className="cursor-pointer text-destructive focus:text-destructive"
                              >
                                <TrashIcon className="mr-2 h-4 w-4" />
                                Xóa tài khoản
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      <DetailDialog
        open={detail !== null}
        onOpenChange={(open) => !open && setDetail(null)}
        title={detail?.full_name ?? ''}
        description={'Tài khoản người dùng'}
        sections={detail ? userDetail(detail) : []}
        layout="stacked"
      />
      </div>

      {/* Lock/Unlock Confirm Dialog */}
      {statusConfirmTarget && (
        <ConfirmDialog
          open={Boolean(statusConfirmTarget)}
          onOpenChange={(open) => !open && setStatusConfirmTarget(null)}
          level={statusConfirmTarget.status === 'active' ? 'security' : 'info'}
          title={statusConfirmTarget.status === 'active' ? 'Khóa tài khoản người dùng?' : 'Mở khóa tài khoản?'}
          description={
            statusConfirmTarget.status === 'active'
              ? `Tài khoản ${statusConfirmTarget.full_name} (${statusConfirmTarget.email}) sẽ không thể đăng nhập vào hệ thống.`
              : `Tài khoản ${statusConfirmTarget.full_name} (${statusConfirmTarget.email}) sẽ được kích hoạt lại.`
          }
          consequences={
            statusConfirmTarget.status === 'active'
              ? [
                  'Toàn bộ phiên đăng nhập đang hoạt động của người dùng sẽ bị thu hồi ngay lập tức.',
                  'Người dùng không thể thao tác bất kỳ chức năng nào cho đến khi được mở khóa.',
                ]
              : undefined
          }
          confirmText={statusConfirmTarget.status === 'active' ? 'Khóa tài khoản' : 'Mở khóa'}
          loading={updateStatus.isPending}
          onConfirm={handleConfirmStatusChange}
        />
      )}

      {/* Delete User Confirm Dialog */}
      {deleteConfirmTarget && (
        <ConfirmDialog
          open={Boolean(deleteConfirmTarget)}
          onOpenChange={(open) => !open && setDeleteConfirmTarget(null)}
          level="destructive"
          title={`Xác nhận xóa tài khoản ${deleteConfirmTarget.full_name}?`}
          description={`Tài khoản mã ${deleteConfirmTarget.employee_code} (${deleteConfirmTarget.email}) sẽ bị xóa mềm khỏi danh mục.`}
          consequences={[
            'Tài khoản sẽ bị vô hiệu hóa hoàn toàn khỏi hệ thống đăng nhập.',
            'Dữ liệu lịch sử xuất nhập, giao dịch bơm và audit log liên quan vẫn được bảo lưu.',
          ]}
          confirmText="Xóa tài khoản"
          loading={deleteUser.isPending}
          onConfirm={handleConfirmDelete}
        />
      )}
    </>
  );
}
