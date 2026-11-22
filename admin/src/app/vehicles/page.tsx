'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import Paginator from '@/components/paginator';
import { PlusIcon, MagnifyingGlassIcon, ArrowDownTrayIcon } from '@heroicons/react/24/outline';
import { toast } from 'sonner';
import { exportReportToExcel } from '@/features/reports/lib/export-excel';
import { useAuth } from '@/features/auth/hooks/use-auth';
import { useCatalogsSummary } from '@/features/master/api/get-catalogs-summary';
import { getVehicles, useVehicles } from '@/features/master/api/get-vehicles';
import { VehicleTable } from '@/features/master/components/vehicle-table';
import { VehicleDialogForm } from '@/features/master/components/vehicle-dialog-form';
import { VehicleCardDialog } from '@/features/master/components/vehicle-card-dialog';
import { VehicleListItem } from '@/features/master/types';

export default function VehiclesPage() {
  const { hasPermission } = useAuth();
  const canCreate = hasPermission('master.vehicle:create');
  const canEdit = hasPermission('master.vehicle:update');
  const canDelete = hasPermission('master.vehicle:delete');

  const { data: catalogs } = useCatalogsSummary();

  // Search & Filters state
  const [search, setSearch] = React.useState('');
  const [debouncedSearch, setDebouncedSearch] = React.useState('');
  const [branchId, setBranchId] = React.useState<string>('all');
  const [status, setStatus] = React.useState<string>('all');
  const [fuelTypeId, setFuelTypeId] = React.useState<string>('all');
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(15);

  React.useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const { data, isLoading } = useVehicles({
    page,
    page_size: pageSize,
    q: debouncedSearch || undefined,
    branch_id: branchId !== 'all' ? branchId : undefined,
    status: status !== 'all' ? status : undefined,
    fuel_type_id: fuelTypeId !== 'all' ? fuelTypeId : undefined,
  });

  const [isExporting, setIsExporting] = React.useState(false);

  /** Xuất Excel toàn bộ xe theo bộ lọc hiện tại (không chỉ trang đang xem): lấy từng trang 100 xe. */
  const handleExportExcel = async () => {
    setIsExporting(true);
    try {
      const filters = {
        q: debouncedSearch || undefined,
        branch_id: branchId !== 'all' ? branchId : undefined,
        status: status !== 'all' ? status : undefined,
        fuel_type_id: fuelTypeId !== 'all' ? fuelTypeId : undefined,
      };
      const allVehicles: VehicleListItem[] = [];
      for (let exportPage = 1; ; exportPage++) {
        const result = await getVehicles({
          ...filters,
          page: exportPage,
          page_size: 100,
        });
        allVehicles.push(...result.items);
        if (allVehicles.length >= result.total || result.items.length === 0) break;
      }
      await exportReportToExcel({
        filename: 'danh-sach-xe',
        title: 'Danh sách xe và phương tiện',
        columns: [
          { header: 'Mã xe', key: 'code', width: 16 },
          { header: 'Biển số', key: 'plate', width: 16 },
          { header: 'Loại xe', key: 'vehicle_type_name', width: 22 },
          { header: 'Nhiên liệu', key: 'fuel_type_name', width: 20 },
          { header: 'Thẻ NFC', key: 'card_number', width: 16 },
          { header: 'Trạm xăng được phép', key: 'branches', width: 40 },
          { header: 'Trạng thái', key: 'status_label', width: 16 },
        ],
        data: allVehicles.map((vehicle) => ({
          code: vehicle.code,
          plate: vehicle.plate,
          vehicle_type_name: vehicle.vehicle_type_name ?? '',
          fuel_type_name: vehicle.fuel_type_name,
          card_number: vehicle.card_number ?? '',
          branches: (vehicle.branch_names ?? []).join(', '),
          status_label: vehicle.status === 'active' ? 'Hoạt động' : 'Bị khóa quyền',
        })),
      });
    } catch {
      toast.error('Không thể xuất Excel. Vui lòng thử lại.');
    } finally {
      setIsExporting(false);
    }
  };

  // Dialog states
  const [isFormOpen, setIsFormOpen] = React.useState(false);
  const [isCardOpen, setIsCardOpen] = React.useState(false);
  const [selectedVehicle, setSelectedVehicle] = React.useState<VehicleListItem | null>(null);

  const handleOpenCreate = () => {
    setSelectedVehicle(null);
    setIsFormOpen(true);
  };

  const handleOpenEdit = (vehicle: VehicleListItem) => {
    setSelectedVehicle(vehicle);
    setIsFormOpen(true);
  };

  const handleOpenManageCard = (vehicle: VehicleListItem) => {
    setSelectedVehicle(vehicle);
    setIsCardOpen(true);
  };

  return (
    <>
      <div className="flex min-h-0 flex-1 flex-col gap-6 p-6">
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Button variant="outline" onClick={handleExportExcel} disabled={isExporting}>
            <ArrowDownTrayIcon className="mr-2 h-4 w-4" />
            {isExporting ? 'Đang xuất...' : 'Xuất Excel'}
          </Button>
          {canCreate && (
            <Button onClick={handleOpenCreate} data-testid="btn-create-vehicle">
              <PlusIcon className="mr-2 h-4 w-4" />
              Thêm xe mới
            </Button>
          )}
        </div>

        {/* Filter Toolbar */}
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-card p-4">
          <div className="relative min-w-[240px] flex-1">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Tìm theo mã xe, biển số, ghi chú..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
              data-testid="input-search-vehicles"
            />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Trạm xăng */}
            <Select
              value={branchId}
              onValueChange={(val) => {
                setBranchId(val);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-[200px]" data-testid="filter-branch">
                <SelectValue placeholder="Tất cả trạm xăng" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tất cả trạm xăng</SelectItem>
                {catalogs?.branches?.map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Loại nhiên liệu */}
            <Select
              value={fuelTypeId}
              onValueChange={(val) => {
                setFuelTypeId(val);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-[180px]" data-testid="filter-fuel">
                <SelectValue placeholder="Tất cả nhiên liệu" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tất cả nhiên liệu</SelectItem>
                {catalogs?.fuel_types?.map((f) => (
                  <SelectItem key={f.id} value={f.id}>
                    {f.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Trạng thái */}
            <Select
              value={status}
              onValueChange={(val) => {
                setStatus(val);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-[180px]" data-testid="filter-status">
                <SelectValue placeholder="Trạng thái" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tất cả trạng thái</SelectItem>
                <SelectItem value="active">Hoạt động</SelectItem>
                <SelectItem value="banned">Bị khóa quyền</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Data Table */}
        <VehicleTable
          vehicles={data?.items || []}
          startIndex={(page - 1) * pageSize}
          isLoading={isLoading}
          canEdit={canEdit}
          canDelete={canDelete}
          onEdit={handleOpenEdit}
          onManageCard={handleOpenManageCard}
        />

        {/* Pagination */}
        {data && (
          <Paginator
            currentPage={page}
            pageSize={pageSize}
            totalItems={data.total}
            onPageChange={(p, size) => {
              setPage(p);
              setPageSize(size);
            }}
          />
        )}

        {/* Create / Edit Form Modal */}
        <VehicleDialogForm
          open={isFormOpen}
          onOpenChange={setIsFormOpen}
          catalogs={catalogs}
          vehicle={selectedVehicle}
        />

        {/* Assign / Change NFC Card Modal */}
        <VehicleCardDialog open={isCardOpen} onOpenChange={setIsCardOpen} vehicle={selectedVehicle} />
      </div>
    </>
  );
}
