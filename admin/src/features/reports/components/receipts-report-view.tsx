'use client';

import { TableEmptyRow } from '@/components/table-empty-row';
import { StatCard } from '@/components/stat-card';
import { ChartBarIcon, CheckCircleIcon } from '@heroicons/react/24/outline';
import { StatusBadge } from '@/components/status-badge';
import React from 'react';
import { ReceiptReportResponse } from '../types';
import { formatNumberVN, formatDateTimeVN } from '@/lib/format';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

interface ReceiptsReportViewProps {
  data?: ReceiptReportResponse;
  isLoading: boolean;
}

export function ReceiptsReportView({ data, isLoading }: ReceiptsReportViewProps) {
  if (isLoading) {
    return <div className="p-8 text-center text-muted-foreground">Đang tải dữ liệu bảng kê phiếu nhập...</div>;
  }

  const items = data?.items || [];

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return <StatusBadge tone="success">Đã duyệt</StatusBadge>;
      case 'pending':
        return <StatusBadge tone="warning">Chờ duyệt</StatusBadge>;
      case 'rejected':
        return <StatusBadge tone="danger">Từ chối</StatusBadge>;
      default:
        return <StatusBadge tone="neutral">Bản nháp</StatusBadge>;
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col gap-4">
      {/* Cards thống kê nhanh */}
      <div className="grid shrink-0 grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard
          label="Tổng số chuyến nhập"
          value={<>{formatNumberVN(data?.total_count || 0)}</>}
          icon={ChartBarIcon}
          tone="neutral"
        />
        <StatCard
          label="Lít theo chứng từ"
          value={<>{formatNumberVN(data?.total_document_liters || 0, 2)} L</>}
          icon={ChartBarIcon}
          tone="neutral"
        />
        <StatCard
          label="Lít thực nhận vào bể"
          value={<>{formatNumberVN(data?.total_actual_liters || 0, 2)} L</>}
          icon={CheckCircleIcon}
          tone="success"
        />
        <StatCard
          label="Tổng chênh lệch giao nhận"
          value={
            <span className={(data?.total_variance_liters || 0) < 0 ? 'text-red-600' : 'text-emerald-600'}>
              {(data?.total_variance_liters || 0) > 0 ? '+' : ''}
              {formatNumberVN(data?.total_variance_liters || 0, 2)} L
            </span>
          }
          icon={ChartBarIcon}
          tone="neutral"
        />
      </div>

      {/* Bảng kê chi tiết */}
      <div className="flex min-h-0 flex-1 flex-col rounded-md border">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="w-[130px]">Mã phiếu</TableHead>
              <TableHead className="w-[160px] text-right tabular-nums">Thời gian nhận</TableHead>
              <TableHead>Người lập / Duyệt</TableHead>
              <TableHead className="w-[120px]">Xe bồn</TableHead>
              <TableHead>Nhà cung cấp</TableHead>
              <TableHead>Bể nhận</TableHead>
              <TableHead>Nhiên liệu</TableHead>
              <TableHead className="text-right tabular-nums">Chứng từ (L)</TableHead>
              <TableHead className="text-right tabular-nums text-emerald-600 font-semibold">Thực nhận (L)</TableHead>
              <TableHead className="text-right tabular-nums">Chênh lệch (L)</TableHead>
              <TableHead className="w-[110px]">Trạng thái</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.length === 0 ? (
              <TableEmptyRow colSpan={11} title="Không có phiếu nhập nào khớp với điều kiện lọc." />
            ) : (
              items.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="font-mono text-xs font-semibold">{row.receipt_code}</TableCell>
                  <TableCell className="text-right tabular-nums text-xs">{formatDateTimeVN(row.received_at)}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    <div>{row.created_by_name}</div>
                    {row.decided_by_name && (
                      <div className="text-[11px] text-emerald-700">Duyệt: {row.decided_by_name}</div>
                    )}
                  </TableCell>
                  <TableCell className="font-semibold text-xs">{row.tanker_plate || '—'}</TableCell>
                  <TableCell className="text-xs">{row.supplier_name || '—'}</TableCell>
                  <TableCell className="font-medium text-xs">{row.tank_name}</TableCell>
                  <TableCell className="text-xs">{row.fuel_type_name}</TableCell>
                  <TableCell className="text-right tabular-nums text-xs">
                    {formatNumberVN(row.document_liters, 2)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-xs text-emerald-600 font-bold">
                    {formatNumberVN(row.actual_liters, 2)}
                  </TableCell>
                  <TableCell
                    className={`text-right tabular-nums text-xs font-medium ${
                      row.variance_liters < 0 ? 'text-destructive' : 'text-emerald-600'
                    }`}
                  >
                    {row.variance_liters > 0 ? '+' : ''}
                    {formatNumberVN(row.variance_liters, 2)}
                  </TableCell>
                  <TableCell>{getStatusBadge(row.status)}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
