'use client';

import * as React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  ExclamationTriangleIcon,
  BookOpenIcon,
  CheckCircleIcon,
} from '@heroicons/react/24/outline';
import { formatNumberVN } from '@/lib/format';
import { TankStockItem } from '../types';
import { useTankStocks } from '../api/get-tank-stocks';
import { TankLedgerDialog } from './tank-ledger-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useBranches } from '@/features/assets/api/get-branches';
import { RotateCcwIcon } from 'lucide-react';

interface TankStockCardsProps {
  branchFilter?: string;
  onBranchFilterChange?: (branchId: string) => void;
}

export function TankStockCards({
  branchFilter = '',
  onBranchFilterChange,
}: TankStockCardsProps) {
  const { data: branchData } = useBranches();
  const branches = branchData?.data || [];
  const { data: stocks = [], isLoading } = useTankStocks(branchFilter || undefined);

  const [ledgerTank, setLedgerTank] = React.useState<TankStockItem | null>(null);
  const [ledgerOpen, setLedgerOpen] = React.useState<boolean>(false);

  return (
    <div className="space-y-4">
      {/* Bộ lọc chi nhánh */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-muted/30 rounded-lg border">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-muted-foreground whitespace-nowrap">
            Lọc theo chi nhánh:
          </span>
          <Select
            value={branchFilter || 'all'}
            onValueChange={(val) => {
              if (onBranchFilterChange) {
                onBranchFilterChange(val === 'all' ? '' : val);
              }
            }}
          >
            <SelectTrigger className="w-[200px] h-9 text-xs">
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

          {branchFilter && onBranchFilterChange && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onBranchFilterChange('')}
              className="h-9 px-2 text-xs text-muted-foreground"
            >
              <RotateCcwIcon className="h-3.5 w-3.5 mr-1" />
              Đặt lại
            </Button>
          )}
        </div>
      </div>

      {/* Grid danh sách bể */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse bg-muted/40 h-48 border-dashed" />
          ))}
        </div>
      ) : stocks.length === 0 ? (
        <div className="rounded-md border border-dashed p-12 text-center text-sm text-muted-foreground">
          Không tìm thấy bể chứa nhiên liệu nào phù hợp với bộ lọc.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {stocks.map((st) => {
            const isLow = st.is_low;
            const pct = Math.min(Math.max(st.stock_pct, 0), 100);

            return (
              <Card
                key={st.tank_id}
                className={`shadow-xs transition-all border ${
                  isLow ? 'border-rose-500/40 bg-rose-500/5' : 'bg-card hover:border-primary/40'
                }`}
              >
                <CardContent className="p-5 space-y-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm font-bold text-foreground">
                          {st.code}
                        </span>
                        <Badge variant="outline" className="text-xs">
                          {st.fuel_type_name}
                        </Badge>
                      </div>
                      <h3 className="font-semibold text-foreground text-sm mt-0.5">{st.name}</h3>
                      <span className="text-xs text-muted-foreground block">{st.branch_name}</span>
                    </div>

                    {isLow ? (
                      <Badge variant="destructive" className="flex items-center gap-1 text-[11px] shrink-0">
                        <ExclamationTriangleIcon className="h-3.5 w-3.5" />
                        Tồn thấp
                      </Badge>
                    ) : (
                      <Badge
                        variant="secondary"
                        className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 text-[11px] flex items-center gap-1 shrink-0"
                      >
                        <CheckCircleIcon className="h-3.5 w-3.5" />
                        An toàn
                      </Badge>
                    )}
                  </div>

                  {/* Thanh mức tồn kho */}
                  <div className="space-y-1.5">
                    <div className="flex items-baseline justify-between text-xs">
                      <span className="text-muted-foreground">Tồn tức thời:</span>
                      <div className="text-right">
                        <span className="text-xl font-bold text-foreground tabular-nums">
                          {formatNumberVN(st.stock_liters, 1)} L
                        </span>
                        <span className="text-xs text-muted-foreground ml-1.5 tabular-nums">
                          ({formatNumberVN(st.stock_pct, 1)}%)
                        </span>
                      </div>
                    </div>

                    <div className="w-full bg-muted rounded-full h-2.5 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          isLow ? 'bg-rose-500' : pct > 85 ? 'bg-amber-500' : 'bg-primary'
                        }`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>

                    <div className="flex justify-between text-[11px] text-muted-foreground pt-0.5">
                      <span>Ngưỡng thấp: {formatNumberVN(st.low_stock_threshold_liters)} L</span>
                      <span>Dung tích: {formatNumberVN(st.max_capacity_liters)} L</span>
                    </div>
                  </div>

                  <div className="pt-2 border-t flex justify-end">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 text-xs flex items-center gap-1.5 text-primary hover:text-primary"
                      onClick={() => {
                        setLedgerTank(st);
                        setLedgerOpen(true);
                      }}
                    >
                      <BookOpenIcon className="h-3.5 w-3.5" />
                      Xem thẻ kho chi tiết
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Dialog Thẻ kho */}
      <TankLedgerDialog
        open={ledgerOpen}
        onOpenChange={setLedgerOpen}
        tankId={ledgerTank?.tank_id || null}
        tankName={ledgerTank?.name || ''}
        fuelTypeName={ledgerTank?.fuel_type_name}
      />
    </div>
  );
}
