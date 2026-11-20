---
name: fe-detail-page
description: Full-page detail screen — DetailPageHeader shell + sticky footer + mode toggle. Use over edit-drawer when URL must carry state.
vi: "Màn chi tiết cả trang với khung DetailPageHeader, footer dính, chế độ xem/sửa."
scope: fe
reuse: common
---

# wms-fe-detail-page — Canonical full-page detail shell

Status: live (FE only)
Owner: wms-frontend
Applies to: `nf/wms/frontend/admin` and any future WMS admin/kiosk Vite app

## Why

Right-drawer detail (`<EditDrawer>`) works for most edit/inspect flows. It breaks for:

- Deep state per record (5+ tabs: overview/roles/audit/sessions/security)
- Direct bookmarks: "open `/system/accounts/{id}` in new tab" — drawer can't carry this
- Heavy left-rail navigation where the drawer would obscure context

`<DetailPageHeader>` is the page-level sibling to `<EditDrawer>`. **Same prop surface where it overlaps** (titlePrefix / badges / statusBanner / kebabActions / mode / onModeChange / tabs). The footer is a separate component (`<DetailPageFooter>`) that sits at the bottom of the viewport.

## When to use

USE `<DetailPageHeader>` for:
- A route whose URL is `…/:id` and the page shows ONE record.
- Multi-tab record-detail where the user expects deep-link bookmarks.
- Screens whose actions span the whole row (Delete + Reset Password + Disable + …).

DO NOT use for:
- Row-pick-from-list flows where the user repeatedly opens/closes records → use `<EditDrawer>`.
- Create flows. Detail header assumes the record exists.
- Pages without a single subject (dashboards, lists, calendars).

## Surface

```ts
import {
  DetailPageHeader,
  DetailPageFooter,
  DetailPageDirtyGuard,
  useDirtyNavGuard,
  ServerPagination,
  type DetailPageHeaderProps,
  type DetailPageHeaderTabDef,
  type DetailPageHeaderMode,
  type StatusBannerDef,
  type KebabAction,
} from "@/components/detail-page-header";
```

### `<DetailPageHeader>` props

| Prop            | Required | Type                                  | Notes                                                                              |
| --------------- | -------- | ------------------------------------- | ---------------------------------------------------------------------------------- |
| `title`         | yes      | `ReactNode`                           | Big header title (usually `user.displayName`).                                     |
| `titlePrefix`   | no       | `string`                              | Muted label before the title. Usually `t.edit.typePrefix.detail`.                  |
| `subtitle`      | no       | `ReactNode`                           | Optional second-line description directly below the AppHeader bar.                 |
| `badges`        | no       | `ReactNode`                           | Inline with the title (status pill, system-role badge, email chip).                |
| `back`          | no       | `{ to: string; label?: string }`      | Left-arrow back link. Renders as a ghost button inside AppHeader.                  |
| `headerActions` | no       | `ReactNode`                           | Right edge of the bar — icon buttons (delete, etc.).                               |
| `kebabActions`  | no       | `KebabAction[]`                       | Secondary actions in a kebab dropdown. Same shape as `EditDrawerKebabAction`.      |
| `statusBanner`  | no       | `StatusBannerDef`                     | Sticky info/warning/danger row under the header.                                   |
| `mode`          | no       | `"read" \| "edit"`                    | Controlled detail mode. Omit to skip mode toggle entirely.                         |
| `onModeChange`  | no       | `(m) => void`                         | Required when `mode` is passed. Consumer flips state in mutation `onSuccess`.      |
| `tabs`          | no       | `DetailPageHeaderTabDef[]`            | Renders the tab strip. Tab body lives in the caller (not inside the header).       |
| `activeTab`     | no       | `string`                              | Controlled active tab key.                                                         |
| `onTabChange`   | no       | `(k: string) => void`                 |                                                                                    |

Two variants:
- `<DetailPageHeader>` — wraps an internal `<DirtyProvider>` so the footer can read the active tab's save handle without extra wiring.
- `<DetailPageHeader.Inner>` — skips the auto-wrap. Use when the page already needs a `<DirtyProvider>` at a higher level.

### `DetailPageHeaderTabDef`

```ts
interface DetailPageHeaderTabDef {
  key: string;            // stable; also used for dirty-state registration
  label: ReactNode;
  icon?: ReactNode;
  badge?: number | ReactNode;   // hidden when 0/undefined
}
```

Note: **smaller** than `EditDrawerTabDef` — no `content` / `padded`. Full-page detail keeps tab content under the caller's control so routes can deep-link any sub-state. The header only renders the strip.

### `<DetailPageFooter>` (sticky)

```tsx
<DetailPageFooter
  activeTabKey={tab}             // which tab's save handle drives [Lưu]
  mode={mode}                    // "read" | "edit"
  onModeChange={setMode}
  hint="Không thể sửa vai trò hệ thống"  // optional, left-aligned
/>
```

Sits fixed at the bottom of the viewport. (Note 2026-07: component sống trong `@wms/ui` nhưng chưa màn nào trong `features/` dùng — màn phiếu workflow dùng footer hành động riêng của document pattern; chỉ dùng `DetailPageFooter` khi cần mode read/edit toggle thuần form.) Mode rules mirror `<EditDrawer>`:

```
mode === "read"  → footer is a single [Sửa] button calling onModeChange("edit")
mode === "edit"  → [Huỷ] + [Lưu]. Save is disabled until handle.dirty && canSave.
mode === undefined → footer renders nothing (caller opted out of the toggle).
```

### Mode + URL persistence

Encode mode in the URL so refresh keeps the user in the same state:

```ts
const mode = (params.get("mode") as DetailPageHeaderMode | null) ?? "read";
const setMode = (m: DetailPageHeaderMode) => {
  const next = new URLSearchParams(params);
  if (m === "read") next.delete("mode");
  else next.set("mode", m);
  setParams(next, { replace: true });
};
```

Same trick for tabs (`?tab=overview`). When the route mounts, `mode=edit&tab=audit` cleans up to `tab=audit` because audit isn't an editable tab — clamp inside `onTabChange` / `onModeChange` (see `features/sales/ctv/detail.tsx` for a live mode+tab URL sync).

### Dirty-state plumbing

Same as `<EditDrawer>`. Each form tab registers an imperative save handle:

```tsx
function OverviewTab({ user, onSaved }: { user: AdminUser; onSaved: () => void }) {
  const readOnly = useEditModeReadOnly();
  const dirty = /* compute */;
  const save = useMutation({ onSuccess: () => { onSaved(); /* parent flips mode → read */ } });

  useRegisterSaveHandle("overview", readOnly ? null : {
    dirty,
    saving: save.isPending,
    canSave: dirty && valid,
    save: () => save.mutate(),
    cancel: () => resetForm(),
  });
}
```

Two patterns:
1. **Parent owns mode**, child reports dirty. Save success → parent flips mode to read.
2. Read-only tabs (Audit, Sessions, Security) should NOT register a save handle. Footer hides itself when there's no handle.

### `useDirtyNavGuard()` + `<DetailPageDirtyGuard>`

For in-app navigations that would discard pending edits:

```tsx
const guard = useDirtyNavGuard();
// later
<Button onClick={() => guard.run(() => navigate("/system/accounts"))}>
  Back to list
</Button>

<DetailPageDirtyGuard {...guard.dialogProps} />
```

External navigations (page reloads, browser back) are intentionally NOT intercepted — that needs `useBlocker` from React Router and gets noisy.

## Server pagination

`<ServerPagination>` is exported from the same package:

```tsx
<ServerPagination
  page={page}              // 1-indexed
  pageSize={pageSize}
  totalCount={total}
  pageSizeOptions={[25, 50, 100]}
  onPageChange={setPage}
  onPageSizeChange={setPageSize}
/>
```

Keep URL state for `?page=` and `?size=` so deep-links survive.

## Reference implementation

- `src/features/wms/facilities/detail/index.tsx` — full-page detail nhiều tab nhất (6 tab, folder-per-tab, readiness banner).
- `src/features/sales/ctv/detail.tsx` — detail + mode/tab URL sync + `data-layout="fixed"` full-height.
- 23 màn `src/features/**/detail.tsx` đều là consumer — grep `DetailPageHeader` để xem thêm.
- Shell: `@wms/ui/detail-page-header` (`frontend/packages/ui/src/detail-page-header/`); admin dùng qua shim `src/components/detail-page-header.tsx` (bơm AppHeader chrome qua render-prop — cứ import `@/components/detail-page-header`).

## Anti-patterns

- **Don't** put tab content inside `DetailPageHeaderTabDef.content` — the header only renders the strip. Bodies live in the route file.
- **Don't** render your own bottom action bar. Use `<DetailPageFooter>` for consistent button positions.
- **Don't** mix `<DetailPageHeader>` (auto-DirtyProvider) with a manually-wrapped `<DirtyProvider>` above it — pick one. Use `.Inner` for the "I want my own provider" case.
- **Don't** read `?tab=` from inside a tab body. Pass it down so the URL stays the single source of truth.
- **Don't** import `Sheet*` from this folder. Drawer flows use `<EditDrawer>`; page flows use this header. The two never mix.

## Create flows

Create is **not** a detail-page flow — there is no record to "read" first.
- Phiếu workflow (PO/GR/SO/Transfer) → trang create riêng theo `/wms-document-screen` (DocumentCreateLayout + scan zone), vd `features/wms/purchasing/purchase-orders-create.tsx`.
- Master đơn giản → dialog/drawer trong list (vd `features/sales/ctv/_edit-affiliate-dialog.tsx`). Decision logic: `docs/04-engineering/detail-screen-pattern.md` (DOC-049).

On successful create, navigate to the new record's detail page (`navigate(`/system/accounts/${id}`)`). If the BE returns a one-shot tempPassword, hand off to a small dialog first, then navigate after confirmation.

## Post-create readiness banner

When a record requires multi-step setup after creation (link FKs, seed children, flip capability flags), surface a **readiness checklist banner** on the detail page instead of forcing the wizard into the create form. Pattern:

1. Extract a sibling component, e.g. `_readiness-banner.tsx` next to tab files under `features/<area>/detail/`.
2. Fetch each "signal" via its existing list query (counts only — pass `pageSize: 1` when supported) so cached data is reused once the user navigates into the tab.
3. Render via `<StatusBanner>` and pass `children` (added 2026-05) for the multi-item list.
4. Tone heuristic: 1–2 outstanding items → `warning`, 3+ → `danger`.
5. Hide banner entirely when nothing is missing (quiet UI wins).
6. Each row should expose an action button navigating straight to the tab where the admin can fix it.

Live reference: `features/wms/facilities/detail/_readiness-banner.tsx`
(STORE / CONSIGNMENT: HUB links, catalog count, `sell_pos` capability).
HUB-type warehouses skip the checklist — gate on `requiresProductScope`.

## Full-height (kín đáy) — contract `data-layout="fixed"`

Bug LẶP NHIỀU LẦN: form/panel detail không kín đáy màn hình, hoặc dùng magic `h-[calc(100vh-56px)]`. Contract đúng:

```tsx
// route element gốc của màn detail
<div data-layout="fixed" className="flex h-full min-h-0 flex-col">
  {/* header + tab strip (auto height) */}
  <div className="flex-1 min-h-0 overflow-auto">…tab body…</div>
</div>
```

- `data-layout="fixed"` → `SidebarInset` khoá `h-svh` (app shell xử lý), KHÔNG tự `h-screen`/`h-[calc(100vh-Npx)]`.
- Mọi tầng giữa: `flex flex-col` + con cuộn được = `flex-1 min-h-0` (thiếu `min-h-0` = flexbox không cho co → tràn).
- Live: `features/sales/ctv/detail.tsx`, `features/sales/channels/detail.tsx`, `components/wms/document-create-layout.tsx`.

## Cross-reference

- `docs/04-engineering/detail-screen-pattern.md` (DOC-049) — decision matrix for picking this shell vs `<EditDrawer>`.
- `skills/wms-fe-edit-drawer.md` — drawer flow. Shares prop language for `kebabActions`, `statusBanner`, `mode`, `onModeChange`.
- `skills/wms-fe-routes.md` — when a `/:id` route deserves a folder vs single file.

## Related skills

- /wms-fe-patterns — umbrella decision tree
- /wms-friendly-urls — code-based URL pattern
- /wms-fe-edit-drawer — sibling: drawer alternative
