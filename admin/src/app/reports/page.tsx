'use client';

import { DetailPageHeader } from '@/components/detail-page-header';
import React, { useState } from 'react';
import { DispenseReportItem, ReportFilterState, ReportTemplateType } from '@/features/reports/types';
import { useStockLedgerReport } from '@/features/reports/api/get-stock-ledger-report';
import { useReceiptsReport } from '@/features/reports/api/get-receipts-report';
import { getDispensesReport, useDispensesReport } from '@/features/reports/api/get-dispenses-report';
import { useVehicleConsumptionReport } from '@/features/reports/api/get-vehicle-consumption-report';
import { useDriverDispenseReport } from '@/features/reports/api/get-driver-dispense-report';
import { exportReportToExcel } from '@/features/reports/lib/export-excel';
import { ReportFilters } from '@/features/reports/components/report-filters';
import { StockLedgerReportView } from '@/features/reports/components/stock-ledger-report-view';
import { ReceiptsReportView } from '@/features/reports/components/receipts-report-view';
import { DispensesReportView } from '@/features/reports/components/dispenses-report-view';
import { VehicleConsumptionReportView } from '@/features/reports/components/vehicle-consumption-report-view';
import { DriverDispenseReportView } from '@/features/reports/components/driver-dispense-report-view';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FileSpreadsheet, Printer } from 'lucide-react';
import { formatNumberVN, formatDateTimeVN, formatDateVN } from '@/lib/format';

export default function ReportsPage() {
  const [template, setTemplate] = useState<ReportTemplateType>('stock-ledger');

  // Default to current month
  const now = new Date();
  const defaultToDate = now.toISOString().slice(0, 10);
  const defaultFromDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);

  const [filters, setFilters] = useState<ReportFilterState>({
    fromDate: defaultFromDate,
    toDate: defaultToDate,
  });

  // Phân trang riêng cho hai bảng dài; đổi bộ lọc thì về trang 1
  const [ledgerPage, setLedgerPage] = useState({ page: 1, pageSize: 50 });
  const [dispensePage, setDispensePage] = useState({ page: 1, pageSize: 50 });
  const changeFilters = (next: ReportFilterState) => {
    setFilters(next);
    setLedgerPage((p) => ({ ...p, page: 1 }));
    setDispensePage((p) => ({ ...p, page: 1 }));
  };

  // Queries for each template
  const stockLedgerQuery = useStockLedgerReport({
    branch_id: filters.branchId,
    tank_id: filters.tankId,
    from_date: filters.fromDate,
    to_date: filters.toDate,
    page: ledgerPage.page,
    page_size: ledgerPage.pageSize,
  });

  const receiptsQuery = useReceiptsReport({
    branch_id: filters.branchId,
    tank_id: filters.tankId,
    status: filters.status,
    from_date: filters.fromDate,
    to_date: filters.toDate,
  });

  const dispensesQuery = useDispensesReport({
    branch_id: filters.branchId,
    tank_id: filters.tankId,
    status: filters.status,
    from_date: filters.fromDate,
    to_date: filters.toDate,
    page: dispensePage.page,
    page_size: dispensePage.pageSize,
  });

  const vehicleConsumptionQuery = useVehicleConsumptionReport({
    branch_id: filters.branchId,
    from_date: filters.fromDate,
    to_date: filters.toDate,
  });

  const driverDispenseQuery = useDriverDispenseReport({
    branch_id: filters.branchId,
    from_date: filters.fromDate,
    to_date: filters.toDate,
  });

  const handlePrint = () => {
    window.print();
  };

  const handleExportExcel = async () => {
    const dateRangeStr = `${filters.fromDate ? formatDateVN(filters.fromDate) : 'Đầu kỳ'} - ${
      filters.toDate ? formatDateVN(filters.toDate) : 'Hiện tại'
    }`;

    switch (template) {
      case 'stock-ledger': {
        const summaries = stockLedgerQuery.data?.summary || [];
        const columns = [
          { header: 'Mã bể', key: 'tank_code', width: 14 },
          { header: 'Tên bể', key: 'tank_name', width: 22 },
          { header: 'Nhiên liệu', key: 'fuel_type_name', width: 16 },
          { header: 'Trạm xăng', key: 'branch_name', width: 20 },
          { header: 'Dung tích (L)', key: 'capacity_liters', width: 16, align: 'right' as const },
          { header: 'Tồn đầu (L)', key: 'opening_liters', width: 16, align: 'right' as const },
          { header: 'Tổng nhập (L)', key: 'receipt_liters', width: 16, align: 'right' as const },
          { header: 'Tổng xuất cấp (L)', key: 'dispense_liters', width: 18, align: 'right' as const },
          { header: 'Xuất khác (L)', key: 'issue_liters', width: 16, align: 'right' as const },
          { header: 'Điều chỉnh (L)', key: 'adjust_liters', width: 16, align: 'right' as const },
          { header: 'Tồn cuối (L)', key: 'closing_liters', width: 16, align: 'right' as const },
        ];
        const data = summaries.map((s) => ({
          ...s,
          capacity_liters: formatNumberVN(s.capacity_liters, 2),
          opening_liters: formatNumberVN(s.opening_liters, 2),
          receipt_liters: formatNumberVN(s.receipt_liters, 2),
          dispense_liters: formatNumberVN(s.dispense_liters, 2),
          issue_liters: formatNumberVN(s.issue_liters, 2),
          adjust_liters: formatNumberVN(s.adjust_liters, 2),
          closing_liters: formatNumberVN(s.closing_liters, 2),
        }));
        await exportReportToExcel({
          filename: 'Bao_cao_nhap_xuat_ton_be',
          title: 'BÁO CÁO TỔNG HỢP NHẬP – XUẤT – TỒN VÀ THẺ KHO',
          dateRangeStr,
          columns,
          data,
        });
        break;
      }
      case 'receipts': {
        const items = receiptsQuery.data?.items || [];
        const columns = [
          { header: 'Mã phiếu', key: 'receipt_code', width: 16 },
          { header: 'Ngày nhận', key: 'received_at', width: 20, align: 'right' as const },
          { header: 'Xe bồn', key: 'tanker_plate', width: 16 },
          { header: 'Nhà cung cấp', key: 'supplier_name', width: 25 },
          { header: 'Bể nhận', key: 'tank_name', width: 18 },
          { header: 'Nhiên liệu', key: 'fuel_type_name', width: 16 },
          { header: 'Số Lít chứng từ (L)', key: 'document_liters', width: 20, align: 'right' as const },
          { header: 'Số Lít thực nhận (L)', key: 'actual_liters', width: 20, align: 'right' as const },
          { header: 'Chênh lệch (L)', key: 'variance_liters', width: 18, align: 'right' as const },
          { header: 'Trạng thái', key: 'status', width: 14 },
          { header: 'Người lập', key: 'created_by_name', width: 20 },
        ];
        const data = items.map((r) => ({
          ...r,
          received_at: formatDateTimeVN(r.received_at),
          document_liters: formatNumberVN(r.document_liters, 2),
          actual_liters: formatNumberVN(r.actual_liters, 2),
          variance_liters: formatNumberVN(r.variance_liters, 2),
        }));
        await exportReportToExcel({
          filename: 'Bang_ke_phieu_nhap_be',
          title: 'BẢNG KÊ PHIẾU NHẬP NHIÊN LIỆU VÀO BỂ',
          dateRangeStr,
          columns,
          data,
        });
        break;
      }
      case 'dispenses': {
        // Xuất đủ mọi lượt đổ khớp bộ lọc, không chỉ trang đang xem: lấy lần lượt từng trang 500 dòng
        const items: DispenseReportItem[] = [];
        for (let exportPage = 1; ; exportPage++) {
          const result = await getDispensesReport({
            branch_id: filters.branchId,
            tank_id: filters.tankId,
            status: filters.status,
            from_date: filters.fromDate,
            to_date: filters.toDate,
            page: exportPage,
            page_size: 500,
          });
          items.push(...result.items);
          if (items.length >= result.total_sessions || result.items.length === 0) break;
        }
        const columns = [
          { header: 'Mã phiên', key: 'code', width: 16 },
          { header: 'Thời điểm', key: 'time', width: 20, align: 'right' as const },
          { header: 'Trụ bơm', key: 'pump_name', width: 16 },
          { header: 'Bể xuất', key: 'tank_name', width: 16 },
          { header: 'Nhiên liệu', key: 'fuel_type_name', width: 16 },
          { header: 'Biển số xe', key: 'vehicle_plate', width: 16 },
          { header: 'Tài xế', key: 'driver_name', width: 20 },
          { header: 'Lít thực đổ (L)', key: 'dispensed_liters', width: 18, align: 'right' as const },
          { header: 'Số đồng hồ (L)', key: 'pump_total_liters', width: 18, align: 'right' as const },
          { header: 'Số lượt đổ', key: 'sale_seq', width: 12, align: 'right' as const },
          { header: 'Trạng thái', key: 'status', width: 14 },
        ];
        const data = items.map((d) => ({
          ...d,
          time: formatDateTimeVN(d.finished_at || d.started_at),
          dispensed_liters: formatNumberVN(d.dispensed_liters, 2),
          pump_total_liters: d.pump_total_liters !== null ? formatNumberVN(d.pump_total_liters, 2) : '—',
        }));
        await exportReportToExcel({
          filename: 'Lich_su_cap_phat_nhien_lieu',
          title: 'BÁO CÁO LỊCH SỬ CẤP PHÁT NHIÊN LIỆU ĐỘI XE',
          dateRangeStr,
          columns,
          data,
        });
        break;
      }
      case 'vehicle-consumption': {
        const items = vehicleConsumptionQuery.data?.items || [];
        const columns = [
          { header: 'Mã xe', key: 'vehicle_code', width: 14 },
          { header: 'Biển số', key: 'vehicle_plate', width: 16 },
          { header: 'Loại xe', key: 'type_name', width: 16 },
          { header: 'Số lượt đổ', key: 'session_count', width: 14, align: 'right' as const },
          { header: 'Tổng tiêu hao (L)', key: 'total_dispensed_liters', width: 20, align: 'right' as const },
        ];
        const data = items.map((v) => ({
          ...v,
          session_count: formatNumberVN(v.session_count),
          total_dispensed_liters: formatNumberVN(v.total_dispensed_liters, 2),
        }));
        await exportReportToExcel({
          filename: 'Tieu_hao_theo_xe',
          title: 'BÁO CÁO TIÊU HAO THEO XE',
          dateRangeStr,
          columns,
          data,
        });
        break;
      }
      case 'driver-dispense': {
        const items = driverDispenseQuery.data?.items || [];
        const columns = [
          { header: 'Mã nhân viên', key: 'driver_code', width: 16 },
          { header: 'Họ và tên', key: 'driver_name', width: 22 },
          { header: 'Điện thoại', key: 'phone', width: 16 },
          { header: 'Số lượt đổ', key: 'session_count', width: 16, align: 'right' as const },
          { header: 'Tổng số lít (L)', key: 'total_dispensed_liters', width: 20, align: 'right' as const },
          { header: 'TB / lượt (L)', key: 'avg_liters_per_session', width: 16, align: 'right' as const },
          { header: 'Phương tiện vận hành', key: 'vehicles_used', width: 25 },
        ];
        const data = items.map((d) => ({
          ...d,
          session_count: formatNumberVN(d.session_count),
          total_dispensed_liters: formatNumberVN(d.total_dispensed_liters, 2),
          avg_liters_per_session: formatNumberVN(d.avg_liters_per_session, 2),
        }));
        await exportReportToExcel({
          filename: 'Cap_phat_theo_tai_xe',
          title: 'BÁO CÁO CẤP PHÁT NHIÊN LIỆU THEO TÀI XẾ',
          dateRangeStr,
          columns,
          data,
        });
        break;
      }
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-6 p-6">
      <DetailPageHeader
        title="Báo cáo & Xuất dữ liệu"
        className="print:border-none"
        headerActions={
          <div className="flex items-center gap-2 print:hidden">
            <Button variant="outline" size="sm" onClick={handlePrint} className="gap-1.5">
              <Printer className="h-4 w-4" />
              <span>In / PDF</span>
            </Button>
            <Button size="sm" onClick={handleExportExcel} className="gap-1.5">
              <FileSpreadsheet className="h-4 w-4" />
              <span>Xuất Excel</span>
            </Button>
          </div>
        }
      />

      {/* Navigation Tabs for 6 Report Templates */}
      <div className="print:hidden">
        <Tabs value={template} onValueChange={(val) => setTemplate(val as ReportTemplateType)}>
          <TabsList>
            <TabsTrigger value="stock-ledger">
              Nhập – Xuất – Tồn
            </TabsTrigger>
            <TabsTrigger value="receipts">
              Bảng kê phiếu nhập
            </TabsTrigger>
            <TabsTrigger value="dispenses">
              Lịch sử cấp phát
            </TabsTrigger>
            <TabsTrigger value="vehicle-consumption">
              Tiêu hao theo xe
            </TabsTrigger>
            <TabsTrigger value="driver-dispense">
              Cấp phát theo tài xế
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Report Filter Parameters Bar */}
      <div className="print:hidden">
        <ReportFilters
          template={template}
          filters={filters}
          onChange={changeFilters}
        />
      </div>

      {/* Nội dung báo cáo: chỉ các dòng của bảng cuộn, tab, bộ lọc và tiêu đề cột luôn hiện */}
      <div className="flex min-h-0 flex-1 flex-col print:block">
        {template === 'stock-ledger' && (
          <StockLedgerReportView
            data={stockLedgerQuery.data}
            isLoading={stockLedgerQuery.isLoading}
            page={ledgerPage.page}
            pageSize={ledgerPage.pageSize}
            onPageChange={(page, pageSize) => setLedgerPage({ page, pageSize })}
          />
        )}
        {template === 'receipts' && (
          <ReceiptsReportView
            data={receiptsQuery.data}
            isLoading={receiptsQuery.isLoading}
          />
        )}
        {template === 'dispenses' && (
          <DispensesReportView
            data={dispensesQuery.data}
            isLoading={dispensesQuery.isLoading}
            page={dispensePage.page}
            pageSize={dispensePage.pageSize}
            onPageChange={(page, pageSize) => setDispensePage({ page, pageSize })}
          />
        )}
        {template === 'vehicle-consumption' && (
          <VehicleConsumptionReportView
            data={vehicleConsumptionQuery.data}
            isLoading={vehicleConsumptionQuery.isLoading}
          />
        )}
        {template === 'driver-dispense' && (
          <DriverDispenseReportView
            data={driverDispenseQuery.data}
            isLoading={driverDispenseQuery.isLoading}
          />
        )}
      </div>
    </div>
  );
}
