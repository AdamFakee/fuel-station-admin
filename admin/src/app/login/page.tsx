import { Metadata } from 'next';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { LoginForm } from '@/features/auth/components/login-form';
import { ShieldCheckIcon } from '@heroicons/react/24/outline';

export const metadata: Metadata = {
  title: 'Đăng nhập - Fuel Station Admin',
  description: 'Cổng đăng nhập hệ thống quản trị và vận hành trạm nhiên liệu nội bộ',
};

export default function LoginPage() {
  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4 bg-muted/30">
      <div className="w-full max-w-md space-y-6">
        {/* Brand header */}
        <div className="flex flex-col items-center text-center space-y-2">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground font-bold text-xl shadow-md">
            FS
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Fuel Station System
          </h1>
          <p className="text-sm text-muted-foreground">
            Hệ thống Quản trị & Điều hành Trạm Nhiên Liệu Nội Bộ
          </p>
          <Badge variant="outline" className="border-primary/30 text-primary gap-1">
            <ShieldCheckIcon className="h-3.5 w-3.5" />
            Bảo mật Đa Chi Nhánh (RBAC)
          </Badge>
        </div>

        {/* Login Card */}
        <Card className="shadow-lg border-border">
          <CardHeader className="space-y-1 pb-4">
            <CardTitle className="text-xl">Đăng nhập</CardTitle>
            <CardDescription>
              Nhập tên tài khoản và mật khẩu được cấp để truy cập
            </CardDescription>
          </CardHeader>
          <CardContent>
            <LoginForm />
          </CardContent>
        </Card>

        {/* Footer Notice */}
        <div className="text-center text-xs text-muted-foreground space-y-1">
          <p>Hệ thống nội bộ quản lý theo dõi thể tích (Lít) • Không có dữ liệu tiền tệ</p>
          <p className="font-mono text-[11px] text-muted-foreground/80">
            Phiên bản v1.0.0 Ready • Tiêu chuẩn Modular Monolith
          </p>
        </div>
      </div>
    </div>
  );
}
