import type { TDocumentDefinitions, Content, TableCell } from 'pdfmake/interfaces';
import type { ExcelColumn, ExportExcelOptions } from './export-excel';

/** Cùng tham số với bản xuất Excel để một nơi dựng dữ liệu dùng cho cả hai định dạng. */
export type ExportPdfOptions = ExportExcelOptions;

const COLOR = {
  primary: '#1f4e79',
  primaryLight: '#e1ecf6',
  zebra: '#f1f6fb',
  border: '#c3d9ec',
  text: '#0f172a',
  muted: '#64748b',
  white: '#ffffff',
};

const SYSTEM_NAME = 'HỆ THỐNG QUẢN LÝ TRẠM XĂNG';

// Khổ A4 (pt) trừ lề trái phải: dùng để chia bề rộng cột theo tỷ lệ độ rộng khai báo ở bản Excel
const A4_WIDTH = 595.28;
const A4_HEIGHT = 841.89;
const MARGIN = 28;

const formatNow = () => {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const text = (value: unknown): string => (value === undefined || value === null || value === '' ? '—' : String(value));

/** Dựng định nghĩa tài liệu PDF theo đúng bố cục của file Excel: đầu trang, bảng có STT, dòng tổng, chân trang. */
function buildDocument(options: ExportPdfOptions): TDocumentDefinitions {
  const withIndex = options.showIndex ?? options.columns[0]?.header !== 'STT';
  const columns: ExcelColumn[] = withIndex
    ? [{ header: 'STT', key: '__index', width: 6, align: 'center' }, ...options.columns]
    : options.columns;

  // Nhiều cột thì in ngang cho đủ chỗ
  const landscape = columns.length > 6;
  const usableWidth = (landscape ? A4_HEIGHT : A4_WIDTH) - MARGIN * 2;
  const totalUnits = columns.reduce((sum, c) => sum + (c.width ?? Math.max(c.header.length + 4, 14)), 0);
  const widths = columns.map((c) => (usableWidth * (c.width ?? Math.max(c.header.length + 4, 14))) / totalUnits);

  const header: TableCell[] = columns.map((c) => ({
    text: c.header,
    bold: true,
    color: COLOR.white,
    fillColor: COLOR.primary,
    alignment: c.align ?? 'left',
    margin: [0, 3, 0, 3],
  }));

  const body: TableCell[][] = [header];

  options.data.forEach((item, index) => {
    body.push(
      columns.map((c) => ({
        text: c.key === '__index' ? String(index + 1) : text(item[c.key]),
        alignment: c.align ?? 'left',
        color: COLOR.text,
        fillColor: index % 2 === 1 ? COLOR.zebra : undefined,
        margin: [0, 2, 0, 2],
      })),
    );
  });

  if (options.summaryRow) {
    const summary = options.summaryRow;
    body.push(
      columns.map((c) => ({
        text: summary[c.key] !== undefined && summary[c.key] !== null ? String(summary[c.key]) : '',
        alignment: c.align ?? 'left',
        bold: true,
        color: COLOR.primary,
        fillColor: COLOR.primaryLight,
        margin: [0, 3, 0, 3],
      })),
    );
  }

  const meta: string[] = [];
  if (options.dateRangeStr) meta.push(`Thời gian: ${options.dateRangeStr}`);
  if (options.branchStr) meta.push(`Trạm xăng: ${options.branchStr}`);

  const content: Content[] = [
    { text: SYSTEM_NAME, fontSize: 8, bold: true, color: COLOR.muted },
    {
      text: options.title.toUpperCase(),
      fontSize: 15,
      bold: true,
      color: COLOR.primary,
      alignment: 'center',
      margin: [0, 6, 0, 4],
    },
  ];
  if (meta.length > 0) {
    content.push({
      text: meta.join('   |   '),
      fontSize: 9,
      alignment: 'center',
      color: COLOR.text,
      margin: [0, 0, 0, 2],
    });
  }
  content.push({
    text: `Ngày xuất: ${formatNow()}`,
    fontSize: 8,
    italics: true,
    alignment: 'center',
    color: COLOR.muted,
    margin: [0, 0, 0, 10],
  });
  content.push({
    table: { headerRows: 1, widths, body },
    layout: {
      hLineColor: () => COLOR.border,
      vLineColor: () => COLOR.border,
      hLineWidth: () => 0.5,
      vLineWidth: () => 0.5,
      paddingLeft: () => 5,
      paddingRight: () => 5,
    },
  });
  content.push({
    text: `Tổng số bản ghi: ${options.data.length}`,
    fontSize: 8,
    italics: true,
    color: COLOR.muted,
    margin: [0, 8, 0, 0],
  });

  return {
    pageSize: 'A4',
    pageOrientation: landscape ? 'landscape' : 'portrait',
    pageMargins: [MARGIN, 32, MARGIN, 40],
    defaultStyle: { font: 'Roboto', fontSize: 8.5 },
    info: { title: options.title, creator: 'Fuel Station Admin' },
    content,
    footer: (currentPage, pageCount) => ({
      columns: [
        { text: 'Xuất từ hệ thống quản lý trạm xăng', fontSize: 7, color: COLOR.muted, margin: [MARGIN, 0, 0, 0] },
        {
          text: `Trang ${currentPage} / ${pageCount}`,
          fontSize: 7,
          color: COLOR.muted,
          alignment: 'right',
          margin: [0, 0, MARGIN, 0],
        },
      ],
      margin: [0, 16, 0, 0],
    }),
  };
}

/**
 * Xuất báo cáo ra PDF: tải về thành file, hoặc mở hộp thoại in.
 * Thư viện và font chỉ tải khi bấm nút lần đầu để không làm nặng trang.
 */
export async function exportReportToPdf(options: ExportPdfOptions, mode: 'download' | 'print'): Promise<void> {
  const [{ default: pdfMake }, vfs] = await Promise.all([
    import('pdfmake/build/pdfmake'),
    import('pdfmake/build/vfs_fonts'),
  ]);
  pdfMake.addVirtualFileSystem(
    (vfs as { default?: Record<string, string> }).default ?? (vfs as unknown as Record<string, string>),
  );

  const pdf = pdfMake.createPdf(buildDocument(options));
  if (mode === 'print') {
    await pdf.print();
  } else {
    await pdf.download(`${options.filename}_${new Date().toISOString().slice(0, 10)}.pdf`);
  }
}
