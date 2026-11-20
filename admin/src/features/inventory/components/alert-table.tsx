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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  CheckCircle2Icon,
  Loader2Icon,
  RotateCcwIcon,
} from 'lucide-react';
import { AlertItem } from '../types';
import { useAlerts } from '../api/get-alerts';
import { useResolveAlert } from '../api/resolve-alert';
import { useBranches } from '@/features/assets/api/get-branches';
import { formatDateTimeVN } from '@/lib/format';
import { toast } from 'sonner';

interface AlertTableProps {
  branchFilter?: string;
  onBranchFilterChange?: (branchId: string) => void;
}

const alertKindConfig: Record<
  string,
  { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }
> = {
  low_stock: { label: 'Tồn kho thấp', variant: 'destructive' },
  loss_variance: { label: 'Lệch ngưỡng hao hụt', variant: 'destructive' },
  station_offline: { label: 'Trạm mất kết nối', variant: 'default' },
  sync_error: { label: 'Lỗi đồng bộ', variant: 'secondary' },
};

export function AlertTable({ branchFilter = '', onBranchFilterChange }: AlertTableProps) {
  const [resolvedFilter, setResolvedFilter] = React.useState<string>('unresolved');

  const { data: branchData } = useBranches();
  const branches = branchData?.data || [];

  const { data: alerts = [], isLoading, refetch } = useAlerts(
    branchFilter || undefined,
    resolvedFilter === 'all' ? undefined : resolvedFilter === 'resolved'
  );

  const resolveMutation = useResolveAlert();

  const handleResolve = async (alert: AlertItem) => {
    try {
      await resolveMutation.mutateAsync(alert.id);
      toast.success('Đã giải quyết cảnh báo thành công');
      refetch();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Có lỗi khi xử lý cảnh báo';
      toast.error(msg);
    }
  };

  return (
    <div className="space-y-4">
      {/* Bộ lọc */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-muted/30 rounded-lg border">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-muted-foreground whitespace-nowrap">Trạng thái:</span>
            <Select value={resolvedFilter} onValueChange={setResolvedFilter}>
              <SelectTrigger className="w-[150px] h-9 text-xs">
                <SelectValue placeholder="Tất cả" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="unresolved">Chưa xử lý</SelectItem>
                <SelectItem value="resolved">Đã xử lý</SelectItem>
                <SelectItem value="all">Tất cả</SelectItem>
              </SelectContent>
            </Select>
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

          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setResolvedFilter('unresolved');
              if (onBranchFilterChange) onBranchFilterChange('');
            }}
            className="h-9 px-2 text-xs text-muted-foreground"
          >
            <RotateCcwIcon className="h-3.5 w-3.5 mr-1" />
            Đặt lại
          </Button>
        </div>
      </div>

      {/* Bảng danh sách alerts */}
      <div className="rounded-lg border bg-card shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[160px]">Thời gian</TableHead>
              <TableHead className="w-[160px]">Loại cảnh báo</TableHead>
              <TableHead className="w-[160px]">Chi nhánh</TableHead>
              <TableHead className="w-[160px]">Bể / Thiết bị</TableHead>
              <TableHead>Nội dung chi tiết cảnh báo</TableHead>
              <TableHead className="w-[120px] text-center">Trạng thái</TableHead>
              <TableHead className="w-[120px] text-right">Thao tác</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                  <div className="flex items-center justify-center gap-2">
                    <Loader2Icon className="h-4 w-4 animate-spin text-primary" />
                    Đang tải danh sách cảnh báo...
                  </div>
                </TableCell>
              </TableRow>
            ) : alerts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-10 text-muted-foreground">
                  <div className="flex flex-col items-center justify-center gap-1.5">
                    <CheckCircle2Icon className="h-8 w-8 text-emerald-500/80 mb-1" />
                    <p className="text-sm font-medium">Không có cảnh báo kho nào cần xử lý</p>
                    <p className="text-xs">Tất cả bể chứa đều an toàn và số liệu đối soát khớp ngưỡng.</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              alerts.map((item) => {
                const isResolved = !!item.resolved_at;
                const kindCfg = alertKindConfig[item.kind] || {
                  label: item.kind,
                  variant: 'outline' as const,
                };

                return (
                  <TableRow key={item.id} className="hover:bg-muted/40 transition-colors">
                    <TableCell className="text-xs text-muted-foreground">
                      {formatDateTimeVN(item.created_at)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={kindCfg.variant} className="text-xs font-normal">
                        {kindCfg.label}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {item.branch_name || '-'}
                    </TableCell>
                    <TableCell className="text-xs font-medium">
                      {item.tank_name || item.edge_station_name || '-'}
                    </TableCell>
                    <TableCell>
                      <div className="text-sm font-normal">{item.message}</div>
                    </TableCell>
                    <TableCell className="text-center">
                      {isResolved ? (
                        <Badge variant="outline" className="text-xs text-emerald-600 border-emerald-300">
                          Đã xử lý
                        </Badge>
                      ) : (
                        <Badge variant="destructive" className="text-xs">
                          Chưa xử lý
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {!isResolved && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 text-xs text-emerald-700 border-emerald-300 hover:bg-emerald-50"
                          disabled={resolveMutation.isPending}
                          onClick={() => handleResolve(item)}
                        >
                          Xử lý
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
