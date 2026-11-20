'use client';

// this is where you'd implement some pagination logic like whether a next page is available, which can then be imported to the DataTable

import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination';
import { generatePaginationLinks } from './generate-pages';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
import { useState } from 'react';
import { Input } from './ui/input';

type PaginatorProps = {
  currentPage: number;
  totalPages?: number;
  totalItems?: number;
  count?: number;
  pageSize?: number;
  onPageChange: (pageNumber: number, pSize?: number) => void;
  showPreviousNext?: boolean;
  className?: string;
  hideStats?: boolean;
  hideGotoPage?: boolean;
  isRelative?: boolean;
};
const arrSelect = [
  { id: '10', name: '10/trang' },
  { id: '20', name: '20/trang' },
  { id: '50', name: '50/trang' },
  { id: '100', name: '100/trang' },
];

export default function Paginator({
  currentPage,
  totalPages,
  totalItems,
  count = 0,
  pageSize = 10,
  onPageChange,
  showPreviousNext = true,
  className,
  hideStats = false,
  hideGotoPage = false,
  isRelative = false,
}: PaginatorProps) {
  const actualCount = totalItems !== undefined ? totalItems : count;
  const actualTotalPages = totalPages !== undefined ? totalPages : Math.max(1, Math.ceil(actualCount / (pageSize || 10)));
  const [pageSizeInternal, setPageSizeInternal] = useState(pageSize.toString());
  const [pageIndex, setPageIndex] = useState<string>();

  const onChangeVal = (val: string) => {
    setPageSizeInternal(val);
    onPageChange(currentPage, Number(val));
  };

  const onPageChangeFromLink = (pageNumber: number) => {
    onPageChange(pageNumber, Number(pageSizeInternal));
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      if (!pageIndex) return;
      if (Number(pageIndex) <= 0) return;
      onPageChange(Number(pageIndex), Number(pageSizeInternal));
    }
  };

  return (
    <Pagination
      className={`${isRelative ? 'relative' : '!absolute bottom-0 left-0 right-0'} z-10 mx-auto w-full shadow ${className}`}
    >
      <PaginationContent className="w-full bg-white flex justify-between py-1">
        <div className="flex items-center">
          {!hideStats && (
            <p className="text-[#020617] text-sm font-medium px-4">
              {(currentPage - 1) * pageSize + 1}-{currentPage * pageSize} trên
              tổng {actualCount} dữ liệu
            </p>
          )}
          <Select
            value={pageSizeInternal.toString()}
            onValueChange={onChangeVal}
          >
            <SelectTrigger
              size="sm"
              className="w-[112px] h-[32px] text-sm bg-white mr-8"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {arrSelect.map((m) => (
                <SelectItem key={m.id} value={m.id}>
                  {m.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center">
          {showPreviousNext && actualTotalPages ? (
            <PaginationItem>
              <PaginationPrevious
                onClick={() =>
                  currentPage - 1 < 1
                    ? undefined
                    : onPageChange(currentPage - 1, Number(pageSizeInternal))
                }
              />
            </PaginationItem>
          ) : null}
          {generatePaginationLinks(
            currentPage,
            actualTotalPages,
            onPageChangeFromLink
          )}
          {showPreviousNext && actualTotalPages ? (
            <PaginationItem>
              <PaginationNext
                onClick={() =>
                  currentPage > actualTotalPages - 1
                    ? undefined
                    : onPageChange(currentPage + 1, Number(pageSizeInternal))
                }
              />
            </PaginationItem>
          ) : null}
          {!hideGotoPage && (
            <div className="text-[#020617] text-sm font-medium px-4 flex items-center gap-x-4">
              <p className="inline-block text-nowrap">Đến trang</p>
              <Input
                type="number"
                className="w-[56px] bg-white"
                min={1}
                value={pageIndex}
                onChange={(e) => setPageIndex(e.target.value)}
                onKeyDown={handleKeyDown}
              />
            </div>
          )}
        </div>
      </PaginationContent>
    </Pagination>
  );
}
