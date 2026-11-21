import * as React from "react"

import { cn } from "@/lib/utils"

function Table({ className, ...props }: React.ComponentProps<"table">) {
  return (
    <div
      data-slot="table-container"
      className="relative w-full flex-1 min-h-0 overflow-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden [&:has([data-table-empty])>table]:h-full"
    >
      <table
        data-slot="table"
        className={cn("w-full caption-bottom text-sm", className)}
        {...props}
      />
    </div>
  )
}

function TableHeader({ className, ...props }: React.ComponentProps<"thead">) {
  return (
    <thead
      data-slot="table-header"
      className={cn("bg-muted [&_tr]:border-b", className)}
      {...props}
    />
  )
}

function TableBody({ className, ...props }: React.ComponentProps<"tbody">) {
  return (
    <tbody
      data-slot="table-body"
      className={cn("[&_tr:last-child]:border-0 bg-white", className)}
      {...props}
    />
  )
}

function TableFooter({ className, ...props }: React.ComponentProps<"tfoot">) {
  return (
    <tfoot
      data-slot="table-footer"
      className={cn(
        "bg-muted/50 border-t font-medium [&>tr]:last:border-b-0",
        className
      )}
      {...props}
    />
  )
}

function TableRow({ className, ...props }: React.ComponentProps<"tr">) {
  return (
    <tr
      data-slot="table-row"
      className={cn(
        "group/row hover:bg-muted/40 data-[state=selected]:bg-muted border-b border-border/60 transition-colors",
        props.onClick && "cursor-pointer",
        className
      )}
      {...props}
    />
  )
}

function TableHead({ className, ...props }: React.ComponentProps<"th">) {
  return (
    <th
      data-slot="table-head"
      className={cn(
        "sticky top-0 z-[2] bg-muted text-muted-foreground text-xs h-11 px-4 text-left align-middle font-semibold uppercase tracking-wide whitespace-nowrap [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]",
        className
      )}
      {...props}
    />
  )
}

function TableCell({ className, ...props }: React.ComponentProps<"td">) {
  return (
    <td
      data-slot="table-cell"
      className={cn(
        "px-4 py-3 text-sm text-foreground font-normal align-middle whitespace-nowrap [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]",
        className
      )}
      {...props}
    />
  )
}

function TableCaption({
  className,
  ...props
}: React.ComponentProps<"caption">) {
  return (
    <caption
      data-slot="table-caption"
      className={cn("text-muted-foreground mt-4 text-sm", className)}
      {...props}
    />
  )
}


/**
 * Cột "Thao tác" luôn dính mép phải: bảng rộng cuộn ngang thì nút vẫn nằm trong tầm nhìn và bấm được.
 * Dùng cho `TableHead` và `TableCell` của cột thao tác (có bóng nhẹ bên trái để tách khỏi nội dung đang cuộn dưới nó).
 */
export const ACTION_HEAD_CLASS =
  "sticky right-0 top-0 z-[4] bg-muted text-right shadow-[-6px_0_6px_-6px_rgba(15,23,42,0.18)]"
export const ACTION_CELL_CLASS =
  "sticky right-0 z-[1] bg-card text-right shadow-[-6px_0_6px_-6px_rgba(15,23,42,0.18)] group-hover/row:bg-[color-mix(in_oklab,var(--color-muted)_40%,var(--color-card))]"

export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
}
