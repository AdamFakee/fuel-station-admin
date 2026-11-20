import { Ban } from "lucide-react";

interface EmptyStateProps {
  message?: string;
}

const EmptyState = ({ message = "Không có dữ liệu" }: EmptyStateProps) => {
  return (
    <div className="flex flex-col items-center justify-center p-6">
      <div className="flex flex-col items-center text-center gap-4">
        <Ban className="w-12 h-12 text-gray-400" />
        <p className="text-gray-500">{message}</p>
      </div>
    </div>
  );
};

export default EmptyState;
