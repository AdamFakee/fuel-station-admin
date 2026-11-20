import { Metadata } from 'next';
import { DeviceTable } from '@/features/assets/components/device-table';

export const metadata: Metadata = {
  title: 'Thiết bị & Máy chấm công - Fuel Station Admin',
  description: 'Quản lý bộ số Montech RS-485 và máy chấm công Hikvision gắn với trụ bơm',
};

export default function DevicesPage() {
  return (
    <div className="flex-1 flex flex-col p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Thiết bị & Máy chấm công
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Cấu hình cổng giao tiếp bộ số Montech (RS-485) và máy chấm công Hikvision (mật khẩu mã hóa AES-GCM)
        </p>
      </div>

      <DeviceTable />
    </div>
  );
}
