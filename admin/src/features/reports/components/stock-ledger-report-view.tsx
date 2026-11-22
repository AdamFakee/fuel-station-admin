'use client';

import { TableEmptyRow } from '@/components/table-empty-row';
import React from 'react';
import { StockLedgerResponse } from '../types';
import { formatNumberVN, formatDateTimeVN } from '@/lib/format';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { DetailDialog } from '@/components/detail-dialog';
import Paginator from '@/components/paginator';
import { rowClick } from '@/lib/row-click';
import { stockLedgerLineDetail, stockSummaryDetail } from '@/lib/row-details';
import { StockLedgerLineItem, StockLedgerSummaryItem } from '../types';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface StockLedgerReportViewProps {
  data?: StockLedgerResponse;
  isLoading: boolean;
  page: number;
  pageSize: number;
  onPageChange: (page: number, pageSize: number) => void;
}

export function StockLedgerReportView({ data, isLoading, page, pageSize, onPageChange }: StockLedgerReportViewProps) {
  // Hai bảng của báo cáo này xem lần lượt: tổng hợp theo bể, hoặc thẻ kho chi tiết từng giao dịch.
  const [view, setView] = React.useState<'summary' | 'ledger'>('summary');
  const [summaryDetail, setSummaryDetail] = React.useState<StockLedgerSummaryItem | null>(null);
  const [lineDetail, setLineDetail] = React.useState<StockLedgerLineItem | null>(null);

  if (isLoading) {
    return <div className="p-8 text-center text-muted-foreground">Đang tải dữ liệu báo cáo...</div>;
  }

  const summaries = data?.summary || [];
  const ledger = data?.ledger || [];

  const totalOpening = summaries.reduce((acc, s) => acc + s.opening_liters, 0);
  const totalReceipt = summaries.reduce((acc, s) => acc + s.receipt_liters, 0);
  const totalDispense = summaries.reduce((acc, s) => acc + s.dispense_liters, 0);
  const totalIssue = summaries.reduce((acc, s) => acc + s.issue_liters, 0);
  const totalAdjust = summaries.reduce((acc, s) => acc + s.adjust_liters, 0);
  const totalClosing = summaries.reduce((acc, s) => acc + s.closing_liters, 0);

  return (
    <div className="flex h-full min-h-0 flex-col gap-4">
      <Tabs value={view} onValueChange={(next) => setView(next as 'summary' | 'ledger')}>
        <TabsList>
          <TabsTrigger value="summary">Tổng hợp theo bể</TabsTrigger>
          <TabsTrigger value="ledger">Thẻ kho chi tiết</TabsTrigger>
        </TabsList>
      </Tabs>

      {view === 'summary' && (
        <div className="flex min-h-[240px] flex-1 flex-col rounded-md border">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="w-[120px]">Mã bể</TableHead>
                <TableHead>Tên bể</TableHead>
                <TableHead>Nhiên liệu</TableHead>
                <TableHead>Trạm xăng</TableHead>
                <TableHead className="text-right tabular-nums">Dung tích (L)</TableHead>
                <TableHead className="text-right tabular-nums">Tồn đầu (L)</TableHead>
                <TableHead className="text-right tabular-nums text-emerald-600">Tổng nhập (L)</TableHead>
                <TableHead className="text-right tabular-nums text-blue-600">Cấp phát (L)</TableHead>
                <TableHead className="text-right tabular-nums text-orange-600">Xuất khác (L)</TableHead>
                <TableHead className="text-right tabular-nums">Điều chỉnh (L)</TableHead>
                <TableHead className="text-right tabular-nums font-semibold">Tồn cuối (L)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {summaries.length === 0 ? (
                <TableEmptyRow colSpan={11} title="Không có dữ liệu bể trong khoảng thời gian đã chọn." />
              ) : (
                <>
                  {summaries.map((item) => (
                    <TableRow
                      key={item.tank_id}
                      className="hover:bg-muted/20"
                      onClick={rowClick(() => setSummaryDetail(item))}
                    >
                      <TableCell className="font-mono text-xs font-semibold">{item.tank_code}</TableCell>
                      <TableCell className="font-medium">{item.tank_name}</TableCell>
                      <TableCell>{item.fuel_type_name}</TableCell>
                      <TableCell>{item.branch_name}</TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">
                        {formatNumberVN(item.capacity_liters, 2)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums font-medium">
                        {formatNumberVN(item.opening_liters, 2)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-emerald-600 font-medium">
                        {formatNumberVN(item.receipt_liters, 2)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-blue-600 font-medium">
                        {formatNumberVN(item.dispense_liters, 2)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-orange-600 font-medium">
                        {formatNumberVN(item.issue_liters, 2)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{formatNumberVN(item.adjust_liters, 2)}</TableCell>
                      <TableCell className="text-right tabular-nums font-bold text-foreground">
                        {formatNumberVN(item.closing_liters, 2)}
                      </TableCell>
                    </TableRow>
                  ))}
                  {/* Hàng tổng cộng */}
                  {/* Dính đáy khung cuộn để dòng tổng luôn hiện khi cuộn danh sách bể */}
                  <TableRow className="font-semibold [&>td]:sticky [&>td]:bottom-0 [&>td]:z-[2] [&>td]:border-t-2 [&>td]:bg-muted">
                    <TableCell colSpan={5} className="text-right font-bold">
                      TỔNG CỘNG (LÍT):
                    </TableCell>
                    <TableCell className="text-right tabular-nums font-bold">
                      {formatNumberVN(totalOpening, 2)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-emerald-600 font-bold">
                      {formatNumberVN(totalReceipt, 2)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-blue-600 font-bold">
                      {formatNumberVN(totalDispense, 2)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-orange-600 font-bold">
                      {formatNumberVN(totalIssue, 2)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums font-bold">
                      {formatNumberVN(totalAdjust, 2)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-foreground font-extrabold">
                      {formatNumberVN(totalClosing, 2)}
                    </TableCell>
                  </TableRow>
                </>
              )}
            </TableBody>
          </Table>
        </div>
      )}

      {view === 'ledger' && (
        <>
          <div className="flex min-h-[240px] flex-1 flex-col rounded-md border">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="w-[70px] text-right tabular-nums">STT</TableHead>
                  <TableHead className="w-[180px] text-right tabular-nums">Thời gian</TableHead>
                  <TableHead className="w-[120px]">Bể chứa</TableHead>
                  <TableHead className="w-[140px]">Loại nghiệp vụ</TableHead>
                  <TableHead className="w-[140px]">Mã tham chiếu</TableHead>
                  <TableHead className="text-right tabular-nums text-emerald-600">Nhập (L)</TableHead>
                  <TableHead className="text-right tabular-nums text-blue-600">Xuất (L)</TableHead>
                  <TableHead className="text-right tabular-nums font-semibold">Tồn sau (L)</TableHead>
                  <TableHead>Diễn giải / Ghi chú</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ledger.length === 0 ? (
                  <TableEmptyRow colSpan={9} title="Không có giao dịch thẻ kho trong khoảng thời gian đã chọn." />
                ) : (
                  ledger.map((line) => (
                    <TableRow key={line.id} className="hover:bg-muted/20" onClick={rowClick(() => setLineDetail(line))}>
                      <TableCell className="text-right tabular-nums text-muted-foreground">{line.seq}</TableCell>
                      <TableCell className="text-right tabular-nums text-xs">
                        {formatDateTimeVN(line.occurred_at)}
                      </TableCell>
                      <TableCell className="font-medium">{line.tank_name}</TableCell>
                      <TableCell>
                        <Badge variant={line.in_liters > 0 ? 'default' : 'secondary'} className="font-normal text-xs">
                          {line.kind_label}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono text-xs font-semibold">{line.ref_code || '—'}</TableCell>
                      <TableCell className="text-right tabular-nums text-emerald-600 font-medium">
                        {line.in_liters > 0 ? formatNumberVN(line.in_liters, 2) : '—'}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-blue-600 font-medium">
                        {line.out_liters > 0 ? formatNumberVN(line.out_liters, 2) : '—'}
                      </TableCell>
                      <TableCell className="text-right tabular-nums font-bold">
                        {formatNumberVN(line.balance_liters, 2)}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{line.note || '—'}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
          <Paginator
            className="shrink-0"
            currentPage={page}
            pageSize={pageSize}
            totalItems={data?.ledger_total ?? 0}
            onPageChange={onPageChange}
          />
        </>
      )}

      <DetailDialog
        open={summaryDetail !== null}
        onOpenChange={(open) => !open && setSummaryDetail(null)}
        title={summaryDetail?.tank_name ?? ''}
        sections={summaryDetail ? stockSummaryDetail(summaryDetail) : []}
      />
      <DetailDialog
        open={lineDetail !== null}
        onOpenChange={(open) => !open && setLineDetail(null)}
        title={lineDetail ? `${lineDetail.kind_label} · ${lineDetail.tank_name}` : ''}
        sections={lineDetail ? stockLedgerLineDetail(lineDetail) : []}
      />
    </div>
  );
}
