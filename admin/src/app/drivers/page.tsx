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
import { ArrowUpTrayIcon, PlusIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import { ExcelImportDialog } from '@/components/excel-import/excel-import-dialog';
import { useAuth } from '@/features/auth/hooks/use-auth';
import { useCatalogsSummary } from '@/features/master/api/get-catalogs-summary';
import { useDrivers } from '@/features/master/api/get-drivers';
import { DriverTable } from '@/features/master/components/driver-table';
import { DriverDialogForm } from '@/features/master/components/driver-dialog-form';
import { DriverCredentialsDialog } from '@/features/master/components/driver-credentials-dialog';
import { DriverListItem } from '@/features/master/types';
import { useImportDrivers } from '@/features/master/api/import-drivers';
import { driverImportColumns, driverImportRowLabel } from '@/features/master/lib/driver-import-columns';

export default function DriversPage() {
  const { hasPermission } = useAuth();
  const canCreate = hasPermission('master.driver:create');
  const importDrivers = useImportDrivers();
  const [isImportOpen, setIsImportOpen] = React.useState(false);
  const canEdit = hasPermission('master.driver:update');
  const canDelete = hasPermission('master.driver:delete');

  const { data: catalogs } = useCatalogsSummary();

  // Search & Filters state
  const [search, setSearch] = React.useState('');
  const [debouncedSearch, setDebouncedSearch] = React.useState('');
  const [status, setStatus] = React.useState<string>('all');
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(15);

  React.useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const { data, isLoading } = useDrivers({
    page,
    page_size: pageSize,
    q: debouncedSearch || undefined,
    status: status !== 'all' ? status : undefined,
  });

  // Dialog states
  const [isFormOpen, setIsFormOpen] = React.useState(false);
  const [isCredsOpen, setIsCredsOpen] = React.useState(false);
  const [selectedDriver, setSelectedDriver] = React.useState<DriverListItem | null>(null);

  const handleOpenCreate = () => {
    setSelectedDriver(null);
    setIsFormOpen(true);
  };

  const handleOpenEdit = (driver: DriverListItem) => {
    setSelectedDriver(driver);
    setIsFormOpen(true);
  };

  const handleOpenManageCredentials = (driver: DriverListItem) => {
    setSelectedDriver(driver);
    setIsCredsOpen(true);
  };

  return (
    <>
      <div className="flex min-h-0 flex-1 flex-col gap-6 p-6">
        {/* Header */}
        <DetailPageHeader
          title="Danh mục Tài xế & Nhân sự"
          headerActions={
            <div className="flex items-center gap-2">
              {canCreate && (
                <Button size="sm" variant="outline" onClick={() => setIsImportOpen(true)} data-testid="btn-import-drivers">
                  <ArrowUpTrayIcon className="mr-2 h-4 w-4" />
                  Nhập từ Excel
                </Button>
              )}
              {canCreate && (
                <Button size="sm" onClick={handleOpenCreate} data-testid="btn-create-driver">
                  <PlusIcon className="mr-2 h-4 w-4" />
                  Thêm tài xế mới
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
              placeholder="Tìm theo mã NV, họ tên, SĐT, phòng ban..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
              data-testid="input-search-drivers"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Trạng thái */}
            <Select
              value={status}
              onValueChange={(val) => {
                setStatus(val);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-[150px]" data-testid="filter-driver-status">
                <SelectValue placeholder="Trạng thái" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tất cả trạng thái</SelectItem>
                <SelectItem value="active">Đang làm việc</SelectItem>
                <SelectItem value="blocked">Tạm khóa</SelectItem>
                <SelectItem value="inactive">Nghỉ việc</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Data Table */}
        <DriverTable
          drivers={data?.items || []}
          isLoading={isLoading}
          canEdit={canEdit}
          canDelete={canDelete}
          onEdit={handleOpenEdit}
          onManageCredentials={handleOpenManageCredentials}
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
        <ExcelImportDialog
        open={isImportOpen}
        onOpenChange={setIsImportOpen}
        title="Nhập tài xế từ Excel"
        templateFilename="mau-nhap-tai-xe"
        columns={driverImportColumns}
        rowLabel={driverImportRowLabel}
        onImport={(rows) => importDrivers.mutateAsync(rows)}
      />
      <DriverDialogForm
          open={isFormOpen}
          onOpenChange={setIsFormOpen}
          catalogs={catalogs}
          driver={selectedDriver}
        />

        {/* Manage Credentials / Biometrics Modal */}
        <DriverCredentialsDialog
          open={isCredsOpen}
          onOpenChange={setIsCredsOpen}
          driver={selectedDriver}
        />
      </div>
    </>
  );
}
