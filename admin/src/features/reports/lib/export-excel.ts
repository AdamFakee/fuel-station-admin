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
  data: Record<string, any>[];
  summaryRow?: Record<string, any>;
}

export async function exportReportToExcel(options: ExportExcelOptions): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Fuel Station Admin';
  workbook.created = new Date();

  const worksheet = workbook.addWorksheet('Báo cáo', {
    pageSetup: { orientation: 'landscape', fitToPage: true },
  });

  // 1. Report Header Info
  const titleRow = worksheet.addRow([options.title.toUpperCase()]);
  titleRow.font = { name: 'Arial', size: 14, bold: true, color: { argb: 'FF1E293B' } };
  worksheet.mergeCells(1, 1, 1, options.columns.length);
  titleRow.alignment = { horizontal: 'center' };

  if (options.dateRangeStr || options.branchStr) {
    const metaParts = [];
    if (options.dateRangeStr) metaParts.push(`Thời gian: ${options.dateRangeStr}`);
    if (options.branchStr) metaParts.push(`Trạm xăng: ${options.branchStr}`);
    const metaRow = worksheet.addRow([metaParts.join('  |  ')]);
    metaRow.font = { name: 'Arial', size: 10, italic: true, color: { argb: 'FF64748B' } };
    worksheet.mergeCells(2, 1, 2, options.columns.length);
    metaRow.alignment = { horizontal: 'center' };
  }

  // Blank line
  worksheet.addRow([]);

  // 2. Table Headers
  const headerValues = options.columns.map((c) => c.header);
  const headerRow = worksheet.addRow(headerValues);
  headerRow.height = 24;
  headerRow.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
  headerRow.alignment = { vertical: 'middle' };

  headerRow.eachCell((cell, colNumber) => {
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF0F172A' }, // Slate 900
    };
    const colDef = options.columns[colNumber - 1];
    cell.alignment = {
      vertical: 'middle',
      horizontal: colDef?.align || 'left',
    };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
    };
  });

  // 3. Table Data Rows
  options.data.forEach((item) => {
    const rowValues = options.columns.map((col) => {
      const val = item[col.key];
      return val !== undefined && val !== null ? val : '—';
    });
    const dataRow = worksheet.addRow(rowValues);
    dataRow.font = { name: 'Arial', size: 9 };
    dataRow.height = 20;

    dataRow.eachCell((cell, colNumber) => {
      const colDef = options.columns[colNumber - 1];
      cell.alignment = {
        vertical: 'middle',
        horizontal: colDef?.align || 'left',
      };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      };
    });
  });

  // 4. Summary Row (if provided)
  if (options.summaryRow) {
    const summaryValues = options.columns.map((col) => {
      const val = options.summaryRow![col.key];
      return val !== undefined && val !== null ? val : '';
    });
    const sumRow = worksheet.addRow(summaryValues);
    sumRow.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF0F172A' } };
    sumRow.height = 22;

    sumRow.eachCell((cell, colNumber) => {
      const colDef = options.columns[colNumber - 1];
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFF1F5F9' }, // Slate 100
      };
      cell.alignment = {
        vertical: 'middle',
        horizontal: colDef?.align || 'left',
      };
      cell.border = {
        top: { style: 'double', color: { argb: 'FF64748B' } },
        bottom: { style: 'thin', color: { argb: 'FF64748B' } },
        left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      };
    });
  }

  // 5. Column Widths
  options.columns.forEach((col, index) => {
    const wsCol = worksheet.getColumn(index + 1);
    wsCol.width = col.width || Math.max(col.header.length + 4, 14);
  });

  // 6. Generate and trigger download
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
