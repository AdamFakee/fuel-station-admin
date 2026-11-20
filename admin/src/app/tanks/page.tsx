import { Metadata } from 'next';
import { TankTable } from '@/features/assets/components/tank-table';

export const metadata: Metadata = {
  title: 'Bể chứa nhiên liệu - Fuel Station Admin',
  description: 'Quản lý thông số dung tích, ngưỡng cảnh báo và theo dõi tồn bể thực tế theo Lít',
};

export default function TanksPage() {
  return (
    <div className="flex-1 flex flex-col p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Bể chứa nhiên liệu
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Quản trị tài sản bể chứa, dung tích thiết kế, khả dụng tối đa và theo dõi số dư tồn kho (Lít)
        </p>
      </div>

      <TankTable />
    </div>
  );
}
