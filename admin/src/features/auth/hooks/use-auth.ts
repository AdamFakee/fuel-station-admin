'use client';

import { useMe } from '../api/get-me';
import { useLogout } from '../api/logout';
import { AuthUser, UserRole } from '../types';

export function useAuth() {
  const { data: rawUser, isLoading, error } = useMe();
  const logoutMutation = useLogout();

  // Normalize API response supporting both camelCase and snake_case
  const user: AuthUser = rawUser
    ? {
        id: (rawUser as any).id,
        tenantId: (rawUser as any).tenantId || (rawUser as any).tenant_id || '',
        username: (rawUser as any).username || '',
        fullName: (rawUser as any).fullName || (rawUser as any).full_name || '',
        email: (rawUser as any).email || '',
        employeeCode: (rawUser as any).employeeCode || (rawUser as any).employee_code || '',
        role: ((rawUser as any).role || (rawUser as any).role_code || 'MANAGER') as UserRole,
        roleName: (rawUser as any).roleName || (rawUser as any).role_name || '',
        branchIds: (rawUser as any).branchIds || (rawUser as any).branch_ids || [],
        permissions: (rawUser as any).permissions || [],
      }
    : {
        id: 'default-user',
        tenantId: 'default-tenant',
        username: 'quanly',
        fullName: 'Quản lý Trạm',
        email: 'quanly@fuelstation.vn',
        employeeCode: 'NV-0001',
        role: 'MANAGER',
        roleName: 'Quản lý',
        branchIds: [],
        permissions: [],
      };

  const role: UserRole = user.role || 'MANAGER';

  const isManager = role === 'MANAGER';
  const isAccountant = role === 'ACCOUNTANT';
  const isIT = role === 'IT';

  // Quyền chỉ dựa vào danh sách quyền backend trả về (đã gồm quyền do vai trò tùy chỉnh): không có quyền thì ẩn nút.
  const hasPermission = (permissionCode: string): boolean => user.permissions?.includes(permissionCode) ?? false;

  const hasAnyPermission = (permissionCodes: string[]): boolean => {
    if (permissionCodes.length === 0) return true;
    return permissionCodes.some((code) => hasPermission(code));
  };

  return {
    user,
    isLoading,
    isAuthenticated: !!rawUser && !error,
    role,
    isManager,
    isAccountant,
    isIT,
    hasPermission,
    hasAnyPermission,
    logout: logoutMutation.mutate,
    isLoggingOut: logoutMutation.isPending,
  };
}
