import { useMemo, useState, useEffect, useRef } from 'react';

interface UseVirtualScrollOptions {
  itemHeight: number;
  containerHeight: number;
  overscan?: number;
}

interface UseVirtualScrollReturn<T> {
  virtualItems: {
    index: number;
    start: number;
    end: number;
    item: T;
  }[];
  totalHeight: number;
  scrollElementRef: React.RefObject<HTMLDivElement | null>;
}

export function useVirtualScroll<T>(
  items: T[],
  options: UseVirtualScrollOptions
): UseVirtualScrollReturn<T> {
  const { itemHeight, containerHeight, overscan = 5 } = options;
  const [scrollTop, setScrollTop] = useState(0);
  const scrollElementRef = useRef<HTMLDivElement | null>(null);

  const totalHeight = items.length * itemHeight;
  
  const virtualItems = useMemo(() => {
    const startIndex = Math.floor(scrollTop / itemHeight);
    const endIndex = Math.min(
      startIndex + Math.ceil(containerHeight / itemHeight) + overscan,
      items.length - 1
    );

    const visibleStartIndex = Math.max(0, startIndex - overscan);

    return Array.from({ length: endIndex - visibleStartIndex + 1 }, (_, index) => {
      const itemIndex = visibleStartIndex + index;
      return {
        index: itemIndex,
        start: itemIndex * itemHeight,
        end: (itemIndex + 1) * itemHeight,
        item: items[itemIndex],
      };
    });
  }, [items, itemHeight, scrollTop, containerHeight, overscan]);

  useEffect(() => {
    const scrollElement = scrollElementRef.current;
    if (!scrollElement) return;

    const handleScroll = () => {
      setScrollTop(scrollElement.scrollTop);
    };

    scrollElement.addEventListener('scroll', handleScroll);
    return () => scrollElement.removeEventListener('scroll', handleScroll);
  }, []);

  return {
    virtualItems,
    totalHeight,
    scrollElementRef,
  };
}