---
name: search-api
description: Accent-insensitive search across 3 tiers (DB/BE/FE) — VN unaccent + `field:value` tokens + paged response + client filter helper.
metadata:
  project: wms
  reuse: common
  scope: root
  tier: project
  vi: Thêm tìm kiếm không dấu 3 tầng DB, BE, FE cho một module.
---
<!-- gsskill: wms-search v1.0.0 · tier=project · GENERATED — sửa ở gs.agentskill/skills/, đừng sửa file này -->

> 🔐 Tài khoản/mật khẩu thử **không viết thẳng vào tài liệu**. Đọc từ môi trường, giá trị nằm ở
> `D:/gs.secret/wms.env` (`WMS_ADMIN_EMAIL` · `WMS_ADMIN_PASSWORD` · `WMS_DEV_SEED_PASSWORD`):
> `set -a; . D:/gs.secret/wms.env; set +a`
>
> 🧪 **Ở môi trường TEST thì đọc thẳng, đừng hỏi lại người dùng.** Bí mật test nằm ở
> `secrets/<môi-trường>.env` **trong chính repo** (`.gitignore` cạnh thư mục chặn) đúng để mọi phiên
> đọc được mà không phải đi hỏi ai — hỏi lại là bắt người dán mật khẩu vào khung chat, chỗ tệ hơn hẳn
> một tệp bị gitignore. Vẫn không in giá trị ra câu trả lời. Luật đầy đủ + ranh giới ba kho →
> `/gs-test-env`.

# WMS — List Search Pattern

When adding a `GET /v1/<resource>` list endpoint, always wire through this pattern instead of ad-hoc LIKE clauses. First proven on `/v1/product-categories` (see `Modules/Product/ProductStore.cs` + `Modules/Product/ProductEndpoints.cs`).

## What you get for free

- **Accent-insensitive Vietnamese search** — `do uong` matches `Đồ uống`. Done by `public.wms_unaccent()` SQL function.
- **Smart `field:value` tokens** — `code:SKU-001 lifebuoy` → `code LIKE 'SKU-001' AND (name LIKE '%lifebuoy%' OR ...)`. Quoted values supported: `name:"đồ uống"`.
- **Functional indexes** — Postgres uses the index when WHERE predicate matches.
- **Whitelist-driven field map** — typo-resistant; unknown fields silently ignored.

## Components

| File | Role |
|---|---|
| `migrations/<module>/V00X__search.sql` | Per-table: adds index on `wms_unaccent(name)` and `lower(code)`. Function created in `migrations/product/V003__search.sql` (idempotent — safe to re-run). |
| `Modules/Search/SearchSpec.cs` | Parser: raw query → `Fields` dict + `FreeText`. |
| `Modules/Search/SearchSql.cs` | SQL builder: `AppendWhere(spec, sql, params, fieldMap, freeTextColumns)`. |
| `Modules/<Module>/<Entity>Store.cs` | Define `static FieldMap` + `FreeTextColumns`, call `SearchSql.AppendWhere`. |
| `Modules/<Module>/<Entity>Endpoints.cs` | `var spec = SearchSpec.Parse(search); store.ListAsync(spec, …);` |

## Add search to a new entity — 5 steps

### 1. Migration (index only, not the function)

`migrations/<module>/V00X__search.sql`:

```sql
-- The wms_unaccent() function is already created by migrations/product/V003__search.sql
-- and lives in the public schema. We only need per-table indexes here.

CREATE INDEX IF NOT EXISTS ix_<table>_name_unaccent
    ON <schema>.<table> (public.wms_unaccent(name))
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS ix_<table>_code_lower
    ON <schema>.<table> (lower(code))
    WHERE deleted_at IS NULL;
```

### 2. Store: declare field map + free-text columns

```csharp
private static readonly IReadOnlyDictionary<string, (string Column, bool Unaccent)> FieldMap =
    new Dictionary<string, (string, bool)>(StringComparer.OrdinalIgnoreCase)
    {
        ["code"] = ("code", false),   // SKU/code: exact-ish, no diacritics
        ["name"] = ("name", true),    // human-readable: VN-unaccent
        ["sku"]  = ("sku",  false),   // alias if applicable
    };

private static readonly IReadOnlyList<(string Column, bool Unaccent)> FreeTextColumns =
    new[] { ("name", true), ("code", false) };
```

### 3. Store: search method using `SearchSql.AppendWhere`

```csharp
public async Task<IReadOnlyList<TEntity>> ListAsync(SearchSpec search, int limit, int offset, CancellationToken ct)
{
    var sql = new StringBuilder(@"
        SELECT id, tenant_id, code, name, ...
        FROM <schema>.<table>
        WHERE tenant_id = @TenantId AND deleted_at IS NULL");
    var p = new DynamicParameters();
    p.Add("TenantId", TenantId);
    SearchSql.AppendWhere(search, sql, p, FieldMap, FreeTextColumns);
    sql.Append(" ORDER BY ... LIMIT @Limit OFFSET @Offset");
    p.Add("Limit", limit);
    p.Add("Offset", offset);

    var rows = await db.QueryAsync<TEntity>(sql.ToString(), p);
    return rows.ToList();
}

public Task<int> CountAsync(SearchSpec search, CancellationToken ct)
{
    var sql = new StringBuilder(@"
        SELECT COUNT(*) FROM <schema>.<table>
        WHERE tenant_id = @TenantId AND deleted_at IS NULL");
    var p = new DynamicParameters();
    p.Add("TenantId", TenantId);
    SearchSql.AppendWhere(search, sql, p, FieldMap, FreeTextColumns);
    return db.ExecuteScalarAsync<int>(sql.ToString(), p);
}
```

### 4. Endpoint: parse + paged shape

Shape + pagination + FE wiring = việc của `/wms-list-endpoint` (canonical `{ items, page, pageSize, totalCount, totalPages }` — KHÔNG dùng `total`). Skill này chỉ lo phần search:

```csharp
var spec  = SearchSpec.Parse(search);              // field:value tokens + free text
var items = await s.ListAsync(spec, ps, p * ps, ct);
var total = await s.CountAsync(spec, ct);          // → map vào totalCount/totalPages theo /wms-list-endpoint
```

Required `using`:
```csharp
using WmsStack.Api.Modules.Search;
```

### 5. Verify

```bash
TOKEN=$(curl -s -X POST http://localhost:3003/admin/v1/auth/login \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"$WMS_ADMIN_EMAIL\",\"password\":\"$WMS_ADMIN_PASSWORD\"}" | jq -r .accessToken)

# Free text — VN unaccent works both ways
curl -sH "Authorization: Bearer $TOKEN" "http://localhost:3003/v1/<resource>?search=do%20uong"
curl -sH "Authorization: Bearer $TOKEN" "http://localhost:3003/v1/<resource>?search=ĐỒ%20UỐNG"

# Field token
curl -sH "Authorization: Bearer $TOKEN" "http://localhost:3003/v1/<resource>?search=code%3ACAT-001"

# Combined
curl -sH "Authorization: Bearer $TOKEN" "http://localhost:3003/v1/<resource>?search=code%3AHM%20uong"

# Pagination
curl -sH "Authorization: Bearer $TOKEN" "http://localhost:3003/v1/<resource>?page=0&pageSize=10"
```

Expected response shape (canonical — xem `/wms-list-endpoint`):
```json
{ "items": [...], "page": 0, "pageSize": 10, "totalCount": 42, "totalPages": 5 }
```

## DON'T

- ❌ Write `LOWER(name) LIKE LOWER(@search)` ad-hoc per Store. Use `SearchSql`.
- ❌ Concatenate user input into SQL. Always use `DynamicParameters`.
- ❌ Use `Postgres unaccent` extension — requires CREATE EXTENSION privilege not granted. Use `wms_unaccent()`.
- ❌ Skip `WHERE deleted_at IS NULL` on the functional index — bloats index with tombstones.
- ❌ Add fields to `FieldMap` the Store doesn't need — keep minimal.

## DO

- ✅ Run `bash external/gs-backend/scripts/audit-sql.sh` after edits — checks tenant scoping + parameterisation.
- ✅ Document field tokens in OpenAPI summary if adding Scalar tags.
- ✅ Default page size from `PageDefaults.Default` (50). High-volume endpoints → `PageDefaults.LargeDefault` (100).
- ✅ For aliases, add multiple keys to same column. E.g. both `code` and `sku` → `("sku", false)`.

## Limitations

- Strips diacritics; does NOT stem (`uống/uong` works, `đẹp/đẹp đẽ` doesn't).
- For full-text + ranking, use `search.index` table via skill `gs-search`.
- Fuzzy matching (typos) requires `pg_trgm` similarity — not in scope here.

## 3-tier overview

| Tier | File | Role |
|---|---|---|
| **DB** | `migrations/product/V003__search.sql` | `public.wms_unaccent()` function (Vietnamese → ASCII lower). Idempotent. |
| **DB** | `migrations/<module>/V0XX__<entity>_search.sql` | Functional indexes per entity. |
| **BE** | `Modules/Search/SearchSpec.cs` | Parser: raw query → `Fields` dict + `FreeText`. |
| **BE** | `Modules/Search/SearchSql.cs` | Builder: `AppendWhere(spec, sql, params, fieldMap, freeTextColumns)`. |
| **FE** | `frontend/packages/lib/src/unaccent.ts` | JS port — `unaccent(s)` + `unaccentIncludes(haystack, needle)`. |

Goal: `Mo hinh` ≈ `Mô hình` ≈ `MÔ HÌNH` at both BE and FE — no per-tier mismatch.

## Frontend usage

### Server-side search (preferred when BE supports)

Pass raw `search` text to BE; BE handles unaccent via `SearchSpec/SearchSql`:

```typescript
const { data } = fooApi.useList({
  search: debouncedSearch || undefined,
  page: page - 1,
  pageSize,
});
```

Standard approach. When BE is wired with `SearchSpec.Parse`, don't filter again client-side.

### Client-side search (when loading all rows + filtering locally)

Use when page has status/category filters needing responsiveness and row count is small (<500). Import JS unaccent helper:

```typescript
import { unaccentIncludes } from "@wms/lib/unaccent";

const filtered = allProducts.filter((p) => {
  if (debouncedSearch) {
    if (
      !unaccentIncludes(p.name,  debouncedSearch) &&
      !unaccentIncludes(p.sku,   debouncedSearch) &&
      !(p.nameEn && unaccentIncludes(p.nameEn, debouncedSearch))
    ) return false;
  }
  // ... other filters ...
  return true;
});
```

`unaccentIncludes("Mô hình BFT", "mo hinh")` → `true`. Bidirectional.

**Implementation (FE):**
```typescript
export function unaccent(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")  // strip combining diacritics
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase();
}
```

NFD decompose splits `ô` → `o` + combining circumflex, then regex strips combining marks. `đ/Đ` doesn't decompose — handled separately.

### Mirror semantics — invariant rule

JS `unaccent()` MUST return the same result as SQL `public.wms_unaccent()`:
- Same Vietnamese → ASCII character map
- Same lowercase
- Same treatment for `đ/Đ`

If you change one side, change both + test:
```sql
SELECT public.wms_unaccent('Tiếng Việt');  -- expected: 'tieng viet'
```
```typescript
unaccent("Tiếng Việt")  // expected: "tieng viet"
```

## Reference implementations

### DB
- Function + indexes: `nf/wms/backend/migrations/product/V003__search.sql`
- Products indexes: `migrations/product/V009__products_search.sql`
- Suppliers indexes: `migrations/purchasing/V004__suppliers_search.sql`

### BE
- Spec parser: `Modules/Search/SearchSpec.cs`
- SQL builder: `Modules/Search/SearchSql.cs`
- Categories: `ProductStore.ListCategoriesAsync` / `CountCategoriesAsync`
- Products: `ProductStore.ListViewAsync` / `CountAsync` (with categoryId filter)
- Suppliers: `PurchasingStore.ListSuppliersAsync` / `CountSuppliersAsync`
- Endpoint pattern: `ProductEndpoints` GET `/v1/products`, `/v1/product-categories`

### FE
- Helper: `frontend/packages/lib/src/unaccent.ts`
- Server-side: `features/wms/purchasing/suppliers.tsx`
- Client-side: `features/products/index.tsx`

## Related skills

- `wms-list-endpoint.md` — full list-endpoint pattern (pagination + canonical response shape + CRUD)
- `wms-i18n-permissions.md` — i18n labels for permission keys

---

<!-- skill-log-footer -->
> **Ghi sổ dùng skill.** Tool `Skill` đã được hook ghi tự động. Nếu bạn dùng nội dung
> skill này mà KHÔNG qua tool đó, hoặc nó chạy sai, hãy ghi một dòng:
> ```bash
> python D:/erp/gs.agentskill/bin/skill_log.py use wms-search --project wms
> python D:/erp/gs.agentskill/bin/skill_log.py use wms-search --project wms --status error --note "sai ở đâu"
> ```
