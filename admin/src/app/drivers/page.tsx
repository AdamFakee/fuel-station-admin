'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import Paginator from '@/components/paginator';
import { ArrowDownTrayIcon, ArrowUpTrayIcon, PlusIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import { toast } from 'sonner';
import { exportReportToExcel } from '@/features/reports/lib/export-excel';
import { ExcelImportDialog } from '@/components/excel-import/excel-import-dialog';
import { useAuth } from '@/features/auth/hooks/use-auth';
import { useCatalogsSummary } from '@/features/master/api/get-catalogs-summary';
import { getDrivers, useDrivers } from '@/features/master/api/get-drivers';
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
  const [isExporting, setIsExporting] = React.useState(false);
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

  /** Xuất Excel toàn bộ tài xế theo bộ lọc hiện tại (không chỉ trang đang xem): lấy từng trang 100 người. */
  const handleExportExcel = async () => {
    setIsExporting(true);
    try {
      const filters = {
        q: debouncedSearch || undefined,
        status: status !== 'all' ? status : undefined,
      };
      const allDrivers: DriverListItem[] = [];
      for (let exportPage = 1; ; exportPage++) {
        const result = await getDrivers({
          ...filters,
          page: exportPage,
          page_size: 100,
        });
        allDrivers.push(...result.items);
        if (allDrivers.length >= result.total || result.items.length === 0) break;
      }
      const statusLabels = {
        active: 'Đang làm việc',
        blocked: 'Tạm khóa',
        inactive: 'Nghỉ việc',
      } as const;
      await exportReportToExcel({
        filename: 'danh-sach-tai-xe',
        title: 'Danh sách tài xế',
        columns: [
          { header: 'Mã NV', key: 'code', width: 14 },
          { header: 'Họ và tên', key: 'full_name', width: 28 },
          { header: 'Số điện thoại', key: 'phone', width: 16 },
          { header: 'Bộ phận', key: 'department', width: 22 },
          { header: 'Thẻ NFC', key: 'card_number', width: 16 },
          { header: 'Khuôn mặt', key: 'face', width: 12 },
          { header: 'Vân tay', key: 'fingerprint', width: 12 },
          { header: 'Trạng thái', key: 'status_label', width: 16 },
        ],
        data: allDrivers.map((driver) => ({
          code: driver.code,
          full_name: driver.full_name,
          phone: driver.phone ?? '',
          department: driver.department ?? '',
          card_number: driver.card_number ?? '',
          face: driver.has_face ? 'Đã đăng ký' : '',
          fingerprint: driver.has_fingerprint ? 'Đã đăng ký' : '',
          status_label: statusLabels[driver.status],
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
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Button variant="outline" onClick={handleExportExcel} disabled={isExporting}>
            <ArrowDownTrayIcon className="mr-2 h-4 w-4" />
            {isExporting ? 'Đang xuất...' : 'Xuất Excel'}
          </Button>
          {canCreate && (
            <Button variant="outline" onClick={() => setIsImportOpen(true)} data-testid="btn-import-drivers">
              <ArrowUpTrayIcon className="mr-2 h-4 w-4" />
              Nhập từ Excel
            </Button>
          )}
          {canCreate && (
            <Button onClick={handleOpenCreate} data-testid="btn-create-driver">
              <PlusIcon className="mr-2 h-4 w-4" />
              Thêm tài xế mới
            </Button>
          )}
        </div>

        {/* Filter Toolbar */}
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-card p-4">
          <div className="relative min-w-[240px] flex-1">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Tìm theo mã NV, họ tên, SĐT, phòng ban..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
              data-testid="input-search-drivers"
            />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Trạng thái */}
            <Select
              value={status}
              onValueChange={(val) => {
                setStatus(val);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-[190px]" data-testid="filter-driver-status">
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
        <DriverDialogForm open={isFormOpen} onOpenChange={setIsFormOpen} catalogs={catalogs} driver={selectedDriver} />

        {/* Manage Credentials / Biometrics Modal */}
        <DriverCredentialsDialog open={isCredsOpen} onOpenChange={setIsCredsOpen} driver={selectedDriver} />
      </div>
    </>
  );
}
