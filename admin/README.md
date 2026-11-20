# Frontend Admin - Starter Kit (Next.js App Router)

Ứng dụng web quản trị chuẩn hoá được xây dựng trên nền tảng **Next.js 15 (App Router)**, **React 19**, **Tailwind CSS v4** và **TanStack Query v5**.

## 🚀 Tính năng & Thành phần sẵn có

- **Tailwind CSS v4 Design System**: Bộ màu Brand xanh xám chuyên nghiệp, đồng bộ Light/Dark token.
- **30+ UI Primitives (`src/components/ui`)**: Button, Card, Dialog, Sheet, Table, Popover, Select, Form, Tabs, Toaster (Sonner), ...
- **Layout Shell (`src/components/admin-shell.tsx`, `app-sidebar.tsx`)**: Responsive, Collapsible sidebar, chuẩn UX admin.
- **Bộ Component Bổ trợ**:
  - `DetailPageHeader`: Shell tiêu đề trang chuẩn hóa.
  - `Paginator`: Phân trang dữ liệu.
  - `SelectCustom`, `MultiSelectCustom`: Bộ chọn tùy biến.
  - `SkeletonTable`: Hiệu ứng loading skeleton cho bảng.
  - `Empty`: Hiển thị trạng thái rỗng thân thiện.
  - `ConfirmDelete`: Hộp thoại xác nhận an toàn.
- **Hooks tiện ích (`src/hooks`)**: `use-debounce-value`, `use-mobile`, `use-infinite-scroll`, `use-virtual-scroll`, `use-virtual-table`.
- **Cấu trúc Feature Sliced (`src/features`)**: Sẵn sàng mở rộng theo từng module nghiệp vụ.

## 🛠️ Cài đặt & Chạy ứng dụng

```bash
# Cài đặt dependencies
npm install

# Khởi chạy môi trường phát triển
npm run dev

# Build sản phẩm
npm run build
```
Mặc định truy cập tại: [http://localhost:3000](http://localhost:3000)
