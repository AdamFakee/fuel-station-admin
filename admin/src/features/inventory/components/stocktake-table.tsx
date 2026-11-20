'use client';

import * as React from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogBody,
} from '@/components/ui/dialog';
import {
  RulerIcon,
  ShieldCheckIcon,
  BookOpenIcon,
  RotateCcwIcon,
  PlusIcon,
  Loader2Icon,
} from 'lucide-react';
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
  { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }
> = {
  open: { label: 'Chờ đo', variant: 'secondary' },
  matched: { label: 'Khớp sổ', variant: 'default' },
  alert: { label: 'Lệch ngưỡng', variant: 'destructive' },
  confirmed: { label: 'Đã chốt', variant: 'outline' },
};

interface StocktakeTableProps {
  branchFilter?: string;
  onBranchFilterChange?: (branchId: string) => void;
}

export function StocktakeTable({ branchFilter = '', onBranchFilterChange }: StocktakeTableProps) {
  const [dateFilter, setDateFilter] = React.useState<string>(
    new Date().toISOString().split('T')[0]
  );
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
  const [periodDate, setPeriodDate] = React.useState<string>(
    new Date().toISOString().split('T')[0]
  );

  // Queries & Mutations
  const { data: branchData } = useBranches();
  const branches = branchData?.data || [];

  const { data: tankData = [] } = useTankStocks(selectedBranchId || branchFilter || undefined);

  const { data: recData, isLoading, refetch } = useReconciliations({
    branch_id: branchFilter || undefined,
    period_date: dateFilter || undefined,
    status: statusFilter !== 'all' ? statusFilter : undefined,
  });

  const reconciliations = recData?.items || [];

  const generateMutation = useGenerateReconciliation();

  const handleOpenCreate = () => {
    setSelectedBranchId(branchFilter || (branches[0]?.id || ''));
    setPeriodDate(new Date().toISOString().split('T')[0]);
    setCreateOpen(true);
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBranchId || !selectedTankId) {
      toast.error('Vui lòng chọn chi nhánh và bể chứa để khởi tạo');
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
    <div className="space-y-4">
      {/* Thanh bộ lọc */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-muted/30 rounded-lg border">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-muted-foreground whitespace-nowrap">Ngày đối chiếu:</span>
            <Input
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="w-[155px] h-9 text-xs"
            />
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-muted-foreground whitespace-nowrap">Chi nhánh:</span>
            <Select
              value={branchFilter || 'all'}
              onValueChange={(val) => {
                if (onBranchFilterChange) {
                  onBranchFilterChange(val === 'all' ? '' : val);
                }
              }}
            >
              <SelectTrigger className="w-[180px] h-9 text-xs">
                <SelectValue placeholder="Tất cả chi nhánh" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tất cả chi nhánh</SelectItem>
                {branches.map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-muted-foreground whitespace-nowrap">Trạng thái:</span>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[140px] h-9 text-xs">
                <SelectValue placeholder="Tất cả" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tất cả</SelectItem>
                <SelectItem value="open">Chờ đo</SelectItem>
                <SelectItem value="matched">Khớp sổ</SelectItem>
                <SelectItem value="alert">Lệch ngưỡng</SelectItem>
                <SelectItem value="confirmed">Đã chốt</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setDateFilter(new Date().toISOString().split('T')[0]);
              setStatusFilter('all');
              if (onBranchFilterChange) onBranchFilterChange('');
            }}
            className="h-9 px-2 text-xs text-muted-foreground"
          >
            <RotateCcwIcon className="h-3.5 w-3.5 mr-1" />
            Đặt lại
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            onClick={handleOpenCreate}
            className="h-9 text-xs gap-1.5"
          >
            <PlusIcon className="h-3.5 w-3.5" />
            Khởi tạo kỳ đối chiếu
          </Button>
        </div>
      </div>

      {/* Bảng danh sách phiếu đối chiếu */}
      <div className="rounded-lg border bg-card shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[110px]">Ngày</TableHead>
              <TableHead className="w-[180px]">Bể chứa</TableHead>
              <TableHead className="w-[160px]">Chi nhánh</TableHead>
              <TableHead className="text-right">Tồn đầu kỳ</TableHead>
              <TableHead className="text-right">Nhập kỳ</TableHead>
              <TableHead className="text-right">Xuất bơm</TableHead>
              <TableHead className="text-right font-semibold">Tồn cuối sổ</TableHead>
              <TableHead className="text-right font-semibold">Thực đo (que)</TableHead>
              <TableHead className="text-right">Lệch (Lít / %)</TableHead>
              <TableHead className="w-[110px] text-center">Trạng thái</TableHead>
              <TableHead className="w-[140px] text-right">Thao tác</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={11} className="text-center py-8 text-muted-foreground">
                  <div className="flex items-center justify-center gap-2">
                    <Loader2Icon className="h-4 w-4 animate-spin text-primary" />
                    Đang tải danh sách đối chiếu kiểm kê...
                  </div>
                </TableCell>
              </TableRow>
            ) : reconciliations.length === 0 ? (
              <TableRow>
                <TableCell colSpan={11} className="text-center py-10 text-muted-foreground">
                  <p className="text-sm font-medium">Chưa có phiếu đối chiếu nào trong ngày hoặc bộ lọc đã chọn</p>
                  <p className="text-xs mt-1">Bấm &quot;Khởi tạo kỳ đối chiếu&quot; ở trên để tạo danh sách đối soát cho các bể.</p>
                </TableCell>
              </TableRow>
            ) : (
              reconciliations.map((item) => {
                const isConfirmed = item.status === 'confirmed';
                const hasMeasured = item.measured_liters !== undefined && item.measured_liters !== null;
                const statusCfg = statusConfig[item.status] || {
                  label: item.status,
                  variant: 'outline' as const,
                };
                const varianceL = item.variance_liters ?? 0;
                const varianceP = item.variance_pct ?? 0;

                return (
                  <TableRow key={item.id} className="hover:bg-muted/40 transition-colors">
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
                    <TableCell className="text-right tabular-nums text-xs text-amber-600 font-medium">
                      -{formatNumberVN(item.dispensed_liters)} L
                    </TableCell>
                    <TableCell className="text-right tabular-nums font-semibold text-sm">
                      {formatNumberVN(item.book_closing_liters)} L
                    </TableCell>
                    <TableCell className="text-right tabular-nums font-medium text-sm">
                      {hasMeasured ? `${formatNumberVN(item.measured_liters!)} L` : (
                        <span className="text-xs text-muted-foreground italic">Chưa đo</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-xs">
                      {hasMeasured ? (
                        <div className={item.status === 'alert' ? 'text-rose-600 font-bold' : 'text-foreground'}>
                          <span>{varianceL > 0 ? '+' : ''}{formatNumberVN(varianceL)} L</span>
                          <span className="text-[11px] block opacity-80">
                            ({varianceP > 0 ? '+' : ''}{varianceP.toFixed(2)}%)
                          </span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant={statusCfg.variant} className="text-xs whitespace-nowrap">
                        {statusCfg.label}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        {/* Nút nhập số đo: Hiện khi chưa confirmed */}
                        {!isConfirmed && (
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
                        {(item.status === 'matched' || item.status === 'alert') && (
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
              <DialogDescription>
                Tạo bản ghi đối soát sổ sách tự động theo ngày cho bể chứa
              </DialogDescription>
            </DialogHeader>

            <DialogBody>
              <div className="space-y-4 py-2">
                <div className="space-y-2">
                  <Label>Chi nhánh <span className="text-destructive">*</span></Label>
                  <Select
                    value={selectedBranchId}
                    onValueChange={(val) => {
                      setSelectedBranchId(val);
                      setSelectedTankId('');
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Chọn chi nhánh" />
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
                  <Label>Bể chứa <span className="text-destructive">*</span></Label>
                  <Select
                    value={selectedTankId}
                    onValueChange={setSelectedTankId}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Chọn bể chứa" />
                    </SelectTrigger>
                    <SelectContent>
                      {tankData.map((t) => (
                        <SelectItem key={t.tank_id} value={t.tank_id}>
                          {t.name} ({t.code} - {t.fuel_type_name})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Ngày đối chiếu <span className="text-destructive">*</span></Label>
                  <Input
                    type="date"
                    value={periodDate}
                    onChange={(e) => setPeriodDate(e.target.value)}
                    required
                  />
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
      <StocktakeMeasureDialog
        open={measureOpen}
        onOpenChange={setMeasureOpen}
        reconciliation={measureItem}
      />

      <StocktakeConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        reconciliation={confirmItem}
      />

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
