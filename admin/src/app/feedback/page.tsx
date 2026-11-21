import type { Metadata } from 'next';
import { FeedbackPage } from '@/features/feedback/components/feedback-page';

export const metadata: Metadata = {
  title: 'Góp ý & Phản hồi - Fuel Station Admin',
};

export default function Page() {
  return <FeedbackPage />;
}
