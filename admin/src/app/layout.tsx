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
  title: 'Fuel Station Admin - Starter Base',
  description: 'Nền tảng Quản trị & Điều hành - Modular Monolith Base',
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
            <Toaster position="top-right" richColors />
          </AdminShell>
        </ReactQueryProvider>
      </body>
    </html>
  );
}
