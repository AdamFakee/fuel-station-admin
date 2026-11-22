import ExcelJS from 'exceljs';

export interface ExcelColumn {
  header: string;
  key: string;
  width?: number;
  align?: 'left' | 'right' | 'center';
}

export interface ExportExcelOptions {
  filename: string;
  title: string;
  dateRangeStr?: string;
  branchStr?: string;
  columns: ExcelColumn[];
  data: Record<string, unknown>[];
  summaryRow?: Record<string, unknown>;
  /** Thêm cột STT ở đầu bảng (mặc định có, trừ khi cột đầu đã là STT). */
  showIndex?: boolean;
}

/** Bảng màu chung của mọi file Excel, lấy từ màu chủ đạo của hệ thống (sidebar #1f4e79). */
const COLOR = {
  primary: 'FF1F4E79',
  primaryLight: 'FFE1ECF6',
  zebra: 'FFF1F6FB',
  border: 'FFC3D9EC',
  text: 'FF0F172A',
  muted: 'FF64748B',
  white: 'FFFFFFFF',
};

const FONT = 'Arial';
const SYSTEM_NAME = 'HỆ THỐNG QUẢN LÝ TRẠM XĂNG';

const thinBorder = (color = COLOR.border): Partial<ExcelJS.Borders> => ({
  top: { style: 'thin', color: { argb: color } },
  bottom: { style: 'thin', color: { argb: color } },
  left: { style: 'thin', color: { argb: color } },
  right: { style: 'thin', color: { argb: color } },
});

const solid = (argb: string): ExcelJS.Fill => ({ type: 'pattern', pattern: 'solid', fgColor: { argb } });

/** Tên sheet Excel tối đa 31 ký tự và không chứa : \ / ? * [ ]. */
const toSheetName = (title: string) =>
  title
    .replace(/[:\\/?*[\]]/g, ' ')
    .trim()
    .slice(0, 31) || 'Báo cáo';

const formatNow = () => {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

/**
 * Xuất bảng ra file Excel với bố cục chung cho mọi báo cáo và danh sách:
 * tên hệ thống, tiêu đề, kỳ báo cáo, ngày xuất; bảng có STT, dòng kẻ xen kẽ, cố định tiêu đề cột,
 * bộ lọc; in ngang khổ A4, lặp lại tiêu đề cột ở mỗi trang, có số trang ở chân.
 */
export async function exportReportToExcel(options: ExportExcelOptions): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Fuel Station Admin';
  workbook.created = new Date();

  // Cột STT tự thêm vào đầu bảng
  const withIndex = options.showIndex ?? options.columns[0]?.header !== 'STT';
  const columns: ExcelColumn[] = withIndex
    ? [{ header: 'STT', key: '__index', width: 7, align: 'center' }, ...options.columns]
    : options.columns;
  const colCount = columns.length;

  const worksheet = workbook.addWorksheet(toSheetName(options.title), {
    properties: { tabColor: { argb: COLOR.primary } },
    pageSetup: {
      paperSize: 9, // A4
      orientation: 'landscape',
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      margins: { left: 0.4, right: 0.4, top: 0.6, bottom: 0.6, header: 0.3, footer: 0.3 },
    },
    views: [{ showGridLines: false }],
    headerFooter: {
      oddFooter: '&L&8Xuất từ hệ thống quản lý trạm xăng&R&8Trang &P / &N',
    },
  });

  // Mỗi dòng thông tin đầu trang gộp ngang hết bề rộng bảng
  const addBannerRow = (text: string, font: Partial<ExcelJS.Font>, height: number, horizontal: 'left' | 'center') => {
    const row = worksheet.addRow([text]);
    row.height = height;
    row.font = { name: FONT, ...font };
    row.alignment = { vertical: 'middle', horizontal };
    if (colCount > 1) worksheet.mergeCells(row.number, 1, row.number, colCount);
    return row;
  };

  // 1. Đầu trang: hệ thống, tiêu đề, kỳ báo cáo, ngày xuất
  addBannerRow(SYSTEM_NAME, { size: 9, bold: true, color: { argb: COLOR.muted } }, 16, 'left');
  addBannerRow(options.title.toUpperCase(), { size: 16, bold: true, color: { argb: COLOR.primary } }, 30, 'center');

  const meta: string[] = [];
  if (options.dateRangeStr) meta.push(`Thời gian: ${options.dateRangeStr}`);
  if (options.branchStr) meta.push(`Trạm xăng: ${options.branchStr}`);
  if (meta.length > 0) {
    addBannerRow(meta.join('   |   '), { size: 10, color: { argb: COLOR.text } }, 18, 'center');
  }
  addBannerRow(`Ngày xuất: ${formatNow()}`, { size: 9, italic: true, color: { argb: COLOR.muted } }, 16, 'center');
  worksheet.addRow([]).height = 8;

  // 2. Tiêu đề cột
  const headerRow = worksheet.addRow(columns.map((c) => c.header));
  headerRow.height = 30;
  headerRow.eachCell((cell, colNumber) => {
    cell.font = { name: FONT, size: 10, bold: true, color: { argb: COLOR.white } };
    cell.fill = solid(COLOR.primary);
    cell.border = thinBorder(COLOR.primary);
    cell.alignment = {
      vertical: 'middle',
      horizontal: columns[colNumber - 1]?.align ?? 'left',
      wrapText: true,
    };
  });
  const headerRowNumber = headerRow.number;

  // 3. Dòng dữ liệu: kẻ xen kẽ cho dễ đọc
  options.data.forEach((item, index) => {
    const values = columns.map((col) => {
      if (col.key === '__index') return index + 1;
      const val = item[col.key];
      return val !== undefined && val !== null && val !== '' ? val : '—';
    });
    const row = worksheet.addRow(values);
    row.height = 20;
    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      cell.font = { name: FONT, size: 10, color: { argb: COLOR.text } };
      cell.border = thinBorder();
      cell.alignment = {
        vertical: 'middle',
        horizontal: columns[colNumber - 1]?.align ?? 'left',
        wrapText: true,
      };
      if (index % 2 === 1) cell.fill = solid(COLOR.zebra);
    });
  });

  // 4. Dòng tổng cộng (nếu có)
  if (options.summaryRow) {
    const summary = options.summaryRow;
    const values = columns.map((col) => {
      const val = summary[col.key];
      return val !== undefined && val !== null ? val : '';
    });
    const row = worksheet.addRow(values);
    row.height = 24;
    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      cell.font = { name: FONT, size: 10, bold: true, color: { argb: COLOR.primary } };
      cell.fill = solid(COLOR.primaryLight);
      cell.alignment = { vertical: 'middle', horizontal: columns[colNumber - 1]?.align ?? 'left' };
      cell.border = {
        ...thinBorder(),
        top: { style: 'double', color: { argb: COLOR.primary } },
      };
    });
  }

  // 5. Chân bảng: tổng số bản ghi
  worksheet.addRow([]).height = 8;
  addBannerRow(`Tổng số bản ghi: ${options.data.length}`, { size: 9, italic: true, color: { argb: COLOR.muted } }, 16, 'left');

  // 6. Độ rộng cột
  columns.forEach((col, index) => {
    worksheet.getColumn(index + 1).width = col.width ?? Math.max(col.header.length + 4, 14);
  });

  // 7. Cố định tiêu đề cột khi cuộn, có bộ lọc, lặp tiêu đề cột khi in
  worksheet.views = [{ state: 'frozen', ySplit: headerRowNumber, showGridLines: false }];
  worksheet.autoFilter = {
    from: { row: headerRowNumber, column: 1 },
    to: { row: headerRowNumber, column: colCount },
  };
  worksheet.pageSetup.printTitlesRow = `${headerRowNumber}:${headerRowNumber}`;

  // 8. Tạo file và tải về
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${options.filename}_${new Date().toISOString().slice(0, 10)}.xlsx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(url);
}
