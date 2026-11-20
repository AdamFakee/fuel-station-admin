import * as React from 'react';
import { Ban } from 'lucide-react';

export interface EmptyProps {
  title?: string;
  description?: string;
  message?: string;
  action?: React.ReactNode;
  icon?: React.ReactNode;
}

export function Empty({
  title,
  description,
  message,
  action,
  icon,
}: EmptyProps) {
  const displayTitle = title || message || 'Không có dữ liệu';

  return (
    <div className="flex flex-col items-center justify-center p-8 text-center">
      <div className="flex flex-col items-center gap-3 max-w-sm">
        {icon ? (
          icon
        ) : (
          <div className="p-3 rounded-full bg-muted/60 text-muted-foreground">
            <Ban className="w-8 h-8" />
          </div>
        )}
        <div className="space-y-1">
          <h3 className="text-sm font-semibold text-foreground">{displayTitle}</h3>
          {description && (
            <p className="text-xs text-muted-foreground">{description}</p>
          )}
        </div>
        {action && <div className="mt-2">{action}</div>}
      </div>
    </div>
  );
}

export default Empty;
