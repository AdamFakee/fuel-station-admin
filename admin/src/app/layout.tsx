import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Toaster } from '@/components/ui/sonner';
import { ForbiddenModal } from '@/components/forbidden-modal';
import ReactQueryProvider from '@/components/query-provider';
import { AdminShell } from '@/components/admin-shell';

const inter = Inter({
  subsets: ['latin', 'vietnamese'],
  variable: '--font-sans',
});

export const metadata: Metadata = {
  title: 'Quản lý trạm xăng',
  description: 'Hệ thống quản lý trạm xăng',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="vi" className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <ReactQueryProvider>
          <AdminShell>
            {children}
            <ForbiddenModal />
            <Toaster position="bottom-right" richColors />
          </AdminShell>
        </ReactQueryProvider>
      </body>
    </html>
  );
}
