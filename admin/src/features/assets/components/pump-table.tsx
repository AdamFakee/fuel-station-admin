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
import { PumpDetail } from '../types';
import { usePumps } from '../api/get-pumps';
import Paginator from '@/components/paginator';
import { useDeletePump } from '../api/delete-pump';
import { useBranches } from '../api/get-branches';
import { PumpDialog } from './pump-dialog';
import { useAuth } from '@/features/auth/hooks/use-auth';
import { toast } from 'sonner';

export function PumpTable() {
  const { isManager } = useAuth();
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(15);
  const [search, setSearch] = React.useState('');
  const [branchFilter, setBranchFilter] = React.useState('');
  const [selectedPump, setSelectedPump] = React.useState<PumpDetail | null>(null);
  const [dialogOpen, setDialogOpen] = React.useState(false);

  React.useEffect(() => {
    setPage(1);
  }, [search, branchFilter]);

  const { data: branchData } = useBranches();
  const { data, isLoading } = usePumps({
    page,
    page_size: pageSize,
    q: search || undefined,
    branch_id: branchFilter || undefined,
  });
  const deleteMutation = useDeletePump();

  const pumps = data?.data || [];
  const branches = branchData?.data || [];

  const handleCreate = () => {
    setSelectedPump(null);
    setDialogOpen(true);
  };

  const handleEdit = (pump: PumpDetail) => {
    setSelectedPump(pump);
    setDialogOpen(true);
  };

  const handleDeactivate = async (pump: PumpDetail) => {
    if (confirm(`Bạn có chắc chắn muốn ngừng vận hành trụ bơm ${pump.name}?`)) {
      try {
        await deleteMutation.mutateAsync(pump.id);
        toast.success(`Đã ngừng vận hành trụ bơm ${pump.name}`);
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
            placeholder="Tìm theo mã trụ, tên trụ..."
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
            <span>Khai báo trụ mới</span>
          </Button>
        )}
      </div>

      {/* Data Table */}
      <div className="rounded-md border bg-card flex min-h-0 flex-1 flex-col">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40">
              <TableHead className="w-[100px] text-left">Mã trụ</TableHead>
              <TableHead className="w-[80px] text-right tabular-nums">Edge ID</TableHead>
              <TableHead className="text-left">Tên trụ bơm</TableHead>
              <TableHead className="text-left">Chi nhánh</TableHead>
              <TableHead className="text-left">Vòi xuất nguồn bể</TableHead>
              <TableHead className="text-left">Bộ số Montech</TableHead>
              <TableHead className="text-left">Máy chấm công</TableHead>
              <TableHead className="text-center w-[110px]">Trạng thái</TableHead>
              {isManager && <TableHead className={`${ACTION_HEAD_CLASS} w-[80px]`}>Thao tác</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={isManager ? 9 : 8} className="h-24 text-center text-muted-foreground text-xs">
                  Đang tải danh sách trụ bơm...
                </TableCell>
              </TableRow>
            ) : pumps.length === 0 ? (
              <TableRow>
                <TableCell colSpan={isManager ? 9 : 8} className="h-24 text-center text-muted-foreground text-xs">
                  Chưa có trụ bơm nào được khai báo.
                </TableCell>
              </TableRow>
            ) : (
              pumps.map((p) => {
                const nozzle = p.nozzles?.[0];
                return (
                  <TableRow key={p.id} className="hover:bg-muted/20">
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
                      {p.terminal ? (
                        <span>
                          {p.terminal.host}
                        </span>
                      ) : (
                        '—'
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant={p.enabled ? 'default' : 'secondary'} className="text-[10px] px-2 py-0">
                        {p.enabled ? 'Sẵn sàng' : 'Vô hiệu hóa'}
                      </Badge>
                    </TableCell>
                    {isManager && (
                      <TableCell className={ACTION_CELL_CLASS}>
                        <div className="flex justify-end gap-1">
                          {p.enabled && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDeactivate(p)}
                              title="Ngừng vận hành"
                              className="h-7 w-7 text-muted-foreground hover:text-destructive"
                            >
                              <NoSymbolIcon className="h-3.5 w-3.5" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEdit(p)}
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

      <PumpDialog open={dialogOpen} onOpenChange={setDialogOpen} pump={selectedPump} />
    </div>
  );
}
