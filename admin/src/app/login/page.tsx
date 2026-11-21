import { Metadata } from 'next';
import Image from 'next/image';
import { AnimatedBlocksBackground } from '@/components/animated-blocks-background';
import { LoginForm } from '@/features/auth/components/login-form';

export const metadata: Metadata = {
  title: 'Đăng nhập - Fuel Station Admin',
  description: 'Cổng đăng nhập hệ thống quản lý trạm xăng',
};

export default function LoginPage() {
  return (
    <div className="login-backdrop fixed inset-0 overflow-hidden">
      <AnimatedBlocksBackground />

      <div className="relative z-10 flex h-full w-full items-center justify-center p-4">
        {/* Phóng to 15% so với kích thước gốc (zoom giữ nguyên bố cục) */}
        <div style={{ zoom: 1.15 }} className="w-full max-w-sm rounded-2xl border border-white/60 bg-white/85 p-8 shadow-2xl shadow-indigo-900/10 backdrop-blur-md">
          <div className="mb-6 flex flex-col items-center gap-3 text-center">
            <Image
              src="/biwase-logo.png"
              alt="BIWASE"
              width={96}
              height={116}
              priority
              className="h-auto w-20"
            />
            <h1 className="text-lg font-semibold tracking-tight text-foreground">Quản lý trạm xăng</h1>
          </div>

          <LoginForm />
        </div>
      </div>
    </div>
  );
}
