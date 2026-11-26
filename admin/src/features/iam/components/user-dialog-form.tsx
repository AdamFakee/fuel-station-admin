'use client';

import * as React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogBody,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useRoles } from '../api/get-roles';
import { useAuth } from '@/features/auth/hooks/use-auth';
import { useCreateUser } from '../api/create-user';
import { useUpdateUser } from '../api/update-user';
import { UserDetail, UserListItem } from '../types';
import { apiErrorText } from '@/lib/api-error';

interface UserDialogFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user?: UserListItem | UserDetail | null;
}

export function UserDialogForm({ open, onOpenChange, user }: UserDialogFormProps) {
  const isEdit = Boolean(user);

  const { data: allRoles = [] } = useRoles();
  const { user: currentUser } = useAuth();
  // Chỉ Quản trị hệ thống mới gán được vai trò Quản trị hệ thống (backend cũng chặn)
  const roles = allRoles.filter((r) => r.code !== 'ADMIN' || currentUser?.role === 'ADMIN');
  const createUser = useCreateUser();
  const updateUser = useUpdateUser();

  const [employeeCode, setEmployeeCode] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [fullName, setFullName] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [phone, setPhone] = React.useState('');
  const [roleId, setRoleId] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (user) {
      setEmployeeCode(user.employee_code);
      setPassword('');
      setFullName(user.full_name);
      setEmail(user.email);
      setPhone(user.phone || '');
      setRoleId(user.role_id);
      setError(null);
    } else {
      setEmployeeCode('');
      setPassword('');
      setFullName('');
      setEmail('');
      setPhone('');
      setRoleId('');
      setError(null);
    }
  }, [user, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!fullName.trim()) {
      setError('Họ và tên không được để trống');
      return;
    }
    if (!email.trim()) {
      setError('Email không được để trống');
      return;
    }
    if (!roleId) {
      setError('Vui lòng chọn vai trò');
      return;
    }

    if (isEdit && user) {
      updateUser.mutate(
        {
          id: user.id,
          data: {
            full_name: fullName.trim(),
            email: email.trim(),
            phone: phone.trim() || undefined,
            role_id: roleId,
          },
        },
        {
          onSuccess: () => onOpenChange(false),
          onError: (err: any) => setError(apiErrorText(err)),
        }
      );
    } else {
      if (password.length < 8) {
        setError('Mật khẩu khởi tạo phải từ 8 ký tự trở lên');
        return;
      }

      createUser.mutate(
        {
          password,
          full_name: fullName.trim(),
          email: email.trim(),
          phone: phone.trim() || undefined,
          role_id: roleId,
        },
        {
          onSuccess: () => onOpenChange(false),
          onError: (err: any) => setError(apiErrorText(err)),
        }
      );
    }
  };

  const isPending = createUser.isPending || updateUser.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Chỉnh sửa tài khoản' : 'Thêm tài khoản mới'}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? `Cập nhật thông tin nhân sự và phân bổ trạm xăng cho ${user?.full_name} (${user?.employee_code})`
              : 'Tạo tài khoản quản trị/vận hành và thiết lập quyền truy cập cho nhân sự'}
          </DialogDescription>
        </DialogHeader>

        <DialogBody>
          <form id="user-form" onSubmit={handleSubmit} className="space-y-4 py-1">
            {error && (
              <div className="rounded-md bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive font-medium">
                {error}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {isEdit && (
                <div className="space-y-1.5">
                  <Label htmlFor="employee_code">Mã nhân viên</Label>
                  <Input id="employee_code" value={employeeCode} disabled />
                </div>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="full_name">Họ và tên *</Label>
                <Input
                  id="full_name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Ví dụ: Nguyễn Văn A"
                  disabled={isPending}
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="phone">Số điện thoại</Label>
                <Input
                  id="phone"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="Ví dụ: 0912345678"
                  disabled={isPending}
                />
              </div>
            </div>

            {/* Tài khoản đăng nhập = email + mật khẩu. Mã nhân viên do hệ thống tự sinh. */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="email">Email đăng nhập *</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="email@petrovn.vn"
                  disabled={isPending}
                  required
                />
              </div>

              {!isEdit && (
                <div className="space-y-1.5">
                  <Label htmlFor="password">Mật khẩu khởi tạo *</Label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Tối thiểu 8 ký tự"
                    disabled={isPending}
                    required
                  />
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="role_id">Vai trò hệ thống *</Label>
              <Select value={roleId} onValueChange={(next) => next && setRoleId(next)} disabled={isPending}>
                <SelectTrigger id="role_id" className="w-full">
                  <SelectValue placeholder="Chọn vai trò" />
                </SelectTrigger>
                <SelectContent>
                  {roles.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{r.name}</span>
                        <span className="text-xs text-muted-foreground font-mono">({r.code})</span>
                        {r.is_system && (
                          <Badge variant="secondary" className="text-[10px] py-0 px-1.5">
                            Hệ thống
                          </Badge>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </form>
        </DialogBody>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            Hủy
          </Button>
          <Button type="submit" form="user-form" disabled={isPending}>
            {isPending ? 'Đang lưu...' : isEdit ? 'Lưu thay đổi' : 'Tạo tài khoản'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
