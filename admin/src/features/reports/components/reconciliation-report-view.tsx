'use client';

import React from 'react';
import { ReconciliationReportResponse } from '../types';
import { formatNumberVN, formatDateVN } from '@/lib/format';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';

interface ReconciliationReportViewProps {
  data?: ReconciliationReportResponse;
  isLoading: boolean;
}

export function ReconciliationReportView({ data, isLoading }: ReconciliationReportViewProps) {
  if (isLoading) {
    return <div className="p-8 text-center text-muted-foreground">Đang tải báo cáo đối chiếu kiểm kê...</div>;
  }

  const items = data?.items || [];

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'confirmed':
        return <Badge className="bg-emerald-600 hover:bg-emerald-600">Đã xác nhận</Badge>;
      case 'matched':
        return <Badge className="bg-blue-600 hover:bg-blue-600">Khớp chuẩn</Badge>;
      case 'alert':
        return <Badge variant="destructive">Vượt ngưỡng</Badge>;
      default:
        return <Badge variant="outline">Mở</Badge>;
    }
  };

  return (
    <div className="space-y-4">
      {/* Quick Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-muted/30">
          <CardContent className="pt-4">
            <div className="text-xs text-muted-foreground">Tổng số biên bản kiểm kê</div>
            <div className="text-2xl font-bold tabular-nums mt-1">{formatNumberVN(data?.total_count || 0)}</div>
          </CardContent>
        </Card>
        <Card className="bg-blue-50/50 border-blue-100">
          <CardContent className="pt-4">
            <div className="text-xs text-blue-800">Khớp trong dung sai</div>
            <div className="text-2xl font-bold text-blue-700 tabular-nums mt-1">
              {formatNumberVN(data?.matched_count || 0)}
            </div>
          </CardContent>
        </Card>
        <Card className="bg-red-50/50 border-red-100">
          <CardContent className="pt-4">
            <div className="text-xs text-red-800">Cảnh báo vượt ngưỡng hao hụt</div>
            <div className="text-2xl font-bold text-destructive tabular-nums mt-1">
              {formatNumberVN(data?.alert_count || 0)}
            </div>
          </CardContent>
        </Card>
        <Card className="bg-emerald-50/50 border-emerald-100">
          <CardContent className="pt-4">
            <div className="text-xs text-emerald-800">Kế toán đã phê duyệt</div>
            <div className="text-2xl font-bold text-emerald-700 tabular-nums mt-1">
              {formatNumberVN(data?.confirmed_count || 0)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Bảng kê đối chiếu kiểm kê */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="w-[120px] text-right tabular-nums">Ngày kiểm kê</TableHead>
              <TableHead>Bể chứa</TableHead>
              <TableHead>Nhiên liệu</TableHead>
              <TableHead className="text-right tabular-nums">Tồn đầu (L)</TableHead>
              <TableHead className="text-right tabular-nums text-emerald-600">Tổng nhập (L)</TableHead>
              <TableHead className="text-right tabular-nums text-blue-600">Cấp phát (L)</TableHead>
              <TableHead className="text-right tabular-nums font-semibold">Tồn sổ sách (L)</TableHead>
              <TableHead className="text-right tabular-nums font-bold">Thực đo (L)</TableHead>
              <TableHead className="text-right tabular-nums">Chênh lệch (L)</TableHead>
              <TableHead className="text-right tabular-nums">% Lệch</TableHead>
              <TableHead className="w-[120px]">Trạng thái</TableHead>
              <TableHead>Nhân sự thực hiện</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={12} className="h-24 text-center text-muted-foreground">
                  Không có biên bản kiểm kê nào trong khoảng thời gian đã chọn.
                </TableCell>
              </TableRow>
            ) : (
              items.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="text-right tabular-nums text-xs font-medium">
                    {formatDateVN(row.period_date)}
                  </TableCell>
                  <TableCell className="text-xs font-medium">{row.tank_name}</TableCell>
                  <TableCell className="text-xs">{row.fuel_type_name}</TableCell>
                  <TableCell className="text-right tabular-nums text-xs">
                    {formatNumberVN(row.opening_liters, 2)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-xs text-emerald-600 font-medium">
                    {formatNumberVN(row.receipts_liters, 2)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-xs text-blue-600 font-medium">
                    {formatNumberVN(row.dispensed_liters, 2)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-xs font-semibold">
                    {formatNumberVN(row.book_closing_liters, 2)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-xs font-extrabold text-foreground">
                    {row.measured_liters !== null ? formatNumberVN(row.measured_liters, 2) : '—'}
                  </TableCell>
                  <TableCell
                    className={`text-right tabular-nums text-xs font-bold ${
                      (row.variance_liters || 0) < 0 ? 'text-destructive' : 'text-emerald-600'
                    }`}
                  >
                    {row.variance_liters !== null ? (
                      <>
                        {row.variance_liters > 0 ? '+' : ''}
                        {formatNumberVN(row.variance_liters, 2)}
                      </>
                    ) : (
                      '—'
                    )}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-xs">
                    {row.variance_pct !== null ? `${row.variance_pct > 0 ? '+' : ''}${formatNumberVN(row.variance_pct, 2)}%` : '—'}
                  </TableCell>
                  <TableCell>{getStatusBadge(row.status)}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {row.measured_by_name && <div>Đo: {row.measured_by_name}</div>}
                    {row.confirmed_by_name && (
                      <div className="text-[11px] text-emerald-700 font-medium">Duyệt: {row.confirmed_by_name}</div>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
