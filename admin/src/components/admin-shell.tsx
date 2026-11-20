'use client';

import * as React from 'react';
import { usePathname } from 'next/navigation';
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/app-sidebar';
import { Button } from '@/components/ui/button';
import { useMe } from '@/features/auth/api/get-me';

interface AdminShellProps {
  children: React.ReactNode;
}

export function AdminShell({ children }: AdminShellProps) {
  const pathname = usePathname();
  const isLoginPage = pathname === '/login' || pathname?.startsWith('/login/');

  if (isLoginPage) {
    return (
      <main className="min-h-screen w-full flex flex-col bg-background">
        {children}
      </main>
    );
  }

  return <AuthenticatedShell>{children}</AuthenticatedShell>;
}

/** Màn hình toàn trang khi đang kiểm tra phiên đăng nhập: chưa biết ai đang đăng nhập thì chưa hiện sidebar hay trang nào. */
function SessionCheckScreen({ failed, onRetry }: { failed: boolean; onRetry: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-background"
      data-testid="session-check-screen"
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-lg font-bold text-primary-foreground shadow-xs">
        FS
      </div>
      {failed ? (
        <>
          <p className="text-sm text-muted-foreground">Không kết nối được máy chủ.</p>
          <Button variant="outline" size="sm" onClick={onRetry}>
            Thử lại
          </Button>
        </>
      ) : (
        <>
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground">Đang kiểm tra phiên đăng nhập...</p>
        </>
      )}
    </div>
  );
}

function AuthenticatedShell({ children }: AdminShellProps) {
  const { data: user, isLoading, isError, refetch } = useMe();

  // Chưa có kết quả: không hiện trang. Lỗi 401 thì interceptor đã chuyển về /login, màn này giữ đến lúc chuyển xong.
  if (isLoading || !user) {
    return <SessionCheckScreen failed={isError && !isLoading} onRetry={() => void refetch()} />;
  }

  return (
    <SidebarProvider defaultOpen>
      <AppSidebar />
      <SidebarInset className="flex flex-col h-screen min-h-0 overflow-hidden bg-background">
        <main className="flex-1 min-h-0 flex flex-col overflow-y-auto">
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
