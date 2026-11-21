import { formatDateTimeVN } from '@/lib/format';
import { kindLabel, statusLabel, type Feedback } from '../types';

/** Gộp nhiều góp ý thành một văn bản, ngăn cách bằng đường kẻ. */
export function formatFeedbackRequests(items: Feedback[]): string {
  return items.map(formatFeedbackRequest).join('\n\n---\n\n');
}

/**
 * Soạn góp ý thành một yêu cầu đầy đủ (Markdown) để dán thẳng cho người hoặc công cụ xử lý:
 * có loại, nội dung, trang, phần tử đã chọn và đoạn HTML của nó.
 */
export function formatFeedbackRequest(f: Feedback): string {
  const lines: string[] = [];
  lines.push(`# Yêu cầu xử lý góp ý ${f.code}: ${f.title}`);
  lines.push('');
  lines.push(`- Loại: ${kindLabel(f.kind)}`);
  lines.push(`- Trạng thái hiện tại: ${statusLabel(f.status)}`);
  lines.push(`- Người góp ý: ${f.created_by_name} (${f.created_by_role}), lúc ${formatDateTimeVN(f.created_at)}`);
  if (f.page_url) lines.push(`- Trang: ${f.page_url}${f.page_title ? ` ("${f.page_title}")` : ''}`);
  if (f.viewport) lines.push(`- Kích thước cửa sổ: ${f.viewport.width} x ${f.viewport.height}`);

  lines.push('');
  lines.push('## Nội dung góp ý');
  lines.push(f.description);

  if (f.element) {
    const e = f.element;
    lines.push('');
    lines.push('## Phần tử người dùng đã chọn');
    lines.push(`- Thẻ: <${e.tag}>${e.text ? ` với nội dung "${e.text}"` : ''}`);
    if (e.component) lines.push(`- Thành phần React: ${e.component}`);
    lines.push(`- Selector: ${e.selector}`);
    if (e.test_id) lines.push(`- data-testid: ${e.test_id}`);
    if (e.aria_label) lines.push(`- aria-label: ${e.aria_label}`);
    if (e.role) lines.push(`- role: ${e.role}`);
    lines.push(`- Vị trí và kích thước: x=${e.rect.x}, y=${e.rect.y}, rộng ${e.rect.width}, cao ${e.rect.height}`);
    lines.push('');
    lines.push('```html');
    lines.push(e.html);
    lines.push('```');
  }

  if (f.resolution_note) {
    lines.push('');
    lines.push('## Ghi chú xử lý');
    lines.push(f.resolution_note);
  }

  lines.push('');
  lines.push('## Việc cần làm');
  lines.push(
    f.kind === 'bug'
      ? 'Tìm nguyên nhân và sửa lỗi trên, viết hoặc cập nhật test để lỗi không quay lại.'
      : f.kind === 'business'
        ? 'Đối chiếu với quy trình nghiệp vụ hiện tại, đề xuất và áp dụng thay đổi phù hợp, nêu rõ phần nào ảnh hưởng tới dữ liệu và phân quyền.'
        : 'Xem xét góp ý và thực hiện thay đổi phù hợp, giữ đúng quy ước giao diện chung của hệ thống.'
  );
  return lines.join('\n');
}
