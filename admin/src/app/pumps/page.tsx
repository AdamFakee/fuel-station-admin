import { Metadata } from 'next';
import { PumpTable } from '@/features/assets/components/pump-table';

export const metadata: Metadata = {
  title: 'Trụ bơm & Vòi - Fuel Station Admin',
  description: 'Quản lý trụ bơm, vòi xuất nhiên liệu và kết nối trạm Edge Agent',
};

export default function PumpsPage() {
  return (
    <div className="flex-1 flex flex-col p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Trụ bơm & Vòi xuất
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Quản lý cột bơm nhiên liệu, mã định danh Edge Pump ID và liên kết nguồn cấp từ bể chứa
        </p>
      </div>

      <PumpTable />
    </div>
  );
}
