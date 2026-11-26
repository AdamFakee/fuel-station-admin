'use client';

import { ConfirmDialog } from '@/components/confirm-dialog';
import { DetailDialog } from '@/components/detail-dialog';
import { rowClick } from '@/lib/row-click';
import { branchDetail } from '@/lib/row-details';
import { TableEmptyRow } from '@/components/table-empty-row';
import { StatusBadge } from '@/components/status-badge';
import * as React from 'react';
import Paginator from '@/components/paginator';
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
import { PlusIcon, PencilSquareIcon, PauseCircleIcon, PlayCircleIcon, KeyIcon } from '@heroicons/react/24/outline';
import { StationKeyDialog } from '@/features/sync-monitor/components/station-key-dialog';
import { useSyncStations } from '@/features/sync-monitor/api/get-stations';
import { apiKeyLabel } from '@/lib/row-details';
import { Branch } from '../types';
import { useBranches } from '../api/get-branches';
import { useDeleteBranch } from '../api/delete-branch';
import { useUpdateBranch } from '../api/update-branch';
import { BranchDialog } from './branch-dialog';
import { useAuth } from '@/features/auth/hooks/use-auth';
import { formatDateVN } from '@/lib/format';
import { toast } from 'sonner';
import { showApiError } from '@/lib/api-error';
import { BRANCH_STATUS, statusStyle } from '@/lib/status-labels';

export function BranchTable() {
  const [detail, setDetail] = React.useState<Branch | null>(null);
  const { hasPermission } = useAuth();
  const canCreate = hasPermission('org.branch:create');
  const canUpdate = hasPermission('org.branch:update');
  const canDelete = hasPermission('org.branch:delete');
  // Khóa API của trạm: cấp, cấp lại, thu hồi (chỉ ADMIN)
  const canManageKey = hasPermission('sync.monitor:update');
  const [keyBranch, setKeyBranch] = React.useState<Branch | null>(null);
  // Trạng thái khóa của từng trạm để hiện ở phần chi tiết (chỉ tải khi người dùng có quyền xem trạng thái trạm)
  const showKeyColumn = hasPermission('sync.monitor:view');
  const stations = useSyncStations({ enabled: showKeyColumn });
  const stationOf = (branchId: string) => stations.data?.stations.find((st) => st.branch_id === branchId);
  const showActions = canUpdate || canDelete || canManageKey;
  // Nhãn khóa của một trạm xăng; null chỉ khi danh sách trạm chưa tải xong. Chi nhánh không có trong danh sách (đang tạm dừng,
  // chưa có trạm Edge) là chưa cấp khóa.
  const keyLabelOf = (branchId: string) => {
    if (!stations.data) return null;
    const st = stationOf(branchId);
    return apiKeyLabel(st?.has_api_key ?? false, st?.api_key_hint, st?.has_station ?? false);
  };
  const columnCount = 6 + (showKeyColumn ? 1 : 0) + 1 + (showActions ? 1 : 0);
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(15);
  const [search, setSearch] = React.useState('');
  const [selectedBranch, setSelectedBranch] = React.useState<Branch | null>(null);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [deactivateTarget, setDeactivateTarget] = React.useState<Branch | null>(null);
  const [reactivateTarget, setReactivateTarget] = React.useState<Branch | null>(null);

  React.useEffect(() => {
    setPage(1);
  }, [search]);

  const { data, isLoading } = useBranches({ q: search || undefined, page, page_size: pageSize });
  const deleteMutation = useDeleteBranch();
  const updateMutation = useUpdateBranch();

  const branches = data?.data || [];

  const handleCreate = () => {
    setSelectedBranch(null);
    setDialogOpen(true);
  };

  const handleEdit = (branch: Branch) => {
    setSelectedBranch(branch);
    setDialogOpen(true);
  };

  const handleDeactivate = async () => {
    if (!deactivateTarget) return;
    try {
      await deleteMutation.mutateAsync(deactivateTarget.id);
      toast.success(`Đã ngừng hoạt động trạm xăng ${deactivateTarget.name}`);
      setDeactivateTarget(null);
    } catch (err: any) {
      showApiError(err, 'Có lỗi xảy ra');
    }
  };

  const handleReactivate = async () => {
    const target = reactivateTarget;
    if (!target) return;
    try {
      await updateMutation.mutateAsync({
        id: target.id,
        // API cập nhật ghi đè cả bản ghi nên gửi lại đủ thông tin hiện tại
        input: {
          name: target.name,
          address: target.address,
          manager_name: target.manager_name,
          phone: target.phone,
          status: 'active',
        },
      });
      toast.success(`Đã kích hoạt lại trạm xăng ${target.name}`);
      setReactivateTarget(null);
    } catch (err: any) {
      showApiError(err, 'Có lỗi xảy ra');
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      {/* Action Header */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2 max-w-sm flex-1">
          <Input
            placeholder="Tìm theo mã, tên, địa chỉ..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 text-xs"
          />
        </div>

        {canCreate && (
          <Button onClick={handleCreate} size="sm" className="h-9 gap-1.5 shrink-0">
            <PlusIcon className="h-4 w-4" />
            <span>Thêm trạm xăng</span>
          </Button>
        )}
      </div>

      {/* Data Table */}
      <div className="rounded-md border bg-card flex min-h-0 flex-1 flex-col">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40">
              <TableHead className="w-[120px] text-left">Mã trạm xăng</TableHead>
              <TableHead className="text-left">Tên trạm xăng</TableHead>
              <TableHead className="text-left">Địa chỉ</TableHead>
              <TableHead className="text-left">Người quản lý</TableHead>
              <TableHead className="text-right tabular-nums">Số điện thoại</TableHead>
              <TableHead className="text-center w-[110px]">Trạng thái</TableHead>
              {showKeyColumn && <TableHead className="text-left w-[150px]">Khóa API</TableHead>}
              <TableHead className="text-right tabular-nums w-[120px]">Ngày tạo</TableHead>
              {showActions && <TableHead className={`${ACTION_HEAD_CLASS} w-[120px]`}>Thao tác</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableEmptyRow colSpan={columnCount} loading title="Đang tải danh sách trạm xăng..." />
            ) : branches.length === 0 ? (
              <TableEmptyRow colSpan={columnCount} title="Chưa có trạm xăng nào được khai báo." />
            ) : (
              branches.map((b) => (
                <TableRow key={b.id} className="hover:bg-muted/20" onClick={rowClick(() => setDetail(b))}>
                  <TableCell className="font-mono text-xs font-medium text-left">{b.code}</TableCell>
                  <TableCell className="text-left font-medium text-foreground">{b.name}</TableCell>
                  <TableCell className="text-left text-xs text-muted-foreground">{b.address || '—'}</TableCell>
                  <TableCell className="text-left text-xs">{b.manager_name || '—'}</TableCell>
                  <TableCell className="text-right tabular-nums text-xs font-mono">{b.phone || '—'}</TableCell>
                  <TableCell className="text-center">
                    <StatusBadge tone={statusStyle(BRANCH_STATUS, b.status).tone}>{statusStyle(BRANCH_STATUS, b.status).label}</StatusBadge>
                  </TableCell>
                  {showKeyColumn && (
                    <TableCell className="text-left">
                      {stations.isLoading ? (
                        <span className="text-xs text-muted-foreground">…</span>
                      ) : (
                        (() => {
                          const st = stationOf(b.id);
                          if (st?.has_api_key) {
                            return <StatusBadge tone="success">Đã cấp</StatusBadge>;
                          }
                          return st?.has_station ? <StatusBadge tone="neutral">Đã thu hồi</StatusBadge> : <StatusBadge tone="warning">Chưa cấp</StatusBadge>;
                        })()
                      )}
                    </TableCell>
                  )}
                  <TableCell className="text-right tabular-nums text-xs text-muted-foreground">
                    {formatDateVN(b.created_at)}
                  </TableCell>
                  {showActions && (
                    <TableCell className={ACTION_CELL_CLASS}>
                      <div className="flex justify-end gap-1">
                        {canDelete && b.status === 'active' && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setDeactivateTarget(b)}
                            title="Ngừng hoạt động"
                            className="h-7 w-7 text-amber-600 hover:text-amber-700"
                          >
                            <PauseCircleIcon className="h-4 w-4" />
                          </Button>
                        )}
                        {canUpdate && b.status === 'inactive' && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setReactivateTarget(b)}
                            title="Kích hoạt lại"
                            className="h-7 w-7 text-green-600 hover:text-green-700"
                          >
                            <PlayCircleIcon className="h-4 w-4" />
                          </Button>
                        )}
                        {canManageKey && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setKeyBranch(b)}
                            title="Khóa API của trạm"
                            className="h-7 w-7 text-muted-foreground hover:text-foreground"
                          >
                            <KeyIcon className="h-3.5 w-3.5" />
                          </Button>
                        )}
                        {canUpdate && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEdit(b)}
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
              ))
            )}
          </TableBody>
        </Table>
      <DetailDialog
        open={detail !== null}
        onOpenChange={(open) => !open && setDetail(null)}
        title={detail?.name ?? ''}
        description={'Trạm xăng'}
        layout="stacked"
        sections={
          detail
            ? [
                ...branchDetail(detail),
                ...(hasPermission('sync.monitor:view') && keyLabelOf(detail.id)
                  ? [
                      {
                        title: 'Khóa API của trạm',
                        fields: [
                          {
                            label: 'Khóa API',
                            value: <span className="font-mono">{keyLabelOf(detail.id)}</span>,
                            wide: true,
                          },
                        ],
                      },
                    ]
                  : []),
              ]
            : []
        }
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

      <BranchDialog open={dialogOpen} onOpenChange={setDialogOpen} branch={selectedBranch} />

      <ConfirmDialog
        open={deactivateTarget !== null}
        onOpenChange={(open) => !open && setDeactivateTarget(null)}
        level="destructive"
        title="Ngừng hoạt động trạm xăng"
        description={`Bạn có chắc chắn muốn ngừng hoạt động trạm xăng ${deactivateTarget?.name ?? ''}?`}
        confirmText="Ngừng hoạt động"
        loading={deleteMutation.isPending}
        onConfirm={handleDeactivate}
      />

      <ConfirmDialog
        open={reactivateTarget !== null}
        onOpenChange={(open) => !open && setReactivateTarget(null)}
        level="info"
        title="Kích hoạt lại trạm xăng"
        description={`Bạn có chắc chắn muốn kích hoạt lại trạm xăng ${reactivateTarget?.name ?? ''}?`}
        confirmText="Kích hoạt lại"
        loading={updateMutation.isPending}
        onConfirm={handleReactivate}
      />

      {canManageKey && (
        <StationKeyDialog branch={keyBranch ? { id: keyBranch.id, code: keyBranch.code, name: keyBranch.name } : null} onClose={() => setKeyBranch(null)} />
      )}
    </div>
  );
}
