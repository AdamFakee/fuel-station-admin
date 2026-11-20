import { Metadata } from 'next';
import { BranchTable } from '@/features/assets/components/branch-table';

export const metadata: Metadata = {
  title: 'Nhà máy & Chi nhánh - Fuel Station Admin',
  description: 'Quản lý cơ cấu tổ chức, danh sách nhà máy và chi nhánh vận hành trạm nhiên liệu',
};

export default function BranchesPage() {
  return (
    <div className="flex-1 flex flex-col p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Nhà máy & Chi nhánh
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Khai báo và cấu hình phạm vi dữ liệu theo các nhà máy và chi nhánh trạm xăng dầu
        </p>
      </div>

      <BranchTable />
    </div>
  );
}
