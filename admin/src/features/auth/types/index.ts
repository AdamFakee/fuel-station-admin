import { z } from 'zod';

export type UserRole = 'ADMIN' | 'MANAGER' | 'ACCOUNTANT' | 'IT';

export interface AuthUser {
  id: string;
  tenantId: string;
  username: string;
  fullName: string;
  email: string;
  employeeCode: string;
  role: UserRole;
  roleName: string;
  branchIds: string[];
  permissions: string[];
}

export interface RawUserResponse {
  id: string;
  tenant_id?: string;
  tenantId?: string;
  username: string;
  full_name?: string;
  fullName?: string;
  email: string;
  employee_code?: string;
  employeeCode?: string;
  role?: UserRole;
  role_code?: UserRole;
  role_name?: string;
  roleName?: string;
  branch_ids?: string[];
  branchIds?: string[];
  permissions?: string[];
}

export function mapAuthUser(raw: RawUserResponse): AuthUser {
  return {
    id: raw.id,
    tenantId: raw.tenantId || raw.tenant_id || '',
    username: raw.username,
    fullName: raw.fullName || raw.full_name || '',
    email: raw.email,
    employeeCode: raw.employeeCode || raw.employee_code || '',
    role: (raw.role || raw.role_code || 'MANAGER') as UserRole,
    roleName: raw.roleName || raw.role_name || '',
    branchIds: raw.branchIds || raw.branch_ids || [],
    permissions: raw.permissions || [],
  };
}

export const loginSchema = z.object({
  email: z.string().min(1, 'Vui lòng nhập email').email('Email không đúng định dạng'),
  password: z.string().min(6, 'Mật khẩu phải có ít nhất 6 ký tự'),
  rememberMe: z.boolean(),
});

export type LoginInput = z.infer<typeof loginSchema>;

export interface LoginResponse {
  token?: string;
  user: AuthUser;
  message?: string;
}
