export interface UserListItem {
  id: string;
  employee_code: string;
  full_name: string;
  email: string;
  phone: string;
  username: string;
  role_id: string;
  role_code: string;
  role_name: string;
  status: 'active' | 'locked';
  must_change_password: boolean;
  branch_ids: string[];
  branch_names: string[];
  last_login_at?: string;
  created_at: string;
  updated_at: string;
}

export interface UserDetail extends UserListItem {
  branches: BranchOption[];
}

/** Tài khoản đăng nhập là email + mật khẩu; mã nhân viên do hệ thống sinh nên không gửi lên. */
export interface CreateUserInput {
  full_name: string;
  email: string;
  phone?: string;
  password: string;
  role_id: string;
  branch_ids: string[];
}

export interface UpdateUserInput {
  full_name: string;
  email: string;
  phone?: string;
  role_id: string;
  branch_ids: string[];
}

export interface UpdateUserStatusInput {
  status: 'active' | 'locked';
}

export interface ResetPasswordInput {
  new_password: string;
}

export interface RoleListItem {
  id: string;
  code: string;
  name: string;
  description: string;
  is_system: boolean;
  user_count: number;
  permission_count: number;
  created_at: string;
  updated_at: string;
}

export interface RoleDetail {
  id: string;
  code: string;
  name: string;
  description: string;
  is_system: boolean;
  permission_codes: string[];
  created_at: string;
  updated_at: string;
}

export interface CreateRoleInput {
  code: string;
  name: string;
  description?: string;
  permission_codes: string[];
}

export interface UpdateRoleInput {
  name: string;
  description?: string;
  permission_codes: string[];
}

export interface PermissionItem {
  code: string;
  module: string;
  action: 'view' | 'create' | 'update' | 'delete' | 'approve' | 'export';
  description: string;
}

export interface BranchOption {
  id: string;
  code: string;
  name: string;
  address?: string;
}

export interface UserListParams {
  page?: number;
  page_size?: number;
  q?: string;
  role_id?: string;
  status?: string;
}

export interface PagedResponse<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}
