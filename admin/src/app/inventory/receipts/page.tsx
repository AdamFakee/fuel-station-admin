import { Metadata } from 'next';
import { DetailPageHeader } from '@/components/detail-page-header';
import { ReceiptTable } from '@/features/inventory/components/receipt-table';

export const metadata: Metadata = {
  title: 'Phiếu nhập bể - Fuel Station Admin',
  description: 'Quản lý phiếu nhập nhiên liệu vào bể chứa theo đơn vị Lít và kiểm soát phê duyệt kép (BRD v1.6)',
};

export default function StockReceiptsPage() {
  return (
    <div className="flex-1 flex flex-col p-6 space-y-6">
      <DetailPageHeader title="Phiếu nhập bể" />

      <ReceiptTable />
    </div>
  );
}
