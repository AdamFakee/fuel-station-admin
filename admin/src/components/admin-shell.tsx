'use client';

import * as React from 'react';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/app-sidebar';
import { useMe } from '@/features/auth/api/get-me';
import { FeedbackLauncher } from '@/features/feedback/components/feedback-launcher';

interface AdminShellProps {
  children: React.ReactNode;
}

export function AdminShell({ children }: AdminShellProps) {
  const pathname = usePathname();
  const isLoginPage = pathname === '/login' || pathname?.startsWith('/login/');

  if (isLoginPage) {
    return <main className="min-h-screen w-full flex flex-col bg-background">{children}</main>;
  }

  return <AuthenticatedShell>{children}</AuthenticatedShell>;
}

/** Màn hình toàn trang khi đang kiểm tra phiên đăng nhập: chưa biết ai đang đăng nhập thì chưa hiện sidebar hay trang nào. */
function SessionCheckScreen() {
  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-background"
      data-testid="session-check-screen"
    >
      <Image src="/biwase-logo.png" alt="BIWASE" width={56} height={68} priority className="h-16 w-auto" />
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      <p className="text-sm text-muted-foreground">Đang kiểm tra phiên đăng nhập...</p>
    </div>
  );
}

function AuthenticatedShell({ children }: AdminShellProps) {
  const router = useRouter();
  const { data: user, isLoading, isError } = useMe();

  // Chưa đăng nhập hoặc không xác thực được phiên (hết hạn, lỗi, mất kết nối): về trang đăng nhập luôn, không hỏi thử lại.
  React.useEffect(() => {
    if (isError) router.replace('/login');
  }, [isError, router]);

  // Lần đầu vào: chờ kết quả kiểm tra phiên, chưa hiện sidebar hay trang nào.
  if (isLoading || !user) {
    return <SessionCheckScreen />;
  }

  return (
    <SidebarProvider defaultOpen>
      <AppSidebar />
      <SidebarInset className="flex flex-col h-screen min-h-0 overflow-hidden bg-background">
        <main className="flex-1 min-h-0 flex flex-col overflow-y-auto">{children}</main>
        <FeedbackLauncher />
      </SidebarInset>
    </SidebarProvider>
  );
}
