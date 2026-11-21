import { Metadata } from 'next';
import { IssueTable } from '@/features/inventory/components/issue-table';

export const metadata: Metadata = {
  title: 'Phiếu xuất điều chỉnh - Fuel Station Admin',
  description: 'Quản lý phiếu xuất điều chuyển nội bộ, hao hụt bốc hơi và kiểm định cột bơm (BRD v1.6)',
};

export default function StockIssuesPage() {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-6 p-6">
      <IssueTable />
    </div>
  );
}
