import type * as React from 'react';

/**
 * Bấm vào dòng bảng thì mở chi tiết. Bỏ qua khi bấm vào nút, liên kết, ô nhập, menu thao tác
 * (menu hiện qua portal nhưng sự kiện React vẫn nổi bọt lên dòng nên phải loại ra bằng `contains`).
 */
export function rowClick(open: () => void) {
  return (event: React.MouseEvent<HTMLElement>) => {
    const target = event.target as HTMLElement;
    if (!event.currentTarget.contains(target)) return;
    if (target.closest('button, a, input, select, textarea, [role="menuitem"], [role="checkbox"], [data-row-action]')) return;
    open();
  };
}
