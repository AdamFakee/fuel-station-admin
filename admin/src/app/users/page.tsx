'use client';

import { useAuth } from '@/features/auth/hooks/use-auth';
import * as React from 'react';
import { DetailPageHeader } from '@/components/detail-page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import Paginator from '@/components/paginator';
import { PlusIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import { useUsers } from '@/features/iam/api/get-users';
import { useRoles } from '@/features/iam/api/get-roles';
import { useMe } from '@/features/auth/api/get-me';
import { UserTable } from '@/features/iam/components/user-table';
import { UserDialogForm } from '@/features/iam/components/user-dialog-form';
import { ResetPasswordDialog } from '@/features/iam/components/reset-password-dialog';
import { UserListItem } from '@/features/iam/types';

export default function UsersPage() {
  const { hasPermission } = useAuth();
  const { data: me } = useMe();
  const { data: roles = [] } = useRoles();

  // Search & Filters state
  const [search, setSearch] = React.useState('');
  const [debouncedSearch, setDebouncedSearch] = React.useState('');
  const [roleId, setRoleId] = React.useState<string>('all');
  const [status, setStatus] = React.useState<string>('all');
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(15);

  React.useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const { data, isLoading } = useUsers({
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
    <>
      <div className="flex min-h-0 flex-1 flex-col gap-6 p-6">
        {/* Header */}
        <DetailPageHeader title="Quản lý Tài khoản & Nhân sự">
          {hasPermission('iam.user:create') && (
            <div className="flex items-center gap-2">
              <Button size="sm" onClick={handleOpenCreate}>
                <PlusIcon className="mr-1.5 h-4 w-4" />
                Thêm tài khoản
              </Button>
            </div>
          )}
        </DetailPageHeader>

        {/* Filter & Search Bar */}
        <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
          <div className="relative flex-1 max-w-sm">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Tìm theo mã NV, tên, email..."
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
        {data && (
          <Paginator
            currentPage={page}
            pageSize={pageSize}
            totalItems={data.total}
            onPageChange={(p, size) => {
              setPage(p);
              setPageSize(size);
            }}
          />
        )}

        {/* Create / Edit Dialog */}
        <UserDialogForm open={isFormOpen} onOpenChange={setIsFormOpen} user={editingUser} />

        {/* Reset Password Dialog */}
        <ResetPasswordDialog
          open={Boolean(resettingUser)}
          onOpenChange={(open) => !open && setResettingUser(null)}
          user={resettingUser}
        />
      </div>
    </>
  );
}
