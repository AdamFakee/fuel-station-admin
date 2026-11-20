import { useEffect, useMemo, useRef, useState } from 'react';

interface UseVirtualTableProps<T> {
  data: T[];
  pageSize: number;
  currentPage: number;
  rowHeight?: number;
  containerHeight?: number;
}

export function useVirtualTable<T>({
  data,
  pageSize,
  currentPage,
  rowHeight = 60,
  containerHeight = 400
}: UseVirtualTableProps<T>) {
  const [scrollTop, setScrollTop] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Calculate current page data
  const paginatedData = useMemo(() => {
    const startIndex = currentPage * pageSize;
    const endIndex = startIndex + pageSize;
    return data.slice(startIndex, endIndex);
  }, [data, currentPage, pageSize]);

  // Calculate virtual items for large datasets
  const virtualItems = useMemo(() => {
    if (paginatedData.length <= 20) {
      // For small datasets, render all items
      return paginatedData.map((_, index) => ({
        index,
        start: index * rowHeight,
        size: rowHeight,
        end: (index + 1) * rowHeight,
      }));
    }

    // For large datasets, calculate visible items
    const visibleStart = Math.floor(scrollTop / rowHeight);
    const visibleEnd = Math.min(
      visibleStart + Math.ceil(containerHeight / rowHeight) + 1,
      paginatedData.length
    );
    
    return Array.from({ length: visibleEnd - visibleStart }, (_, index) => {
      const actualIndex = visibleStart + index;
      return {
        index: actualIndex,
        start: actualIndex * rowHeight,
        size: rowHeight,
        end: (actualIndex + 1) * rowHeight,
      };
    });
  }, [paginatedData, scrollTop, rowHeight, containerHeight]);

  // Total height for scrolling
  const totalHeight = paginatedData.length * rowHeight;

  // Handle scroll
  const handleScroll = (event: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(event.currentTarget.scrollTop);
  };

  // Reset scroll when page changes
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = 0;
      setScrollTop(0);
    }
  }, [currentPage]);

  return {
    paginatedData,
    virtualItems,
    totalHeight,
    containerRef,
    handleScroll,
    isVirtual: paginatedData.length > 20
  };
}
