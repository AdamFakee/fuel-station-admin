import { Metadata } from 'next';
import { BranchTable } from '@/features/assets/components/branch-table';

export const metadata: Metadata = {
  title: 'Trạm xăng - Fuel Station Admin',
  description: 'Quản lý danh sách trạm xăng',
};

export default function BranchesPage() {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-6 p-6">
      <BranchTable />
    </div>
  );
}
