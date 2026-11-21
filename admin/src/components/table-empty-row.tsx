import * as React from 'react';
import { Loader2Icon } from 'lucide-react';
import { TableCell, TableRow } from '@/components/ui/table';
import { Empty } from '@/components/empty';

interface TableEmptyRowProps {
  colSpan: number;
  /** Đang tải: hiện vòng xoay thay cho thông báo trống. */
  loading?: boolean;
  title: string;
  description?: string;
  icon?: React.ReactNode;
}

/**
 * Dòng trạng thái trống / đang tải dùng chung cho mọi bảng.
 * Bảng không có dữ liệu vẫn giữ nguyên khung và chiếm hết chiều cao còn lại, thông báo căn giữa.
 */
export function TableEmptyRow({ colSpan, loading, title, description, icon }: TableEmptyRowProps) {
  return (
    <TableRow className="hover:bg-transparent">
      <TableCell colSpan={colSpan} data-table-empty className="h-60 whitespace-normal p-0 text-center">
        {loading ? (
          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <Loader2Icon className="h-4 w-4 animate-spin text-primary" />
            {title}
          </div>
        ) : (
          <Empty title={title} description={description} icon={icon} />
        )}
      </TableCell>
    </TableRow>
  );
}
