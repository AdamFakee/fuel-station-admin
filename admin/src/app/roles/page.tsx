'use client';

import * as React from 'react';
import { AdminShell } from '@/components/admin-shell';
import { DetailPageHeader } from '@/components/detail-page-header';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { PlusIcon, ArrowPathIcon } from '@heroicons/react/24/outline';
import { useRoles } from '@/features/iam/api/get-roles';
import { RoleTable } from '@/features/iam/components/role-table';
import { RoleDialogForm } from '@/features/iam/components/role-dialog-form';
import { RoleListItem } from '@/features/iam/types';

export default function RolesPage() {
  const { data: roles = [], isLoading, refetch, isFetching } = useRoles();

  const [isFormOpen, setIsFormOpen] = React.useState(false);
  const [editingRole, setEditingRole] = React.useState<RoleListItem | null>(null);

  const handleOpenCreate = () => {
    setEditingRole(null);
    setIsFormOpen(true);
  };

  const handleOpenEdit = (role: RoleListItem) => {
    setEditingRole(role);
    setIsFormOpen(true);
  };

  return (
    <AdminShell>
      <div className="flex-1 space-y-6 p-6">
        <DetailPageHeader
          title="Vai trò & Ma trận Phân quyền"
          description="Quản lý các vai trò hệ thống (Quản lý, Kế toán, IT) và ma trận quyền hạn theo 61 chức năng"
          badge={
            <Badge variant="outline" className="text-primary border-primary/30 tabular-nums">
              {roles.length} vai trò
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
              Tạo vai trò mới
            </Button>
          </div>
        </DetailPageHeader>

        <RoleTable
          roles={roles}
          isLoading={isLoading}
          onEdit={handleOpenEdit}
        />

        <RoleDialogForm
          open={isFormOpen}
          onOpenChange={setIsFormOpen}
          role={editingRole}
        />
      </div>
    </AdminShell>
  );
}
