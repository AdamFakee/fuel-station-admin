import { Metadata } from 'next';
import { BranchTable } from '@/features/assets/components/branch-table';

export const metadata: Metadata = {
  title: 'Nhà máy & Chi nhánh - Fuel Station Admin',
  description: 'Quản lý cơ cấu tổ chức, danh sách nhà máy và chi nhánh vận hành trạm nhiên liệu',
};

export default function BranchesPage() {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-6 p-6">
      <BranchTable />
    </div>
  );
}
