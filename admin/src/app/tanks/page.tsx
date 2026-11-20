import { Metadata } from 'next';
import { TankTable } from '@/features/assets/components/tank-table';

export const metadata: Metadata = {
  title: 'Bể chứa nhiên liệu - Fuel Station Admin',
  description: 'Quản lý thông số dung tích, ngưỡng cảnh báo và theo dõi tồn bể thực tế theo Lít',
};

export default function TanksPage() {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-6 p-6">
      <TankTable />
    </div>
  );
}
