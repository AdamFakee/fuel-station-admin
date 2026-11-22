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
import { useResetPassword } from '../api/reset-password';
import { UserListItem } from '../types';
import { apiErrorText } from '@/lib/api-error';

interface ResetPasswordDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: UserListItem | null;
}

export function ResetPasswordDialog({ open, onOpenChange, user }: ResetPasswordDialogProps) {
  const [newPassword, setNewPassword] = React.useState('');
  const [confirmPassword, setConfirmPassword] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);

  const resetPassword = useResetPassword();

  React.useEffect(() => {
    if (open) {
      setNewPassword('');
      setConfirmPassword('');
      setError(null);
    }
  }, [open]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (newPassword.length < 8) {
      setError('Mật khẩu mới phải từ 8 ký tự trở lên');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Mật khẩu xác nhận không khớp');
      return;
    }

    if (!user) return;

    resetPassword.mutate(
      { id: user.id, new_password: newPassword },
      {
        onSuccess: () => onOpenChange(false),
        onError: (err: any) => setError(apiErrorText(err)),
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>Đặt lại mật khẩu</DialogTitle>
          <DialogDescription>
            Đặt lại mật khẩu cho tài khoản <span className="font-semibold text-foreground">{user?.full_name}</span> ({user?.username}). Mọi phiên đăng nhập hiện tại của người dùng này sẽ bị thu hồi.
          </DialogDescription>
        </DialogHeader>

        <DialogBody>
          <form id="reset-password-form" onSubmit={handleSubmit} className="space-y-4 py-1">
            {error && (
              <div className="rounded-md bg-destructive/10 border border-destructive/20 p-2.5 text-xs text-destructive font-medium">
                {error}
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="new-password">Mật khẩu mới *</Label>
              <Input
                id="new-password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Tối thiểu 8 ký tự"
                disabled={resetPassword.isPending}
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="confirm-password">Xác nhận mật khẩu *</Label>
              <Input
                id="confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Nhập lại mật khẩu mới"
                disabled={resetPassword.isPending}
                required
              />
            </div>
          </form>
        </DialogBody>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={resetPassword.isPending}>
            Hủy
          </Button>
          <Button type="submit" form="reset-password-form" disabled={resetPassword.isPending}>
            {resetPassword.isPending ? 'Đang cập nhật...' : 'Xác nhận đặt lại'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
