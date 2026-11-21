import type { PickedElement } from '@/lib/element-picker';

export type FeedbackKind = 'improvement' | 'ui_ux' | 'bug' | 'business';
export type FeedbackStatus = 'new' | 'reviewing' | 'planned' | 'done' | 'rejected';

export const FEEDBACK_KINDS: { value: FeedbackKind; label: string; hint: string }[] = [
  { value: 'improvement', label: 'Cải thiện tính năng', hint: 'Thêm hoặc làm tốt hơn một chức năng' },
  { value: 'ui_ux', label: 'Giao diện / Trải nghiệm', hint: 'Khó nhìn, khó bấm, bố cục chưa hợp lý' },
  { value: 'bug', label: 'Lỗi', hint: 'Chức năng chạy sai hoặc báo lỗi' },
  { value: 'business', label: 'Nghiệp vụ', hint: 'Quy trình hoặc quy tắc chưa đúng thực tế' },
];

export const FEEDBACK_STATUSES: { value: FeedbackStatus; label: string }[] = [
  { value: 'new', label: 'Mới' },
  { value: 'reviewing', label: 'Đang xem xét' },
  { value: 'planned', label: 'Đã lên kế hoạch' },
  { value: 'done', label: 'Hoàn thành' },
  { value: 'rejected', label: 'Từ chối' },
];

export const kindLabel = (kind: string) => FEEDBACK_KINDS.find((k) => k.value === kind)?.label ?? kind;
export const statusLabel = (status: string) => FEEDBACK_STATUSES.find((s) => s.value === status)?.label ?? status;

export interface Feedback {
  id: string;
  code: string;
  kind: FeedbackKind;
  title: string;
  description: string;
  status: FeedbackStatus;
  resolution_note?: string;
  page_url?: string;
  page_title?: string;
  element?: PickedElement;
  viewport?: { width: number; height: number };
  user_agent?: string;
  created_by: string;
  created_by_name: string;
  created_by_role: string;
  created_at: string;
  updated_at: string;
}

export interface CreateFeedbackInput {
  kind: FeedbackKind;
  title: string;
  description: string;
  page_url?: string;
  page_title?: string;
  element?: PickedElement;
  viewport?: { width: number; height: number };
  user_agent?: string;
}
