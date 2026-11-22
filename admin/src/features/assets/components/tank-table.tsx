'use client';

import { DetailDialog } from '@/components/detail-dialog';
import { rowClick } from '@/lib/row-click';
import { tankDetail } from '@/lib/row-details';
import { TableEmptyRow } from '@/components/table-empty-row';
import { StatusBadge } from '@/components/status-badge';
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
import {
  PlusIcon,
  PencilSquareIcon,
  NoSymbolIcon,
  MagnifyingGlassIcon,
  ArrowDownTrayIcon,
} from '@heroicons/react/24/outline';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { exportReportToExcel } from '@/features/reports/lib/export-excel';
import { Tank } from '../types';
import { getTanks, useTanks } from '../api/get-tanks';
import { useDeleteTank } from '../api/delete-tank';
import { useBranches } from '../api/get-branches';
import { TankDialog } from './tank-dialog';
import { useAuth } from '@/features/auth/hooks/use-auth';
import { formatNumberVN } from '@/lib/format';
import { toast } from 'sonner';
import Paginator from '@/components/paginator';
import { showApiError } from '@/lib/api-error';

export function TankTable() {
  const [detail, setDetail] = React.useState<Tank | null>(null);
  const { hasPermission } = useAuth();
  const canCreate = hasPermission('asset.tank:create');
  const canUpdate = hasPermission('asset.tank:update');
  const canDelete = hasPermission('asset.tank:delete');
  const showActions = canUpdate || canDelete;
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(15);
  const [search, setSearch] = React.useState('');
  const [branchFilter, setBranchFilter] = React.useState('all');
  const [statusFilter, setStatusFilter] = React.useState('all');
  const [isExporting, setIsExporting] = React.useState(false);
  const [selectedTank, setSelectedTank] = React.useState<Tank | null>(null);
  const [dialogOpen, setDialogOpen] = React.useState(false);

  React.useEffect(() => {
    setPage(1);
  }, [search, branchFilter, statusFilter]);

  const { data: branchData } = useBranches();
  const { data, isLoading } = useTanks({
    page,
    page_size: pageSize,
    q: search || undefined,
    branch_id: branchFilter !== 'all' ? branchFilter : undefined,
    status: statusFilter !== 'all' ? statusFilter : undefined,
  });
  const deleteMutation = useDeleteTank();

  const tanks = data?.data || [];
  const branches = branchData?.data || [];

  /** Xuất Excel toàn bộ bể theo bộ lọc hiện tại (không chỉ trang đang xem): lấy từng trang 100 bể. */
  const handleExportExcel = async () => {
    setIsExporting(true);
    try {
      const filters = {
        q: search || undefined,
        branch_id: branchFilter !== 'all' ? branchFilter : undefined,
        status: statusFilter !== 'all' ? statusFilter : undefined,
      };
      const allTanks: Tank[] = [];
      for (let exportPage = 1; ; exportPage++) {
        const result = await getTanks({
          ...filters,
          page: exportPage,
          page_size: 100,
        });
        allTanks.push(...result.data);
        if (allTanks.length >= result.total || result.data.length === 0) break;
      }
      await exportReportToExcel({
        filename: 'danh-sach-be-chua',
        title: 'Danh sách bể chứa nhiên liệu',
        columns: [
          { header: 'Mã bể', key: 'code', width: 16 },
          { header: 'Tên bể', key: 'name', width: 26 },
          { header: 'Trạm xăng', key: 'branch_name', width: 26 },
          { header: 'Nhiên liệu', key: 'fuel_type_name', width: 18 },
          {
            header: 'Dung tích thiết kế (L)',
            key: 'design_capacity_l',
            width: 20,
            align: 'right',
          },
          {
            header: 'Dung tích khả dụng (L)',
            key: 'usable_capacity_l',
            width: 20,
            align: 'right',
          },
          {
            header: 'Tồn hiện tại (L)',
            key: 'current_stock_l',
            width: 18,
            align: 'right',
          },
          {
            header: 'Hao hụt cho phép (%)',
            key: 'loss_tolerance_pct',
            width: 18,
            align: 'right',
          },
          { header: 'Trạng thái', key: 'status_label', width: 14 },
        ],
        data: allTanks.map((tank) => ({
          code: tank.code,
          name: tank.name,
          branch_name: tank.branch_name,
          fuel_type_name: tank.fuel_type_name,
          design_capacity_l: tank.design_capacity_ml / 1000,
          usable_capacity_l: tank.max_usable_capacity_ml / 1000,
          current_stock_l: tank.current_stock_ml / 1000,
          loss_tolerance_pct: tank.loss_tolerance_pct,
          status_label: tank.status === 'active' ? 'Vận hành' : 'Ngừng',
        })),
      });
    } catch {
      toast.error('Không thể xuất Excel. Vui lòng thử lại.');
    } finally {
      setIsExporting(false);
    }
  };

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
        showApiError(err, 'Có lỗi xảy ra');
      }
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      {/* Hành động của trang: xuất Excel, thêm mới (nằm trên cùng, không chen vào thanh lọc) */}
      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button variant="outline" onClick={handleExportExcel} disabled={isExporting}>
          <ArrowDownTrayIcon className="mr-2 h-4 w-4" />
          {isExporting ? 'Đang xuất...' : 'Xuất Excel'}
        </Button>
        {canCreate && (
          <Button onClick={handleCreate}>
            <PlusIcon className="mr-2 h-4 w-4" />
            Khai báo bể mới
          </Button>
        )}
      </div>

      {/* Thanh tìm kiếm và bộ lọc */}
      <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4 lg:flex-row lg:items-center">
        <div className="relative min-w-0 flex-1">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Tìm theo mã bể, tên bể..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        <Select value={branchFilter} onValueChange={setBranchFilter}>
          <SelectTrigger className="w-full lg:w-[220px]">
            <SelectValue placeholder="Trạm xăng" />
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

        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full lg:w-[190px]">
            <SelectValue placeholder="Trạng thái" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tất cả trạng thái</SelectItem>
            <SelectItem value="active">Vận hành</SelectItem>
            <SelectItem value="inactive">Ngừng</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Data Table */}
      <div className="rounded-md border bg-card flex min-h-0 flex-1 flex-col">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40">
              <TableHead className="w-[100px] text-left">Mã bể</TableHead>
              <TableHead className="text-left">Tên bể chứa</TableHead>
              <TableHead className="text-left">Trạm xăng</TableHead>
              <TableHead className="text-left">Nhiên liệu</TableHead>
              <TableHead className="text-right tabular-nums">Dung tích TK (Lít)</TableHead>
              <TableHead className="text-right tabular-nums">Khả dụng (Lít)</TableHead>
              <TableHead className="text-right tabular-nums font-semibold">Tồn hiện tại (Lít)</TableHead>
              <TableHead className="text-right tabular-nums">Hao hụt (%)</TableHead>
              <TableHead className="text-center w-[100px]">Trạng thái</TableHead>
              {showActions && <TableHead className={`${ACTION_HEAD_CLASS} w-[80px]`}>Thao tác</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableEmptyRow colSpan={showActions ? 10 : 9} loading title="Đang tải danh sách bể chứa..." />
            ) : tanks.length === 0 ? (
              <TableEmptyRow colSpan={showActions ? 10 : 9} title="Chưa có bể chứa nào được khai báo." />
            ) : (
              tanks.map((t) => {
                const currentStockL = t.current_stock_ml / 1000;
                const designCapL = t.design_capacity_ml / 1000;
                const usableCapL = t.max_usable_capacity_ml / 1000;
                const lowStockL = t.low_stock_threshold_ml / 1000;
                const isLow = currentStockL <= lowStockL;

                return (
                  <TableRow key={t.id} className="hover:bg-muted/20" onClick={rowClick(() => setDetail(t))}>
                    <TableCell className="font-mono text-xs font-medium text-left">{t.code}</TableCell>
                    <TableCell className="text-left font-medium text-foreground">{t.name}</TableCell>
                    <TableCell className="text-left text-xs text-muted-foreground">{t.branch_name}</TableCell>
                    <TableCell className="text-left">
                      <Badge variant="outline" className="text-[10px] font-mono px-1.5 py-0">
                        {t.fuel_type_name}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-xs">{formatNumberVN(designCapL)}</TableCell>
                    <TableCell className="text-right tabular-nums text-xs">{formatNumberVN(usableCapL)}</TableCell>
                    <TableCell className="text-right tabular-nums text-xs font-semibold">
                      <span className={isLow ? 'text-destructive font-bold' : 'text-foreground'}>
                        {formatNumberVN(currentStockL)}
                      </span>
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-xs font-mono">{t.loss_tolerance_pct}%</TableCell>
                    <TableCell className="text-center">
                      <StatusBadge tone={t.status === 'active' ? 'success' : 'danger'}>
                        {t.status === 'active' ? 'Vận hành' : 'Ngừng'}
                      </StatusBadge>
                    </TableCell>
                    {showActions && (
                      <TableCell className={ACTION_CELL_CLASS}>
                        <div className="flex justify-end gap-1">
                          {canDelete && t.status === 'active' && (
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
                          {canUpdate && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEdit(t)}
                            title="Chỉnh sửa"
                            className="h-7 w-7 text-muted-foreground hover:text-foreground"
                          >
                            <PencilSquareIcon className="h-3.5 w-3.5" />
                          </Button>
                          )}
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      <DetailDialog
        open={detail !== null}
        onOpenChange={(open) => !open && setDetail(null)}
        title={detail?.name ?? ''}
        description={'Bể chứa nhiên liệu'}
        sections={detail ? tankDetail(detail) : []}
      />
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
