import { Metadata } from 'next';
import { IssueTable } from '@/features/inventory/components/issue-table';

export const metadata: Metadata = {
  title: 'Phiếu xuất điều chỉnh - Fuel Station Admin',
  description: 'Quản lý phiếu xuất điều chuyển nội bộ, hao hụt bốc hơi và kiểm định cột bơm (BRD v1.6)',
};

export default function StockIssuesPage() {
  return (
    <div className="flex-1 flex flex-col p-6 space-y-6">
      <IssueTable />
    </div>
  );
}
