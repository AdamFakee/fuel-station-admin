import { Metadata } from 'next';
import { ReceiptTable } from '@/features/inventory/components/receipt-table';

export const metadata: Metadata = {
  title: 'Phiếu nhập bể - Fuel Station Admin',
  description: 'Quản lý phiếu nhập nhiên liệu vào bể chứa theo đơn vị Lít và kiểm soát phê duyệt kép',
};

export default function StockReceiptsPage() {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-6 p-6">
      <ReceiptTable />
    </div>
  );
}
