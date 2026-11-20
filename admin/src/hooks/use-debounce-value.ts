import { useState, useEffect } from 'react';

/**
 * Custom hook trả về giá trị debounced.
 * Giá trị chỉ được cập nhật sau khi người dùng ngừng thay đổi
 * trong khoảng thời gian `delay` ms.
 *
 * @param value - Giá trị cần debounce
 * @param delay - Thời gian trì hoãn (ms), mặc định 500ms
 * @returns Giá trị đã debounce
 */
export function useDebouncedValue<T>(value: T, delay = 500): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => clearTimeout(handler);
  }, [value, delay]);

  return debouncedValue;
}
