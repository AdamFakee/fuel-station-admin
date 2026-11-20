'use client';

import * as React from 'react';
import Link from 'next/link';
import { ArrowLeftIcon } from '@heroicons/react/24/outline';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export type DetailPageHeaderMode = 'read' | 'edit';

export interface DetailPageHeaderTabDef {
  key: string;
  label: React.ReactNode;
  icon?: React.ReactNode;
  badge?: number | React.ReactNode;
}

export interface DetailPageHeaderProps {
  title: React.ReactNode;
  titlePrefix?: string;
  subtitle?: React.ReactNode;
  description?: React.ReactNode;
  badges?: React.ReactNode;
  badge?: React.ReactNode;
  back?: { to: string; label?: string };
  headerActions?: React.ReactNode;
  children?: React.ReactNode;
  mode?: DetailPageHeaderMode;
  onModeChange?: (mode: DetailPageHeaderMode) => void;
  tabs?: DetailPageHeaderTabDef[];
  activeTab?: string;
  onTabChange?: (key: string) => void;
  className?: string;
}

export function DetailPageHeader({
  title,
  titlePrefix,
  subtitle,
  description,
  badges,
  badge,
  back,
  headerActions,
  children,
  mode,
  onModeChange,
  tabs,
  activeTab,
  onTabChange,
  className,
}: DetailPageHeaderProps) {
  const displaySubtitle = subtitle || description;
  const displayBadges = badges || badge;
  const displayActions = headerActions || children;
  return (
    <div className={cn('border-b bg-background shrink-0', className)}>
      <div className="flex flex-col gap-3 px-6 py-4">
        {/* Top bar with back and actions */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            {back && (
              <Button
                variant="ghost"
                size="icon"
                asChild
                className="h-8 w-8 shrink-0 -ml-1 text-muted-foreground hover:text-foreground"
              >
                <Link href={back.to} title={back.label || 'Quay lại'}>
                  <ArrowLeftIcon className="h-4 w-4" />
                </Link>
              </Button>
            )}

            <div className="flex flex-col min-w-0">
              {titlePrefix && (
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  {titlePrefix}
                </span>
              )}
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl font-bold tracking-tight text-foreground truncate">
                  {title}
                </h1>
                {displayBadges && <div className="flex items-center gap-1.5">{displayBadges}</div>}
              </div>
              {displaySubtitle && (
                <div className="text-xs text-muted-foreground mt-0.5">{displaySubtitle}</div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {mode !== undefined && onModeChange && (
              <Button
                variant={mode === 'edit' ? 'secondary' : 'outline'}
                size="sm"
                onClick={() => onModeChange(mode === 'read' ? 'edit' : 'read')}
              >
                {mode === 'read' ? 'Chỉnh sửa' : 'Xem chi tiết'}
              </Button>
            )}
            {displayActions}
          </div>
        </div>

        {/* Tab strip if provided */}
        {tabs && tabs.length > 0 && (
          <div className="flex items-center gap-6 -mb-4 pt-1 overflow-x-auto border-t">
            {tabs.map((tab) => {
              const isActive = activeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => onTabChange?.(tab.key)}
                  className={cn(
                    'flex items-center gap-2 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap',
                    isActive
                      ? 'border-primary text-foreground font-semibold'
                      : 'border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground/30'
                  )}
                >
                  {tab.icon}
                  <span>{tab.label}</span>
                  {tab.badge !== undefined && tab.badge !== 0 && (
                    <span className="ml-1 rounded-full bg-muted px-2 py-0.5 text-xs font-semibold">
                      {tab.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export interface DetailPageFooterProps {
  mode?: DetailPageHeaderMode;
  onModeChange?: (mode: DetailPageHeaderMode) => void;
  onSave?: () => void;
  onCancel?: () => void;
  isSaving?: boolean;
  canSave?: boolean;
  hint?: React.ReactNode;
  className?: string;
}

export function DetailPageFooter({
  mode,
  onModeChange,
  onSave,
  onCancel,
  isSaving = false,
  canSave = true,
  hint,
  className,
}: DetailPageFooterProps) {
  if (mode === undefined) return null;

  return (
    <div
      className={cn(
        'sticky bottom-0 z-20 flex items-center justify-between border-t bg-background/95 backdrop-blur px-6 py-3 shrink-0 shadow-xs',
        className
      )}
    >
      <div className="text-xs text-muted-foreground">{hint}</div>
      <div className="flex items-center gap-2">
        {mode === 'read' ? (
          <Button
            size="sm"
            onClick={() => onModeChange?.('edit')}
          >
            Chỉnh sửa
          </Button>
        ) : (
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                onCancel?.();
                onModeChange?.('read');
              }}
              disabled={isSaving}
            >
              Hủy
            </Button>
            <Button
              size="sm"
              onClick={onSave}
              disabled={!canSave || isSaving}
            >
              {isSaving ? 'Đang lưu...' : 'Lưu thay đổi'}
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
