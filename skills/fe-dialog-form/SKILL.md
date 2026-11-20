---
name: fe-dialog-form
description: Dialog + form — DialogContent size prop + DialogBody, no inline className.
vi: "Mẫu Dialog + form chuẩn: DialogContent size và DialogBody."
scope: fe
reuse: common
---

# wms-fe-dialog-form — Canonical Dialog + Form Pattern

Status: live (FE only)
Owner: wms-frontend
Applies to: `nf/wms/frontend/admin`

## Why

Previously each dialog self-composed layout via inline className: `className="sm:max-w-2xl flex flex-col h-[85vh] overflow-hidden"`. Result:
- 44 places set their own max-width — no way to change globally
- Header/footer `shrink-0`, scroll wrapper `flex-1 overflow-y-auto min-h-0`, and resize handle all duplicated per file

**`<DialogContent size="...">` + `<DialogBody>` is canonical. No inline layout, no custom drawing.**

---

## Components

### `dialog.tsx` exports

```tsx
// Size map (max-width):
// sm   → sm:max-w-sm   (384px)
// md   → sm:max-w-lg   (512px)
// lg   → sm:max-w-2xl  (672px)
// xl   → sm:max-w-3xl  (768px)
// 2xl  → sm:max-w-5xl  (1024px)
// full → sm:max-w-[90vw]
```

| Component | Role | Built-in classes |
|---|---|---|
| `<DialogContent size="md">` | Shell + backdrop + close btn | `flex flex-col gap-4 p-4 rounded-xl` |
| `<DialogContent resizable>` | + drag handle + fixed height | `h-[85vh]` start, user can drag |
| `<DialogHeader>` | Title area | `flex flex-col gap-2 shrink-0 pr-6` |
| `<DialogBody>` | Scrollable content | `flex-1 overflow-y-auto min-h-0 -mx-4 px-4` |
| `<DialogFooter>` | Action buttons | `-mx-4 -mb-4 flex shrink-0 ... border-t bg-muted/50` |
| `<WizardSteps steps={[]} current={n}>` | Step indicator | `packages/ui/src/wizard-steps.tsx` |

### `wizard-steps.tsx`

```tsx
import { WizardSteps } from "@wms/ui/wizard-steps";

// current = 1-based step number
<WizardSteps steps={["Thông tin", "Thuộc tính", "Biến thể"]} current={step} />
```

---

## Patterns

### 1. Simple dialog (fixed size)

```tsx
import {
  Dialog, DialogBody, DialogContent,
  DialogFooter, DialogHeader, DialogTitle,
} from "@wms/ui/dialog";

<Dialog open={open} onOpenChange={onOpenChange}>
  <DialogContent size="md">
    <DialogHeader>
      <DialogTitle>Thêm danh mục</DialogTitle>
    </DialogHeader>

    <DialogBody>
      <form id="create-category-form" onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="name">Tên *</Label>
          <Input id="name" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        {/* ... more fields ... */}
      </form>
    </DialogBody>

    <DialogFooter>
      <Button variant="outline" onClick={() => onOpenChange(false)}>Huỷ</Button>
      <Button type="submit" form="create-category-form" disabled={isPending}>
        {isPending ? "Đang lưu..." : "Lưu"}
      </Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

**Key rules:**
- `<form>` INSIDE `<DialogBody>`, NOT wrapping `<DialogFooter>`
- `<form id="...">` + `<Button type="submit" form="...">` — HTML5 form association
- `<DialogFooter>` AFTER `</DialogBody>`, still inside `<DialogContent>`

### 2. Resizable dialog (complex forms, tables)

```tsx
<DialogContent size="xl" resizable>
  <DialogHeader>
    <DialogTitle>Tạo đơn hàng</DialogTitle>
  </DialogHeader>

  <DialogBody>
    {/* Long content, tables, many fields */}
  </DialogBody>

  <DialogFooter>
    {/* ... */}
  </DialogFooter>
</DialogContent>
```

`resizable` → starts at `h-[85vh]`, drag handle at bottom edge to resize.

### 3. Multi-step wizard

```tsx
const STEPS = ["Thông tin", "Thuộc tính", "Biến thể"];

<DialogContent size="lg" resizable>
  <DialogHeader>
    <DialogTitle>Thêm sản phẩm</DialogTitle>
    <WizardSteps steps={STEPS} current={step} />
  </DialogHeader>

  <DialogBody>
    {step === 1 && <Step1Form />}
    {step === 2 && <Step2Form />}
    {step === 3 && <Step3Form />}
  </DialogBody>

  <DialogFooter>
    {step > 1 && (
      <Button variant="outline" onClick={() => setStep(s => s - 1)}>Quay lại</Button>
    )}
    <div className="flex-1" />
    <Button variant="outline" onClick={() => onOpenChange(false)}>Huỷ</Button>
    {step < STEPS.length && (
      <Button onClick={() => setStep(s => s + 1)} disabled={!canAdvance}>Tiếp</Button>
    )}
    {step === STEPS.length && (
      <Button onClick={handleSubmit} disabled={isPending}>Tạo</Button>
    )}
  </DialogFooter>
</DialogContent>
```

### 4. Complex layout (Tabs, progress views)

When content has its own `flex-1 + overflow` (e.g. Tabs, ProgressView), do NOT use `<DialogBody>`. Use step content as direct children of DialogContent:

```tsx
<DialogContent size="2xl" resizable>
  <DialogHeader>...</DialogHeader>

  {/* Tabs manage their own flex-1 + overflow */}
  <Tabs className="flex-1 min-h-0 flex flex-col">
    <TabsList>...</TabsList>
    <TabsContent className="flex-1 overflow-auto">...</TabsContent>
  </Tabs>

  {/* NO DialogBody here */}
</DialogContent>
```

### 5. Preview / zero-padding dialog

```tsx
// Example: file preview, image viewer
<DialogContent size="full" resizable showCloseButton={false} className="p-0 gap-0">
  <header className="flex items-center border-b px-4 py-3">
    {/* Custom header */}
    <Button variant="ghost" size="icon" onClick={onClose}><X /></Button>
  </header>
  <div className="flex-1 overflow-auto">
    {/* Content */}
  </div>
</DialogContent>
```

---

## Size guide

| Dialog type | Suggested size |
|---|---|
| 1-3 fields (confirm, PIN, invite) | `sm` |
| Standard form (4-8 fields) | `md` |
| Form + table (orders, payout) | `xl` + `resizable` |
| Multi-step wizard (product create) | `lg` or `xl` + `resizable` |
| Role editor / import preview / bulk | `2xl` + `resizable` |
| File preview, fullscreen viewer | `full` + `resizable` |

---

## FORBIDDEN

```tsx
// ❌ Inline max-width
<DialogContent className="sm:max-w-2xl">

// ❌ Manual flex-col layout
<DialogContent className="flex flex-col h-[85vh] overflow-hidden">

// ❌ Manual scroll wrapper
<div className="flex-1 overflow-y-auto min-h-0">

// ❌ Manual shrink-0 on header/footer
<DialogHeader className="shrink-0">
<DialogFooter className="shrink-0">

// ❌ Form wrapping footer
<form onSubmit={...}>
  <DialogBody>...</DialogBody>
  <DialogFooter>  {/* ← WRONG: footer inside form */}
    <Button type="submit">Lưu</Button>
  </DialogFooter>
</form>

// ❌ Multi-step without WizardSteps (Badge không đủ)
<Badge>Bước {step}/3</Badge>
```

---

## Checklist when creating a new form dialog

- [ ] `<DialogContent size="...">` — pick correct size, no className max-w
- [ ] `<DialogBody>` — wrap all form fields
- [ ] `<form id="...">` inside DialogBody, does NOT wrap DialogFooter
- [ ] Submit button uses `form="..."` attribute
- [ ] Multi-step → `<WizardSteps>` inside `<DialogHeader>`
- [ ] Complex layout (Tabs/progress) → no DialogBody, direct children
- [ ] `resizable` if content is long, has tables, or is multi-step

---

## Reference files

| Pattern | File |
|---|---|
| Simple form | `src/features/master-data/categories/index.tsx` |
| Form + table (resizable) | `src/features/sales/ctv/_create-payout-dialog.tsx` |
| Multi-step wizard | `src/features/products/_create-product-dialog.tsx` |
| Tabs layout (no DialogBody) | `src/components/settings/role-edit-dialog.tsx` |
| Zero-padding (file preview) | `src/components/attachments/file-preview-modal.tsx` |
| Import + progress view | `src/features/wms/facilities/_import-products-dialog.tsx` |
