---
name: confirm-dialog
description: ConfirmDialog for ALL confirmations — 4 levels (info/destructive/security/money); money+security = typed confirm.
vi: "Hộp thoại xác nhận chuẩn 4 mức; mức tiền và bảo mật phải gõ chữ xác nhận."
scope: fe
reuse: common
---

# WMS — Confirm Dialog (quick reference)

Full spec: [docs/04-engineering/confirm-dialog-spec.md](../docs/04-engineering/confirm-dialog-spec.md).

---

## Levels

| Level | When | Typed? |
|---|---|---|
| `info` | Non-destructive (logout, discard unsaved) | No |
| `destructive` | Delete entity with no money impact (role, category, archive product) | No |
| `security` | Revoke sessions, ban user, admin password reset | **Required** "OK" |
| `money` | Any money-touching action (void invoice, delete payout, refund, cancel commission) | **Required** "OK" |

**Hard rule:** money action → `level="money"`. Never use plain `variant="destructive"`.

---

## Snippet — money confirm

```tsx
import { ConfirmDialog } from "@wms/ui/confirm-dialog";

const [open, setOpen] = useState(false);
const del = useMutation({ mutationFn: deletePayout });

<ConfirmDialog
  open={open}
  onOpenChange={setOpen}
  level="money"
  title="Xoá payout #PAY-0042?"
  description="Tổng tiền 12.500.000 ₫ đã chuyển khoản cho CTV."
  consequences={[
    "3 commission entries trở về state CONFIRMED",
    "Hành động này KHÔNG hoàn tác được",
  ]}
  confirmText="Xoá payout"
  loading={del.isPending}
  onConfirm={() => del.mutate()}
/>
```

User must type "OK" before confirm button enables. Cancel or close → typed buffer resets.

---

## Snippet — security

```tsx
<ConfirmDialog
  level="security"
  title="Đăng xuất tất cả thiết bị?"
  description="Người dùng phải đăng nhập lại trên mọi thiết bị."
  consequences={["5 phiên đang hoạt động sẽ bị huỷ"]}
  ...
/>
```

---

## Snippet — destructive

```tsx
<ConfirmDialog
  level="destructive"
  title="Xoá vai trò manager?"
  description="2 người dùng đang gán vai trò này."
  confirmText="Xoá"
  onConfirm={() => deleteRole.mutate()}
/>
```

---

## Custom phrase

Default is "OK". Override for higher friction:

```tsx
<ConfirmDialog
  level="money"
  requireType={invoiceNumber}   // user must type the invoice number
  ...
/>
```

---

## Migration `<AlertDialog>` → `<ConfirmDialog>`

| Old | New |
|---|---|
| `<AlertDialog>` + manual header/footer | `<ConfirmDialog>` props |
| `<AlertDialogAction className="bg-destructive ...">` | `level="destructive"` / `"money"` / `"security"` |
| Custom inline confirm modal | Remove, use `<ConfirmDialog>` |

---

## Money-action catalog (requires `level="money"`)

- CTV payout: delete / void
- CTV commission: mark VOID / unpay
- Sales orders: refund paid order
- Sales returns: approve refund
- E-invoice: void / adjust
- Payments: delete payment record
- Vouchers: delete used voucher
- Promotion: cancel active promotion
- Purchasing: cancel PO with existing GR
- Stock adjustment: decrease ≥ value threshold

When in doubt → use `money`. False-positive (extra friction) beats false-negative (money lost).

---

## Anti-patterns

- ❌ Payout delete using plain `variant="destructive"` → bypasses typed confirm.
- ❌ Custom `<Dialog>` instead of `<ConfirmDialog>` for confirm flows.
- ❌ Phrase too long ("XOÁ NGAY KHÔNG HOÀN LẠI"). "OK" or invoice number is enough.
- ❌ Missing `loading` → double-click = double mutation.
- ❌ Generic title "Bạn có chắc?" — must be specific ("Xoá payout #PAY-0042?").

## Related skills

- /wms-fe-patterns — umbrella
- /wms-fe-edit-drawer — unsaved-changes guard usage
