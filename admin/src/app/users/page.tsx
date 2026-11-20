'use client';

import * as React from 'react';
import { AdminShell } from '@/components/admin-shell';
import { DetailPageHeader } from '@/components/detail-page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import Paginator from '@/components/paginator';
import { PlusIcon, MagnifyingGlassIcon, ArrowPathIcon } from '@heroicons/react/24/outline';
import { useUsers } from '@/features/iam/api/get-users';
import { useRoles } from '@/features/iam/api/get-roles';
import { useMe } from '@/features/auth/api/get-me';
import { UserTable } from '@/features/iam/components/user-table';
import { UserDialogForm } from '@/features/iam/components/user-dialog-form';
import { ResetPasswordDialog } from '@/features/iam/components/reset-password-dialog';
import { UserListItem } from '@/features/iam/types';

export default function UsersPage() {
  const { data: me } = useMe();
  const { data: roles = [] } = useRoles();

  // Search & Filters state
  const [search, setSearch] = React.useState('');
  const [debouncedSearch, setDebouncedSearch] = React.useState('');
  const [roleId, setRoleId] = React.useState<string>('all');
  const [status, setStatus] = React.useState<string>('all');
  const [page, setPage] = React.useState(1);
  const pageSize = 15;

  React.useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const { data, isLoading, refetch, isFetching } = useUsers({
    page,
    page_size: pageSize,
    q: debouncedSearch || undefined,
    role_id: roleId !== 'all' ? roleId : undefined,
    status: status !== 'all' ? status : undefined,
  });

  // Dialog states
  const [isFormOpen, setIsFormOpen] = React.useState(false);
  const [editingUser, setEditingUser] = React.useState<UserListItem | null>(null);
  const [resettingUser, setResettingUser] = React.useState<UserListItem | null>(null);

  const handleOpenCreate = () => {
    setEditingUser(null);
    setIsFormOpen(true);
  };

  const handleOpenEdit = (user: UserListItem) => {
    setEditingUser(user);
    setIsFormOpen(true);
  };

  const handleOpenResetPassword = (user: UserListItem) => {
    setResettingUser(user);
  };

  return (
    <AdminShell>
      <div className="flex-1 space-y-6 p-6">
        {/* Header */}
        <DetailPageHeader
          title="Quản lý Tài khoản & Nhân sự"
          description="Quản lý danh sách tài khoản quản trị, kỹ thuật và vận hành trạm xăng nội bộ"
          badge={
            <Badge variant="outline" className="text-primary border-primary/30 tabular-nums">
              {data?.total ?? 0} tài khoản
            </Badge>
          }
        >
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              disabled={isFetching}
              title="Làm mới"
            >
              <ArrowPathIcon className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
            </Button>
            <Button size="sm" onClick={handleOpenCreate}>
              <PlusIcon className="mr-1.5 h-4 w-4" />
              Thêm tài khoản
            </Button>
          </div>
        </DetailPageHeader>

        {/* Filter & Search Bar */}
        <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
          <div className="relative flex-1 max-w-sm">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Tìm theo mã NV, tên, username, email..."
              className="pl-9"
            />
          </div>

          <div className="flex items-center gap-2.5">
            <Select
              value={roleId}
              onValueChange={(val) => {
                setRoleId(val);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Lọc theo vai trò" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tất cả vai trò</SelectItem>
                {roles.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={status}
              onValueChange={(val) => {
                setStatus(val);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Trạng thái" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tất cả trạng thái</SelectItem>
                <SelectItem value="active">Hoạt động</SelectItem>
                <SelectItem value="locked">Bị khóa</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Data Table */}
        <UserTable
          users={data?.items || []}
          isLoading={isLoading}
          onEdit={handleOpenEdit}
          onResetPassword={handleOpenResetPassword}
          currentUserId={me?.id}
        />

        {/* Pagination */}
        {data && data.total_pages > 1 && (
          <div className="flex justify-end pt-2">
            <Paginator
              currentPage={page}
              totalPages={data.total_pages}
              showPreviousNext={true}
              onPageChange={setPage}
            />
          </div>
        )}

        {/* Create / Edit Dialog */}
        <UserDialogForm
          open={isFormOpen}
          onOpenChange={setIsFormOpen}
          user={editingUser}
        />

        {/* Reset Password Dialog */}
        <ResetPasswordDialog
          open={Boolean(resettingUser)}
          onOpenChange={(open) => !open && setResettingUser(null)}
          user={resettingUser}
        />
      </div>
    </AdminShell>
  );
}
