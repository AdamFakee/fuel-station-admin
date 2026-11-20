---
name: admin-table-format
description: Table alignment + locale — text left, numbers right, VN date + AM/PM.
vi: "Quy tắc căn lề và định dạng ngày giờ Việt Nam cho mọi bảng trong admin."
scope: fe
reuse: common
---

# Admin UI — Table Format Rules

## 1. Cell alignment

| Content type | Alignment | Tailwind |
|---|---|---|
| Text (name, code, address, status badge…) | **left** | default |
| Numbers (qty, money, percentages, counts, ID-as-number…) | **right** | `text-right tabular-nums` |
| ID code strings (`CAT-001`, `PEPSI-330`) | **left** | `font-mono text-xs` |
| Date / time | **right** | `text-right tabular-nums` |
| Action buttons (⋮, edit, delete) | **right or center** | `<div className="flex justify-end">` |

Apply to BOTH header and cell:

```tsx
{
  accessorKey: "onHand",
  id: t.wms.stockOnHand,
  header: ({ column }) => (
    <DataTableColumnHeader
      column={column}
      title={t.wms.stockOnHand}
      className="justify-end"     // ← header right
    />
  ),
  cell: ({ row }) => (
    <div className="text-right tabular-nums">
      {formatNumberVN(row.original.onHand)}
    </div>
  ),
},
```

`tabular-nums` keeps digit widths even so columns line up.

## 2. Date / time format

**Always Vietnam style + 12-hour AM/PM** — not VN's SA/CH, not ISO, not 24h.

| Pattern | Example | Helper |
|---|---|---|
| Date only | `11/05/2026` | `formatDateVN(value)` |
| Time only | `09:32 AM` | `formatTimeVN(value)` |
| Combined (default for cells) | `11/05/2026 09:32 AM` | `formatDateTimeVN(value)` |
| Add seconds | `11/05/2026 09:32:15 AM` | `formatDateTimeVN(value, true)` |

```tsx
import { formatDateTimeVN, formatNumberVN, formatCurrencyVN } from "@wms/lib/format";

<TableCell>
  <div className="text-right text-xs text-muted-foreground tabular-nums">
    {formatDateTimeVN(row.original.updatedAt)}
  </div>
</TableCell>
```

All helpers return `"—"` on null/undefined/invalid. Never crash, never emit `Invalid Date`.

## 3. Number format

Use `formatNumberVN` (locale `vi-VN`, dot grouping) not raw `.toLocaleString()`:

```ts
formatNumberVN(1234567)        // "1.234.567"
formatNumberVN(12.5, 2)        // "12,50" (decimals)
formatNumberVN(null)           // "—"
formatNumberVN("abc")          // "—"
```

For VND money: `formatCurrencyVN(value)` → `"1.234.567 ₫"`.

## 4. DON'T

- ❌ `new Date(x).toLocaleString()` — different timezones/locales render differently
- ❌ `{row.original.qty.toLocaleString()}` — ignores `null`, crashes on bad data
- ❌ Center-align numbers
- ❌ Left-align numbers in a numeric column
- ❌ Mix `Intl.DateTimeFormat("vi-VN")` (uses SA/CH) with `formatDateTimeVN` (uses AM/PM)
- ❌ `font-mono` on amounts where you also need width — `tabular-nums` is more readable

## 5. DO

- ✅ Pull from `@wms/lib/format.ts` for every formatted value in tables, detail pages, exports, toasts
- ✅ `tabular-nums` on every numeric cell
- ✅ Header `justify-end` whenever cell is right-aligned (sort caret floats left otherwise)
- ✅ Date columns also use `tabular-nums` — width-stable
- ✅ Wrap action buttons in `<div className="flex justify-end gap-1">`
- ✅ Null-safe: every formatter returns `"—"` — never render `"0"`, `"NaN"`, or `"Invalid Date"`

## 6. Format helper API

`packages/lib/src/format.ts`:

```ts
formatDateVN(input)                 // 11/05/2026
formatTimeVN(input, withSeconds?)   // 09:32 AM | 09:32:15 AM
formatDateTimeVN(input, withSeconds?) // 11/05/2026 09:32 AM
formatNumberVN(value, decimals?)    // 1.234.567 | 12,50
formatCurrencyVN(value)             // ₫1.234.567
```

All accept `Date | string | number | null | undefined`.

## 7. Reference impl

- Format helpers: `packages/lib/src/format.ts`
- Stocks table: `src/features/wms/inventory/stocks/index.tsx` — onHand/reserved/available + updatedAt
- Categories: `src/features/master-data/categories/index.tsx` — sortOrder

## 8. Locale-overriding caveat

Uses `en-GB` locale internally for date (dd/MM/yyyy) — NOT `vi-VN` (time portion gives `9:32 SA`). Mix:

- `en-GB` for date → dd/MM/yyyy
- `en-US` + `hour12: true` for time → hh:mm AM/PM
- `vi-VN` for numbers/currency → dot grouping, ₫

If exposing locale as user preference, gate behind `useT().locale` — for WMS pin to VN.
