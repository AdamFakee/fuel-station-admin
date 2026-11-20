import { redirect } from 'next/navigation';

/** Thiết bị (bộ số, máy chấm công) giờ nằm trong form của từng trụ bơm. Giữ đường dẫn cũ để liên kết và dấu trang không hỏng. */
export default function DevicesPage() {
  redirect('/pumps');
}
