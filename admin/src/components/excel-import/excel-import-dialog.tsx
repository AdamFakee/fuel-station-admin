'use client';

import * as React from 'react';
import { ArrowDownTrayIcon, CheckCircleIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { downloadImportTemplate } from './excel-template';
import { ImportFileError, parseImportFile, validateCells } from './parse-excel';
import { ImportColumn, ImportOutcome, ParsedImportRow, RowLabel } from './types';

interface ExcelImportDialogProps<TRow> {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Tiêu đề hộp thoại, ví dụ "Nhập tài xế từ Excel". */
  title: string;
  /** Tên file mẫu tải về. */
  templateFilename: string;
  columns: ImportColumn<TRow>[];
  /** Gọi một dòng là ai trong thông báo (ví dụ họ tên + mã). Không khai báo thì dùng "Dòng N". */
  rowLabel?: RowLabel;
  /** Gửi các dòng hợp lệ lên server. Server trả về dòng nào tạo được, dòng nào bị từ chối kèm lý do. */
  onImport: (rows: TRow[]) => Promise<ImportOutcome>;
}

/** Dòng đang xem trước: thêm lỗi do server từ chối (trùng mã, trùng thẻ...) để người dùng sửa và nhập lại. */
interface ReviewRow<TRow> extends ParsedImportRow<TRow> {
  serverError?: string;
}

function cellsToRecord<TRow>(cells: string[], columns: ImportColumn<TRow>[]): Record<string, string> {
  const record: Record<string, string> = {};
  columns.forEach((column, i) => {
    record[column.key] = cells[i];
  });
  return record;
}

export function ExcelImportDialog<TRow>({
  open,
  onOpenChange,
  title,
  templateFilename,
  columns,
  rowLabel,
  onImport,
}: ExcelImportDialogProps<TRow>) {
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [rows, setRows] = React.useState<ReviewRow<TRow>[] | null>(null);
  const [fileError, setFileError] = React.useState<string | null>(null);
  const [isReading, setIsReading] = React.useState(false);
  const [isImporting, setIsImporting] = React.useState(false);
  const [importedCount, setImportedCount] = React.useState(0);

  const reset = () => {
    setRows(null);
    setFileError(null);
    setImportedCount(0);
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) reset();
    onOpenChange(next);
  };

  const handleFile = async (file: File) => {
    setFileError(null);
    setIsReading(true);
    try {
      setRows(await parseImportFile(file, columns));
      setImportedCount(0);
    } catch (error) {
      setRows(null);
      setFileError(error instanceof ImportFileError ? error.message : 'Không đọc được file.');
    } finally {
      setIsReading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  /** Người dùng sửa một ô: kiểm tra lại cả dòng ngay để dòng hợp lệ thì chuyển xuống danh sách sẵn sàng. */
  const handleCellChange = (rowNumber: number, columnIndex: number, text: string) => {
    setRows((current) =>
      (current ?? []).map((row) => {
        if (row.rowNumber !== rowNumber) return row;
        const cells = row.cells.map((cell, i) => (i === columnIndex ? text : cell));
        const { value, errors } = validateCells(cells, columns);
        return { ...row, cells, value, errors, serverError: undefined };
      })
    );
  };

  const validRows = (rows ?? []).filter((row) => Object.keys(row.errors).length === 0 && !row.serverError);
  const incompleteRows = (rows ?? []).filter((row) => Object.keys(row.errors).length > 0 || row.serverError);

  const labelOf = (row: ReviewRow<TRow>): string => {
    const label = rowLabel?.(cellsToRecord(row.cells, columns));
    return label && label.trim() ? label : 'Chưa có tên';
  };

  const handleImport = async () => {
    if (validRows.length === 0) return;
    setIsImporting(true);
    try {
      const outcome = await onImport(validRows.map((row) => row.value));
      // `failed[].row` đếm từ 1 theo thứ tự các dòng hợp lệ vừa gửi.
      const rejected = new Map(outcome.failed.map((item) => [item.row, item.message]));
      const remaining: ReviewRow<TRow>[] = [];
      let sentIndex = 0;
      for (const row of rows ?? []) {
        const isSent = validRows.includes(row);
        if (!isSent) {
          remaining.push(row);
          continue;
        }
        sentIndex += 1;
        const message = rejected.get(sentIndex);
        if (message) remaining.push({ ...row, serverError: message });
      }
      setRows(remaining);
      setImportedCount((count) => count + outcome.created);
      if (outcome.created > 0) toast.success(`Đã nhập ${outcome.created} dòng`);
      if (remaining.length === 0) handleOpenChange(false);
    } catch {
      toast.error('Không thể nhập dữ liệu. Vui lòng thử lại.');
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        <DialogBody className="space-y-5">
          {/* Bước 1: tải mẫu và chọn file */}
          {rows === null && (
            <div className="space-y-4">
              <div className="rounded-lg border border-dashed p-6 text-center">
                <p className="text-sm text-muted-foreground">
                  Điền dữ liệu theo file mẫu (.xlsx) rồi chọn file để nhập.
                </p>
                <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => downloadImportTemplate(columns, templateFilename)}
                    data-testid="btn-download-import-template"
                  >
                    <ArrowDownTrayIcon className="mr-2 h-4 w-4" />
                    Tải file mẫu
                  </Button>
                  <Button
                    type="button"
                    disabled={isReading}
                    onClick={() => fileInputRef.current?.click()}
                    data-testid="btn-choose-import-file"
                  >
                    {isReading ? 'Đang đọc file...' : 'Chọn file Excel'}
                  </Button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".xlsx"
                    className="hidden"
                    data-testid="input-import-file"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) void handleFile(file);
                    }}
                  />
                </div>
              </div>
              {fileError && <p className="text-sm text-destructive">{fileError}</p>}
            </div>
          )}

          {/* Bước 2: xem trước, bổ sung dữ liệu thiếu */}
          {rows !== null && (
            <>
              <div className="flex flex-wrap items-center gap-4 text-sm">
                <span className="flex items-center gap-1.5 text-emerald-700">
                  <CheckCircleIcon className="h-4 w-4" />
                  {validRows.length} dòng sẵn sàng
                </span>
                {incompleteRows.length > 0 && (
                  <span className="flex items-center gap-1.5 text-amber-700">
                    <ExclamationTriangleIcon className="h-4 w-4" />
                    {incompleteRows.length} dòng cần bổ sung
                  </span>
                )}
                {importedCount > 0 && <span className="text-muted-foreground">Đã nhập {importedCount} dòng</span>}
              </div>

              {incompleteRows.length > 0 && (
                <div className="space-y-3" data-testid="import-incomplete-rows">
                  <h3 className="text-sm font-semibold">Bổ sung thông tin còn thiếu</h3>
                  {incompleteRows.map((row) => {
                    const showAll = Boolean(row.serverError);
                    return (
                      <div
                        key={row.rowNumber}
                        className="rounded-lg border border-amber-300 bg-amber-50/60 p-3 dark:bg-amber-950/20"
                        data-testid={`import-row-${row.rowNumber}`}
                      >
                        <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
                          <span className="text-sm font-semibold">
                            Dòng {row.rowNumber}: {labelOf(row)}
                          </span>
                          <span className="text-xs text-amber-800">
                            {row.serverError
                              ? row.serverError
                              : `Thiếu hoặc sai: ${columns
                                  .filter((column) => row.errors[column.key])
                                  .map((column) => column.header)
                                  .join(', ')}`}
                          </span>
                        </div>
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                          {columns.map((column, index) => {
                            const error = row.errors[column.key];
                            if (!showAll && !error) return null;
                            const inputId = `import-${row.rowNumber}-${column.key}`;
                            return (
                              <div key={column.key} className="space-y-1">
                                <Label htmlFor={inputId} className="text-xs">
                                  {column.header}
                                  {column.required && <span className="text-destructive"> *</span>}
                                </Label>
                                <Input
                                  id={inputId}
                                  value={row.cells[index]}
                                  placeholder={column.placeholder ?? column.example}
                                  aria-invalid={Boolean(error)}
                                  className={error ? 'border-destructive' : ''}
                                  onChange={(e) => handleCellChange(row.rowNumber, index, e.target.value)}
                                />
                                {error ? (
                                  <p className="text-xs text-destructive">{error}</p>
                                ) : (
                                  column.hint && <p className="text-xs text-muted-foreground">{column.hint}</p>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {validRows.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold">Dòng sẵn sàng nhập</h3>
                  <div className="max-h-64 overflow-auto rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[60px]">Dòng</TableHead>
                          {columns.map((column) => (
                            <TableHead key={column.key}>{column.header}</TableHead>
                          ))}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {validRows.map((row) => (
                          <TableRow key={row.rowNumber}>
                            <TableCell className="text-muted-foreground">{row.rowNumber}</TableCell>
                            {row.cells.map((cell, i) => (
                              <TableCell key={columns[i].key} className="text-sm">
                                {cell || <span className="text-muted-foreground">-</span>}
                              </TableCell>
                            ))}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}
            </>
          )}
        </DialogBody>

        <DialogFooter>
          {rows !== null && (
            <Button type="button" variant="ghost" onClick={reset} disabled={isImporting} className="mr-auto">
              Chọn file khác
            </Button>
          )}
          <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
            Đóng
          </Button>
          {rows !== null && (
            <Button
              type="button"
              disabled={validRows.length === 0 || isImporting}
              onClick={handleImport}
              data-testid="btn-confirm-import"
            >
              {isImporting
                ? 'Đang nhập...'
                : incompleteRows.length > 0
                  ? `Nhập ${validRows.length} dòng sẵn sàng (bỏ qua ${incompleteRows.length} dòng thiếu)`
                  : `Nhập ${validRows.length} dòng`}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
