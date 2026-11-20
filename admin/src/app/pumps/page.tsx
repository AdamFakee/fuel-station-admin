import { Metadata } from 'next';
import { PumpTable } from '@/features/assets/components/pump-table';

export const metadata: Metadata = {
  title: 'Trụ bơm - Fuel Station Admin',
  description: 'Quản lý trụ bơm kèm bộ số Montech và máy chấm công Hikvision',
};

export default function PumpsPage() {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-6 p-6">
      <PumpTable />
    </div>
  );
}
