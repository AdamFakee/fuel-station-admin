'use client';

import { DetailDialog } from '@/components/detail-dialog';
import { rowClick } from '@/lib/row-click';
import { stocktakeDetail } from '@/lib/row-details';
import { useAuth } from '@/features/auth/hooks/use-auth';
import { TableEmptyRow } from '@/components/table-empty-row';
import { StatusBadge, StatusTone } from '@/components/status-badge';
import { DatePicker } from '@/components/date-picker';
import * as React from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogBody,
} from '@/components/ui/dialog';
import { RulerIcon, ShieldCheckIcon, BookOpenIcon, RotateCcwIcon, PlusIcon, Loader2Icon } from 'lucide-react';
import { StockReconciliationItem, StocktakeStatus } from '../types';
import { useReconciliations } from '../api/get-reconciliations';
import { useGenerateReconciliation } from '../api/generate-reconciliation';
import { useTankStocks } from '../api/get-tank-stocks';
import { useBranches } from '@/features/assets/api/get-branches';
import { StocktakeMeasureDialog } from './stocktake-measure-dialog';
import { StocktakeConfirmDialog } from './stocktake-confirm-dialog';
import { TankLedgerDialog } from './tank-ledger-dialog';
import { formatNumberVN } from '@/lib/format';
import { toast } from 'sonner';

const statusConfig: Record<
  StocktakeStatus,
  { label: string; tone: StatusTone }
> = {
  open: { label: 'Chờ đo', tone: 'warning' },
  matched: { label: 'Khớp sổ', tone: 'success' },
  alert: { label: 'Lệch ngưỡng', tone: 'danger' },
  confirmed: { label: 'Đã chốt', tone: 'info' },
};

interface StocktakeTableProps {
  branchFilter?: string;
  onBranchFilterChange?: (branchId: string) => void;
  /** Trang tăng số này mỗi lần bấm nút "Khởi tạo kỳ đối chiếu" (nút nằm ở hàng tab của trang) để mở hộp thoại tạo. */
  createRequestId?: number;
}

export function StocktakeTable({ branchFilter = '', onBranchFilterChange, createRequestId = 0 }: StocktakeTableProps) {
  const [detail, setDetail] = React.useState<StockReconciliationItem | null>(null);
  const { hasPermission } = useAuth();
  const canMeasure = hasPermission('inventory.stocktake:update');
  const canConfirm = hasPermission('inventory.stocktake:approve');
  const [dateFilter, setDateFilter] = React.useState<string>(new Date().toISOString().split('T')[0]);
  const [statusFilter, setStatusFilter] = React.useState<string>('all');

  // Modals state
  const [measureItem, setMeasureItem] = React.useState<StockReconciliationItem | null>(null);
  const [measureOpen, setMeasureOpen] = React.useState<boolean>(false);

  const [confirmItem, setConfirmItem] = React.useState<StockReconciliationItem | null>(null);
  const [confirmOpen, setConfirmOpen] = React.useState<boolean>(false);

  const [ledgerTank, setLedgerTank] = React.useState<{ id: string; name: string; fuelName?: string } | null>(null);
  const [ledgerOpen, setLedgerOpen] = React.useState<boolean>(false);

  // Modal tạo kỳ đối chiếu
  const [createOpen, setCreateOpen] = React.useState<boolean>(false);
  const [selectedBranchId, setSelectedBranchId] = React.useState<string>('');
  const [selectedTankId, setSelectedTankId] = React.useState<string>('');
  const [periodDate, setPeriodDate] = React.useState<string>(new Date().toISOString().split('T')[0]);

  // Queries & Mutations
  const { data: branchData } = useBranches();
  const branches = branchData?.data || [];

  const { data: tankData = [] } = useTankStocks(selectedBranchId || branchFilter || undefined);

  const {
    data: recData,
    isLoading,
    refetch,
  } = useReconciliations({
    branch_id: branchFilter || undefined,
    period_date: dateFilter || undefined,
    status: statusFilter !== 'all' ? statusFilter : undefined,
  });

  const reconciliations = recData?.items || [];

  const generateMutation = useGenerateReconciliation();

  const handleOpenCreate = () => {
    setSelectedBranchId(branchFilter || branches[0]?.id || '');
    setPeriodDate(new Date().toISOString().split('T')[0]);
    setCreateOpen(true);
  };

  // Mở hộp thoại khi trang yêu cầu (so sánh ngay lúc render, không cần effect).
  const [handledCreateRequestId, setHandledCreateRequestId] = React.useState(createRequestId);
  if (createRequestId !== handledCreateRequestId) {
    setHandledCreateRequestId(createRequestId);
    handleOpenCreate();
  }

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBranchId || !selectedTankId) {
      toast.error('Vui lòng chọn trạm xăng và bể chứa để khởi tạo');
      return;
    }

    try {
      await generateMutation.mutateAsync({
        branch_id: selectedBranchId,
        tank_id: selectedTankId,
        period_date: periodDate,
      });
      toast.success('Đã khởi tạo phiếu đối chiếu kiểm kê thành công');
      setCreateOpen(false);
      refetch();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Có lỗi khi khởi tạo đối chiếu';
      toast.error(msg);
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      {/* Thanh bộ lọc */}
      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-card p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <DatePicker value={dateFilter} onChange={setDateFilter} clearable className="w-[180px]" />
          </div>

          <div className="flex items-center gap-2">
            <Select
              value={branchFilter || 'all'}
              onValueChange={(val) => {
                if (onBranchFilterChange) {
                  onBranchFilterChange(val === 'all' ? '' : val);
                }
              }}
            >
              <SelectTrigger className="w-[220px]">
                <SelectValue placeholder="Tất cả trạm xăng" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tất cả trạm xăng</SelectItem>
                {branches.map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[190px]">
                <SelectValue placeholder="Trạng thái" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tất cả trạng thái</SelectItem>
                <SelectItem value="open">Chờ đo</SelectItem>
                <SelectItem value="matched">Khớp sổ</SelectItem>
                <SelectItem value="alert">Lệch ngưỡng</SelectItem>
                <SelectItem value="confirmed">Đã chốt</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Button
            variant="ghost"
            onClick={() => {
              setDateFilter(new Date().toISOString().split('T')[0]);
              setStatusFilter('all');
              if (onBranchFilterChange) onBranchFilterChange('');
            }}
            className="text-muted-foreground"
          >
            <RotateCcwIcon className="h-3.5 w-3.5 mr-1" />
            Đặt lại
          </Button>
        </div>
      </div>

      {/* Bảng danh sách phiếu đối chiếu */}
      <div className="flex min-h-0 flex-1 flex-col rounded-lg border bg-card shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[110px]">Ngày</TableHead>
              <TableHead className="w-[180px]">Bể chứa</TableHead>
              <TableHead className="w-[160px]">Trạm xăng</TableHead>
              <TableHead className="text-right">Tồn đầu kỳ</TableHead>
              <TableHead className="text-right text-emerald-600">Nhập kỳ</TableHead>
              <TableHead className="text-right text-blue-600">Xuất bơm</TableHead>
              <TableHead className="text-right font-semibold">Tồn cuối sổ</TableHead>
              <TableHead className="text-right font-semibold">Thực đo (que)</TableHead>
              <TableHead className="text-right">Lệch (Lít / %)</TableHead>
              <TableHead className="w-[110px] text-center">Trạng thái</TableHead>
              <TableHead className="w-[140px] text-right">Thao tác</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableEmptyRow colSpan={11} loading title="Đang tải danh sách đối chiếu kiểm kê..." />
            ) : reconciliations.length === 0 ? (
              <TableEmptyRow
                colSpan={11}
                title="Chưa có phiếu đối chiếu nào trong ngày hoặc bộ lọc đã chọn"
                description='Bấm "Khởi tạo kỳ đối chiếu" để tạo danh sách đối soát cho các bể.'
              />
            ) : (
              reconciliations.map((item) => {
                const isConfirmed = item.status === 'confirmed';
                const hasMeasured = item.measured_liters !== undefined && item.measured_liters !== null;
                const statusCfg = statusConfig[item.status] || {
                  label: item.status,
                  tone: 'neutral' as const,
                };
                const varianceL = item.variance_liters ?? 0;
                const varianceP = item.variance_pct ?? 0;

                return (
                  <TableRow key={item.id} className="hover:bg-muted/40 transition-colors" onClick={rowClick(() => setDetail(item))}>
                    <TableCell className="font-mono text-xs">{item.period_date}</TableCell>
                    <TableCell>
                      <div className="font-medium text-sm">{item.tank_name}</div>
                      <div className="text-xs text-muted-foreground font-mono">{item.tank_code}</div>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{item.branch_name}</TableCell>
                    <TableCell className="text-right tabular-nums text-xs">
                      {formatNumberVN(item.opening_liters)} L
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-xs text-emerald-600 font-medium">
                      +{formatNumberVN(item.receipts_liters)} L
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-xs text-blue-600 font-medium">
                      -{formatNumberVN(item.dispensed_liters)} L
                    </TableCell>
                    <TableCell className="text-right tabular-nums font-semibold text-sm">
                      {formatNumberVN(item.book_closing_liters)} L
                    </TableCell>
                    <TableCell className="text-right tabular-nums font-medium text-sm">
                      {hasMeasured ? (
                        `${formatNumberVN(item.measured_liters!)} L`
                      ) : (
                        <span className="text-xs text-muted-foreground italic">Chưa đo</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-xs">
                      {hasMeasured ? (
                        <div className={item.status === 'alert' ? 'text-rose-600 font-bold' : 'text-foreground'}>
                          <span>
                            {varianceL > 0 ? '+' : ''}
                            {formatNumberVN(varianceL)} L
                          </span>
                          <span className="text-[11px] block opacity-80">
                            ({varianceP > 0 ? '+' : ''}
                            {varianceP.toFixed(2)}%)
                          </span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      <StatusBadge tone={statusCfg.tone}>{statusCfg.label}</StatusBadge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        {/* Nút nhập số đo: Hiện khi chưa confirmed */}
                        {canMeasure && !isConfirmed && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-primary hover:text-primary hover:bg-primary/10"
                            title="Nhập số đo que thăm thực tế"
                            onClick={() => {
                              setMeasureItem(item);
                              setMeasureOpen(true);
                            }}
                          >
                            <RulerIcon className="h-4 w-4" />
                          </Button>
                        )}

                        {/* Nút xác nhận kiểm kê: Hiện khi matched hoặc alert */}
                        {canConfirm && (item.status === 'matched' || item.status === 'alert') && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-500/10"
                            title="Kế toán xác nhận chênh lệch kiểm kê"
                            onClick={() => {
                              setConfirmItem(item);
                              setConfirmOpen(true);
                            }}
                          >
                            <ShieldCheckIcon className="h-4 w-4" />
                          </Button>
                        )}

                        {/* Nút xem thẻ kho của bể */}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-foreground"
                          title="Xem lịch sử thẻ kho của bể này"
                          onClick={() => {
                            setLedgerTank({
                              id: item.tank_id,
                              name: item.tank_name,
                            });
                            setLedgerOpen(true);
                          }}
                        >
                          <BookOpenIcon className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      <DetailDialog
        open={detail !== null}
        onOpenChange={(open) => !open && setDetail(null)}
        title={detail?.tank_name ?? ''}
        description={'Phiếu đối chiếu kiểm kê'}
        sections={detail ? stocktakeDetail(detail) : []}
      />
      </div>

      {/* Dialog tạo kỳ đối chiếu */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent size="md">
          <form onSubmit={handleCreateSubmit}>
            <DialogHeader>
              <div className="flex items-center gap-2">
                <PlusIcon className="h-5 w-5 text-primary" />
                <DialogTitle>Khởi tạo kỳ đối chiếu kiểm kê</DialogTitle>
              </div>
              <DialogDescription>Tạo bản ghi đối soát sổ sách tự động theo ngày cho bể chứa</DialogDescription>
            </DialogHeader>

            <DialogBody>
              <div className="space-y-4 py-2">
                <div className="space-y-2">
                  <Label>
                    Trạm xăng <span className="text-destructive">*</span>
                  </Label>
                  <Select
                    value={selectedBranchId}
                    onValueChange={(val) => {
                      setSelectedBranchId(val);
                      setSelectedTankId('');
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Chọn trạm xăng" />
                    </SelectTrigger>
                    <SelectContent>
                      {branches.map((b) => (
                        <SelectItem key={b.id} value={b.id}>
                          {b.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>
                    Bể chứa <span className="text-destructive">*</span>
                  </Label>
                  <Select value={selectedTankId} onValueChange={setSelectedTankId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Chọn bể chứa" />
                    </SelectTrigger>
                    <SelectContent>
                      {(tankData ?? []).map((t) => (
                        <SelectItem key={t.tank_id} value={t.tank_id}>
                          {t.name} ({t.code} - {t.fuel_type_name})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>
                    Ngày đối chiếu <span className="text-destructive">*</span>
                  </Label>
                  <DatePicker value={periodDate} onChange={setPeriodDate} />
                </div>
              </div>
            </DialogBody>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setCreateOpen(false)}
                disabled={generateMutation.isPending}
              >
                Hủy
              </Button>
              <Button type="submit" disabled={generateMutation.isPending}>
                {generateMutation.isPending ? 'Đang tạo...' : 'Tạo phiếu đối chiếu'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialogs */}
      <StocktakeMeasureDialog open={measureOpen} onOpenChange={setMeasureOpen} reconciliation={measureItem} />

      <StocktakeConfirmDialog open={confirmOpen} onOpenChange={setConfirmOpen} reconciliation={confirmItem} />

      <TankLedgerDialog
        open={ledgerOpen}
        onOpenChange={setLedgerOpen}
        tankId={ledgerTank?.id || null}
        tankName={ledgerTank?.name || ''}
        fuelTypeName={ledgerTank?.fuelName}
      />
    </div>
  );
}
