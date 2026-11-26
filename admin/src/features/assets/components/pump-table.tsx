'use client';

import { DetailDialog } from '@/components/detail-dialog';
import { rowClick } from '@/lib/row-click';
import { pumpDetail } from '@/lib/row-details';
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
import { PumpDetail } from '../types';
import { getPumps, usePumps } from '../api/get-pumps';
import Paginator from '@/components/paginator';
import { useDeletePump } from '../api/delete-pump';
import { useBranches } from '../api/get-branches';
import { PumpDialog } from './pump-dialog';
import { useAuth } from '@/features/auth/hooks/use-auth';
import { toast } from 'sonner';
import { showApiError } from '@/lib/api-error';
import { PUMP_STATUS, pumpStatus } from '@/lib/status-labels';

export function PumpTable() {
  const [detail, setDetail] = React.useState<PumpDetail | null>(null);
  const { hasPermission } = useAuth();
  const canCreate = hasPermission('asset.pump:create');
  const canUpdate = hasPermission('asset.pump:update');
  const canDelete = hasPermission('asset.pump:delete');
  const showActions = canUpdate || canDelete;
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(15);
  const [search, setSearch] = React.useState('');
  const [branchFilter, setBranchFilter] = React.useState('all');
  const [statusFilter, setStatusFilter] = React.useState('all');
  const [isExporting, setIsExporting] = React.useState(false);
  const [selectedPump, setSelectedPump] = React.useState<PumpDetail | null>(null);
  const [dialogOpen, setDialogOpen] = React.useState(false);

  React.useEffect(() => {
    setPage(1);
  }, [search, branchFilter, statusFilter]);

  const { data: branchData } = useBranches();
  const { data, isLoading } = usePumps({
    page,
    page_size: pageSize,
    q: search || undefined,
    branch_id: branchFilter !== 'all' ? branchFilter : undefined,
    enabled: statusFilter === 'all' ? undefined : statusFilter === 'enabled',
  });
  const deleteMutation = useDeletePump();

  const pumps = data?.data || [];
  const branches = branchData?.data || [];

  /** Xuất Excel toàn bộ trụ theo bộ lọc hiện tại (không chỉ trang đang xem): lấy từng trang 100 trụ. */
  const handleExportExcel = async () => {
    setIsExporting(true);
    try {
      const filters = {
        q: search || undefined,
        branch_id: branchFilter !== 'all' ? branchFilter : undefined,
        enabled: statusFilter === 'all' ? undefined : statusFilter === 'enabled',
      };
      const allPumps: PumpDetail[] = [];
      for (let exportPage = 1; ; exportPage++) {
        const result = await getPumps({
          ...filters,
          page: exportPage,
          page_size: 100,
        });
        allPumps.push(...result.data);
        if (allPumps.length >= result.total || result.data.length === 0) break;
      }
      await exportReportToExcel({
        filename: 'danh-sach-tru-bom',
        title: 'Danh sách trụ bơm',
        columns: [
          { header: 'Mã trụ', key: 'code', width: 18 },
          { header: 'Tên trụ', key: 'name', width: 26 },
          { header: 'Trạm xăng', key: 'branch_name', width: 26 },
          { header: 'Vòi - bể nguồn', key: 'tank_name', width: 30 },
          { header: 'Cổng COM', key: 'com_port', width: 12 },
          { header: 'Serial bộ số', key: 'serial', width: 14, align: 'right' },
          { header: 'IP máy chấm công', key: 'terminal_host', width: 18 },
          { header: 'Trạng thái', key: 'status_label', width: 14 },
        ],
        data: allPumps.map((pump) => ({
          code: pump.code,
          name: pump.name,
          branch_name: pump.branch_name,
          tank_name: pump.nozzles?.map((n) => n.tank_name).join(', ') ?? '',
          com_port: pump.sensor?.com_port ?? '',
          serial: pump.sensor?.serial ?? '',
          terminal_host: pump.terminal?.host ?? '',
          status_label: pumpStatus(pump.enabled).label,
        })),
      });
    } catch {
      toast.error('Không thể xuất Excel. Vui lòng thử lại.');
    } finally {
      setIsExporting(false);
    }
  };

  const handleCreate = () => {
    setSelectedPump(null);
    setDialogOpen(true);
  };

  const handleEdit = (pump: PumpDetail) => {
    setSelectedPump(pump);
    setDialogOpen(true);
  };

  const handleDeactivate = async (pump: PumpDetail) => {
    if (confirm(`Bạn có chắc chắn muốn ngừng hoạt động trụ bơm ${pump.name}?`)) {
      try {
        await deleteMutation.mutateAsync(pump.id);
        toast.success(`Đã ngừng hoạt động trụ bơm ${pump.name}`);
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
            Khai báo trụ mới
          </Button>
        )}
      </div>

      {/* Thanh tìm kiếm và bộ lọc */}
      <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4 lg:flex-row lg:items-center">
        <div className="relative min-w-0 flex-1">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Tìm theo mã trụ, tên trụ..."
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
            <SelectItem value="enabled">{PUMP_STATUS.enabled.label}</SelectItem>
            <SelectItem value="disabled">{PUMP_STATUS.disabled.label}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Data Table */}
      <div className="rounded-md border bg-card flex min-h-0 flex-1 flex-col">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40">
              <TableHead className="w-[100px] text-left">Mã trụ</TableHead>
              <TableHead className="w-[80px] text-right tabular-nums">Edge ID</TableHead>
              <TableHead className="text-left">Tên trụ bơm</TableHead>
              <TableHead className="text-left">Trạm xăng</TableHead>
              <TableHead className="text-left">Vòi xuất nguồn bể</TableHead>
              <TableHead className="text-left">Bộ số Montech</TableHead>
              <TableHead className="text-left">Máy chấm công</TableHead>
              <TableHead className="text-center w-[110px]">Trạng thái</TableHead>
              {showActions && <TableHead className={`${ACTION_HEAD_CLASS} w-[80px]`}>Thao tác</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableEmptyRow colSpan={showActions ? 9 : 8} loading title="Đang tải danh sách trụ bơm..." />
            ) : pumps.length === 0 ? (
              <TableEmptyRow colSpan={showActions ? 9 : 8} title="Chưa có trụ bơm nào được khai báo." />
            ) : (
              pumps.map((p) => {
                const nozzle = p.nozzles?.[0];
                return (
                  <TableRow key={p.id} className="hover:bg-muted/20" onClick={rowClick(() => setDetail(p))}>
                    <TableCell className="font-mono text-xs font-medium text-left">{p.code}</TableCell>
                    <TableCell className="text-right tabular-nums text-xs font-mono font-semibold">
                      {p.edge_pump_id}
                    </TableCell>
                    <TableCell className="text-left font-medium text-foreground">{p.name}</TableCell>
                    <TableCell className="text-left text-xs text-muted-foreground">{p.branch_name}</TableCell>
                    <TableCell className="text-left text-xs">
                      {nozzle ? (
                        <span className="font-medium">
                          Vòi {nozzle.nozzle_no}: {nozzle.tank_name}
                        </span>
                      ) : (
                        '—'
                      )}
                    </TableCell>
                    <TableCell className="text-left text-xs font-mono">
                      {p.sensor ? (
                        <span>
                          {p.sensor.com_port} (Serial: {p.sensor.serial})
                        </span>
                      ) : (
                        '—'
                      )}
                    </TableCell>
                    <TableCell className="text-left text-xs font-mono">
                      {p.terminal ? <span>{p.terminal.host}</span> : '—'}
                    </TableCell>
                    <TableCell className="text-center">
                      <StatusBadge tone={pumpStatus(p.enabled).tone}>{pumpStatus(p.enabled).label}</StatusBadge>
                    </TableCell>
                    {showActions && (
                      <TableCell className={ACTION_CELL_CLASS}>
                        <div className="flex justify-end gap-1">
                          {canDelete && p.enabled && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDeactivate(p)}
                              title="Ngừng hoạt động"
                              className="h-7 w-7 text-muted-foreground hover:text-destructive"
                            >
                              <NoSymbolIcon className="h-3.5 w-3.5" />
                            </Button>
                          )}
                          {canUpdate && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEdit(p)}
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
        description={'Trụ bơm'}
        sections={detail ? pumpDetail(detail) : []}
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

      <PumpDialog open={dialogOpen} onOpenChange={setDialogOpen} pump={selectedPump} />
    </div>
  );
}
