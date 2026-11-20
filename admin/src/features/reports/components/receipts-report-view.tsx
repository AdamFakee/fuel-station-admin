'use client';

import React from 'react';
import { ReceiptReportResponse } from '../types';
import { formatNumberVN, formatDateTimeVN } from '@/lib/format';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';

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
        return <Badge className="bg-emerald-600 hover:bg-emerald-600">Đã duyệt</Badge>;
      case 'pending':
        return <Badge variant="secondary" className="bg-amber-100 text-amber-800">Chờ duyệt</Badge>;
      case 'rejected':
        return <Badge variant="destructive">Từ chối</Badge>;
      default:
        return <Badge variant="outline">Nháp</Badge>;
    }
  };

  return (
    <div className="space-y-4">
      {/* Cards thống kê nhanh */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-muted/30">
          <CardContent className="pt-4">
            <div className="text-xs text-muted-foreground">Tổng số chuyến nhập</div>
            <div className="text-2xl font-bold tabular-nums mt-1">{formatNumberVN(data?.total_count || 0)}</div>
          </CardContent>
        </Card>
        <Card className="bg-muted/30">
          <CardContent className="pt-4">
            <div className="text-xs text-muted-foreground">Lít theo chứng từ</div>
            <div className="text-2xl font-bold text-slate-800 tabular-nums mt-1">
              {formatNumberVN(data?.total_document_liters || 0, 2)} L
            </div>
          </CardContent>
        </Card>
        <Card className="bg-emerald-50/50 border-emerald-100">
          <CardContent className="pt-4">
            <div className="text-xs text-emerald-800">Lít thực nhận vào bể</div>
            <div className="text-2xl font-bold text-emerald-700 tabular-nums mt-1">
              {formatNumberVN(data?.total_actual_liters || 0, 2)} L
            </div>
          </CardContent>
        </Card>
        <Card className="bg-muted/30">
          <CardContent className="pt-4">
            <div className="text-xs text-muted-foreground">Tổng chênh lệch giao nhận</div>
            <div
              className={`text-2xl font-bold tabular-nums mt-1 ${
                (data?.total_variance_liters || 0) < 0 ? 'text-destructive' : 'text-emerald-600'
              }`}
            >
              {(data?.total_variance_liters || 0) > 0 ? '+' : ''}
              {formatNumberVN(data?.total_variance_liters || 0, 2)} L
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Bảng kê chi tiết */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="w-[130px]">Mã phiếu</TableHead>
              <TableHead className="w-[160px] text-right tabular-nums">Thời gian nhận</TableHead>
              <TableHead className="w-[120px]">Xe bồn</TableHead>
              <TableHead>Nhà cung cấp</TableHead>
              <TableHead>Bể nhận</TableHead>
              <TableHead>Nhiên liệu</TableHead>
              <TableHead className="text-right tabular-nums">Chứng từ (L)</TableHead>
              <TableHead className="text-right tabular-nums text-emerald-600 font-semibold">Thực nhận (L)</TableHead>
              <TableHead className="text-right tabular-nums">Chênh lệch (L)</TableHead>
              <TableHead className="w-[110px]">Trạng thái</TableHead>
              <TableHead>Người lập / Duyệt</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={11} className="h-24 text-center text-muted-foreground">
                  Không có phiếu nhập nào khớp với điều kiện lọc.
                </TableCell>
              </TableRow>
            ) : (
              items.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="font-mono text-xs font-semibold">{row.receipt_code}</TableCell>
                  <TableCell className="text-right tabular-nums text-xs">
                    {formatDateTimeVN(row.received_at)}
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
                  <TableCell className="text-xs text-muted-foreground">
                    <div>{row.created_by_name}</div>
                    {row.decided_by_name && (
                      <div className="text-[11px] text-emerald-700">Duyệt: {row.decided_by_name}</div>
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
