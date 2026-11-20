'use client';

import * as React from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  ACTION_HEAD_CLASS,
  ACTION_CELL_CLASS,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PlusIcon, PencilSquareIcon, NoSymbolIcon } from '@heroicons/react/24/outline';
import { Tank } from '../types';
import { useTanks } from '../api/get-tanks';
import { useDeleteTank } from '../api/delete-tank';
import { useBranches } from '../api/get-branches';
import { TankDialog } from './tank-dialog';
import { useAuth } from '@/features/auth/hooks/use-auth';
import { formatNumberVN } from '@/lib/format';
import { toast } from 'sonner';
import Paginator from '@/components/paginator';

export function TankTable() {
  const { isManager } = useAuth();
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(15);
  const [search, setSearch] = React.useState('');
  const [branchFilter, setBranchFilter] = React.useState('');
  const [selectedTank, setSelectedTank] = React.useState<Tank | null>(null);
  const [dialogOpen, setDialogOpen] = React.useState(false);

  React.useEffect(() => {
    setPage(1);
  }, [search, branchFilter]);

  const { data: branchData } = useBranches();
  const { data, isLoading } = useTanks({
    page,
    page_size: pageSize,
    q: search || undefined,
    branch_id: branchFilter || undefined,
  });
  const deleteMutation = useDeleteTank();

  const tanks = data?.data || [];
  const branches = branchData?.data || [];

  const handleCreate = () => {
    setSelectedTank(null);
    setDialogOpen(true);
  };

  const handleEdit = (tank: Tank) => {
    setSelectedTank(tank);
    setDialogOpen(true);
  };

  const handleDeactivate = async (tank: Tank) => {
    if (confirm(`Bạn có chắc chắn muốn ngừng vận hành bể ${tank.name}?`)) {
      try {
        await deleteMutation.mutateAsync(tank.id);
        toast.success(`Đã ngừng vận hành bể ${tank.name}`);
      } catch (err: any) {
        toast.error(err.response?.data?.message || 'Có lỗi xảy ra');
      }
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2 max-w-lg flex-1">
          <Input
            placeholder="Tìm theo mã bể, tên bể..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 w-48 text-xs"
          />

          <select
            value={branchFilter}
            onChange={(e) => setBranchFilter(e.target.value)}
            className="flex h-9 rounded-md border border-input bg-background px-3 py-1 text-xs shadow-xs focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-ring"
          >
            <option value="">-- Tất cả chi nhánh --</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </div>

        {isManager && (
          <Button onClick={handleCreate} size="sm" className="h-9 gap-1.5 shrink-0">
            <PlusIcon className="h-4 w-4" />
            <span>Khai báo bể mới</span>
          </Button>
        )}
      </div>

      {/* Data Table */}
      <div className="rounded-md border bg-card flex min-h-0 flex-1 flex-col">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40">
              <TableHead className="w-[100px] text-left">Mã bể</TableHead>
              <TableHead className="text-left">Tên bể chứa</TableHead>
              <TableHead className="text-left">Chi nhánh</TableHead>
              <TableHead className="text-left">Nhiên liệu</TableHead>
              <TableHead className="text-right tabular-nums">Dung tích TK (Lít)</TableHead>
              <TableHead className="text-right tabular-nums">Khả dụng (Lít)</TableHead>
              <TableHead className="text-right tabular-nums font-semibold">Tồn hiện tại (Lít)</TableHead>
              <TableHead className="text-right tabular-nums">Hao hụt (%)</TableHead>
              <TableHead className="text-center w-[100px]">Trạng thái</TableHead>
              {isManager && <TableHead className={`${ACTION_HEAD_CLASS} w-[80px]`}>Thao tác</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={isManager ? 10 : 9} className="h-24 text-center text-muted-foreground text-xs">
                  Đang tải danh sách bể chứa...
                </TableCell>
              </TableRow>
            ) : tanks.length === 0 ? (
              <TableRow>
                <TableCell colSpan={isManager ? 10 : 9} className="h-24 text-center text-muted-foreground text-xs">
                  Chưa có bể chứa nào được khai báo.
                </TableCell>
              </TableRow>
            ) : (
              tanks.map((t) => {
                const currentStockL = t.current_stock_ml / 1000;
                const designCapL = t.design_capacity_ml / 1000;
                const usableCapL = t.max_usable_capacity_ml / 1000;
                const lowStockL = t.low_stock_threshold_ml / 1000;
                const isLow = currentStockL <= lowStockL;

                return (
                  <TableRow key={t.id} className="hover:bg-muted/20">
                    <TableCell className="font-mono text-xs font-medium text-left">{t.code}</TableCell>
                    <TableCell className="text-left font-medium text-foreground">{t.name}</TableCell>
                    <TableCell className="text-left text-xs text-muted-foreground">{t.branch_name}</TableCell>
                    <TableCell className="text-left">
                      <Badge variant="outline" className="text-[10px] font-mono px-1.5 py-0">
                        {t.fuel_type_name}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-xs">
                      {formatNumberVN(designCapL)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-xs">
                      {formatNumberVN(usableCapL)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-xs font-semibold">
                      <span className={isLow ? 'text-destructive font-bold' : 'text-foreground'}>
                        {formatNumberVN(currentStockL)}
                      </span>
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-xs font-mono">
                      {t.loss_tolerance_pct}%
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge
                        variant={t.status === 'active' ? 'default' : 'secondary'}
                        className="text-[10px] px-2 py-0"
                      >
                        {t.status === 'active' ? 'Vận hành' : 'Ngừng'}
                      </Badge>
                    </TableCell>
                    {isManager && (
                      <TableCell className={ACTION_CELL_CLASS}>
                        <div className="flex justify-end gap-1">
                          {t.status === 'active' && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDeactivate(t)}
                              title="Ngừng vận hành"
                              className="h-7 w-7 text-muted-foreground hover:text-destructive"
                            >
                              <NoSymbolIcon className="h-3.5 w-3.5" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEdit(t)}
                            title="Chỉnh sửa"
                            className="h-7 w-7 text-muted-foreground hover:text-foreground"
                          >
                            <PencilSquareIcon className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      <Paginator
        currentPage={page}
        pageSize={pageSize}
        totalItems={data?.total ?? 0}
        onPageChange={(p, size) => {
          setPage(p);
          setPageSize(size);
        }}
      />

      <TankDialog open={dialogOpen} onOpenChange={setDialogOpen} tank={selectedTank} />
    </div>
  );
}
