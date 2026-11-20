'use client';

import * as React from 'react';
import { DetailPageHeader } from '@/components/detail-page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import Paginator from '@/components/paginator';
import { PlusIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import { useAuth } from '@/features/auth/hooks/use-auth';
import { useCatalogsSummary } from '@/features/master/api/get-catalogs-summary';
import { useVehicles } from '@/features/master/api/get-vehicles';
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
        {/* Header */}
        <DetailPageHeader
          title="Danh mục Xe & Phương tiện"
          headerActions={
            <div className="flex items-center gap-2">
              {canCreate && (
                <Button size="sm" onClick={handleOpenCreate} data-testid="btn-create-vehicle">
                  <PlusIcon className="mr-2 h-4 w-4" />
                  Thêm xe mới
                </Button>
              )}
            </div>
          }
        />

        {/* Filter Toolbar */}
        <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative flex-1 max-w-sm">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Tìm theo mã xe, biển số, ghi chú..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
              data-testid="input-search-vehicles"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Chi nhánh */}
            <Select
              value={branchId}
              onValueChange={(val) => {
                setBranchId(val);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-[180px]" data-testid="filter-branch">
                <SelectValue placeholder="Tất cả chi nhánh" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tất cả chi nhánh</SelectItem>
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
              <SelectTrigger className="w-[150px]" data-testid="filter-fuel">
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
              <SelectTrigger className="w-[140px]" data-testid="filter-status">
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
        <VehicleCardDialog
          open={isCardOpen}
          onOpenChange={setIsCardOpen}
          vehicle={selectedVehicle}
        />
      </div>
    </>
  );
}
