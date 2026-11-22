'use client';

import { useAuth } from '@/features/auth/hooks/use-auth';
import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { DetailPageHeader } from '@/components/detail-page-header';
import { Button } from '@/components/ui/button';
import { PlusIcon } from '@heroicons/react/24/outline';
import { useRoles } from '@/features/iam/api/get-roles';
import { RoleTable } from '@/features/iam/components/role-table';

export default function RolesPage() {
  const router = useRouter();
  const { hasPermission } = useAuth();
  const { data: roles = [], isLoading } = useRoles();

  return (
    <>
      <DetailPageHeader title="Vai trò & Phân quyền">
        {hasPermission('iam.role:create') && (
          <Button asChild>
            <Link href="/roles/new">
              <PlusIcon className="mr-2 h-4 w-4" />
              Tạo vai trò mới
            </Link>
          </Button>
        )}
      </DetailPageHeader>

      <div className="flex min-h-0 flex-1 flex-col gap-6 p-6">
        <RoleTable roles={roles} isLoading={isLoading} onEdit={(role) => router.push(`/roles/${role.id}`)} />
      </div>
    </>
  );
}
