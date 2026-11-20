'use client';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { useEffect, useMemo, useState } from 'react';
import { ScrollArea } from './ui/scroll-area';
import EmptyState from './empty';
import { MagnifyingGlassPlusIcon, XMarkIcon } from '@heroicons/react/24/solid';
import { Button } from './ui/button';
import { cn } from '@/lib/utils';

interface IMultiSelectCustom {
  options: {
    id: string;
    name: string | null;
  }[];
  placeholder?: string;
  selectedValues?: string[];
  setSelectedValues: (val: string[]) => void;
  maxDisplayItems?: number; // Số lượng item tối đa hiển thị trong trigger
  // Hỗ trợ tìm kiếm async như SelectAgentCustomWithSearch
  valSearch?: string;
  setValSearch?: (val: string) => void;
  onSearchChange?: (searchValue: string) => void;
  isLoading?: boolean;
  disabled?: boolean;
}

const MultiSelectCustom: React.FC<IMultiSelectCustom> = ({
  options,
  placeholder = 'Chọn nhiều tùy chọn',
  selectedValues = [],
  setSelectedValues,
  maxDisplayItems = 2,
  valSearch,
  setValSearch,
  onSearchChange,
  isLoading = false,
  disabled = false,
}) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  // Lọc options theo query (fallback local). Nếu có valSearch từ ngoài thì ưu tiên server-side.
  const filteredOptions = useMemo(() => {
    if (typeof valSearch === 'string') return options;
    if (!query.trim()) return options;
    return options.filter((item) =>
      item?.name?.trim()?.toUpperCase()?.includes(query.trim()?.toUpperCase())
    );
  }, [options, query, valSearch]);

  // Debounce gọi tìm kiếm async giống SelectAgentCustomWithSearch
  useEffect(() => {
    if (!onSearchChange || !setValSearch) return;
    if (!query) {
      setValSearch('');
      onSearchChange('');
      return;
    }
    const handler = setTimeout(() => {
      setValSearch(query);
      onSearchChange(query);
    }, 500);
    return () => clearTimeout(handler);
  }, [query, onSearchChange, setValSearch]);


  // Xử lý thay đổi checkbox
  const handleCheckboxChange = (optionId: string, checked: boolean) => {
    if (checked) {
      setSelectedValues([...selectedValues, optionId]);
    } else {
      setSelectedValues(selectedValues.filter((id) => id !== optionId));
    }
  };

  //   // Xử lý xóa một item đã chọn
  //   const handleRemoveItem = (optionId: string) => {
  //     setSelectedValues(selectedValues.filter((id) => id !== optionId));
  //   };

  // Xóa tất cả
  const handleClearAll = () => {
    setSelectedValues([]);
  };

  // Lấy tên của các item đã chọn
  const getSelectedNames = () => {
    return selectedValues
      .map((id) => options.find((option) => option.id === id)?.name)
      .filter(Boolean);
  };

  // Hiển thị text trong trigger
  const getDisplayText = () => {
    const selectedNames = getSelectedNames();
    if (selectedNames.length === 0) return placeholder;

    if (selectedNames.length <= maxDisplayItems) {
      return selectedNames.join(', ');
    }

    return `${selectedNames.slice(0, maxDisplayItems).join(', ')} +${
      selectedNames.length - maxDisplayItems
    } khác`;
  };

  // Kiểm tra xem option có được chọn không
  const isSelected = (optionId: string) => {
    return selectedValues.includes(optionId);
  };

  return (
    <DropdownMenu
      open={disabled ? false : open}
      onOpenChange={(val) => !disabled && setOpen(val)}
    >
      <DropdownMenuTrigger className="w-full" disabled={disabled}>
        <div
          className={cn(
            'text-secondary-foreground font-semibold text-[13px] md:text-sm xl:text-base w-full md:h-10 h-8.5 px-4 py-2 justify-between inline-flex items-center cursor-pointer gap-2 whitespace-nowrap rounded-md transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 border border-(--input) bg-white shadow-(--shadow-base) hover:bg-(--accent) hover:text-(--accent-foreground)',
            disabled && 'opacity-60 pointer-events-none'
          )}
        >
          <p className="w-full text-left truncate">{getDisplayText()}</p>
          <div className="flex items-center gap-1">
            {selectedValues.length > 0 && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0 hover:bg-destructive hover:text-destructive-foreground"
                onClick={(e) => {
                  e.stopPropagation();
                  handleClearAll();
                }}
              >
                <XMarkIcon className="h-3 w-3" />
              </Button>
            )}
            <MagnifyingGlassPlusIcon />
          </div>
        </div>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-full min-w-[300px]">
        <div className="p-2">
          <Input
            value={typeof valSearch === 'string' ? query ?? '' : query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Tìm kiếm..."
            className="mb-2"
          />

          {/* Hiển thị số lượng đã chọn */}
          {selectedValues.length > 0 && (
            <div className="flex items-center justify-between mb-2 text-sm text-muted-foreground">
              <span>Đã chọn: {selectedValues.length}</span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-xs"
                onClick={handleClearAll}
              >
                Xóa tất cả
              </Button>
            </div>
          )}
        </div>

        <ScrollArea className="2xl:w-[800px] sm:w-[500px] w-[300px] max-h-[250px]">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="text-muted-foreground">Đang tải...</div>
            </div>
          ) : !query.trim() && typeof valSearch === 'string' ? (
            <div className="p-4">
              <EmptyState />
            </div>
          ) : filteredOptions?.length > 0 ? (
            filteredOptions.map((option) => (
              <div
                key={option.id}
                className="relative flex items-center gap-2 px-3 py-2 hover:bg-accent cursor-pointer"
                onClick={() =>
                  handleCheckboxChange(option.id, !isSelected(option.id))
                }
              >
                <Checkbox
                  checked={isSelected(option.id)}
                  onChange={() => {}}
                  className="h-4 w-4"
                />
                <span className="text-sm flex-1">{option.name}</span>
              </div>
            ))
          ) : (
            <div className="p-4">
              <EmptyState />
            </div>
          )}
        </ScrollArea>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default MultiSelectCustom;
