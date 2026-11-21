'use client';

import * as React from 'react';
import { ChevronsUpDownIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { BranchOption } from '../types';

interface BranchMultiSelectProps {
  branches: BranchOption[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
}

/** Ô chọn nhiều trạm xăng: bấm mở danh sách có ô tick, ô hiển thị tóm tắt các trạm xăng đã chọn. */
export function BranchMultiSelect({ branches, selectedIds, onChange }: BranchMultiSelectProps) {
  const selectedNames = branches.filter((b) => selectedIds.includes(b.id)).map((b) => b.name);

  let summary = 'Chọn trạm xăng được phép đổ';
  if (selectedNames.length === 1) summary = selectedNames[0];
  if (selectedNames.length > 1) summary = `${selectedNames[0]} và ${selectedNames.length - 1} trạm xăng khác`;

  const toggle = (branchId: string) => {
    onChange(
      selectedIds.includes(branchId) ? selectedIds.filter((id) => id !== branchId) : [...selectedIds, branchId]
    );
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className="w-full justify-between font-normal"
          data-testid="vehicle-branches"
        >
          <span className={selectedNames.length === 0 ? 'text-muted-foreground' : 'truncate'}>{summary}</span>
          <ChevronsUpDownIcon className="h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[var(--radix-popover-trigger-width)] p-1">
        <div className="max-h-56 overflow-y-auto">
          {branches.map((b) => (
            <label
              key={b.id}
              className="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent"
              data-testid={`vehicle-branch-option-${b.code}`}
            >
              <Checkbox checked={selectedIds.includes(b.id)} onCheckedChange={() => toggle(b.id)} />
              <span>{b.name}</span>
            </label>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
