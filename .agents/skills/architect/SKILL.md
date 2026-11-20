---
name: architect
description: "Answer WMS architecture/design/convention questions from docs (INDEX.md registry + 04-engineering), never from memory. Triggers: kiến trúc."
metadata:
  project: wms
  reuse: common
  scope: root
  tier: project
  vi: Trả lời câu hỏi kiến trúc/quy ước bằng cách đọc đúng tài liệu, không đoán.
---
<!-- gsskill: architect v1.0.0 · tier=project · GENERATED — sửa ở gs.agentskill/skills/, đừng sửa file này -->

# Architect — Documentation Router

When user asks about WMS architecture / design / conventions: read the right doc, then answer. No guessing, no memory. Always `Read` file first.

## Lookup order

1. **docfinder MCP** (doc không được inject): `docs_for_code("<path>")` / `search_docs("<chủ đề>")` / `get_section`.
2. **`docs/INDEX.md`** — master DOC-NNN registry, đọc khi cần map chủ đề → file.
3. Decision table dưới đây cho các câu hỏi lặp lại nhiều.

## Decision table (path THẬT — cây docs đánh số 00→08)

| Question | File |
|---|---|
| Kiến trúc tổng / module system v2 / boot phases? | `docs/04-engineering/architecture-reference-2026-07.md` |
| Manifest pattern? Thêm operation/endpoint? | skill `/gs-manifest` + `docs/04-engineering/api-surface.md` |
| Logging? `WmsLog.Audit`? | `docs/04-engineering/logging.md` |
| Test infrastructure? Testcontainers? | `docs/04-engineering/testing.md` |
| `// magic-ok:` / `// audit-ok:` / `// smell-ok:` syntax? | `docs/04-engineering/suppression-syntax.md` |
| Guid v7? UTC? OCC? CancellationToken convention? | `docs/04-engineering/identifiers-time.md` |
| Const mới để đâu? PageDefaults / QueryLimits / StateActions? | `docs/04-engineering/domain-constants.md` |
| Workflow/state machine động? | `docs/04-engineering/workflow-be-data-contract.md` + skill `/wms-workflow-design` |
| Multi-tenant SQL leak? | `docs/05-security/multitenant-isolation.md` |
| ADR (quyết định kiến trúc)? | `docs/04-engineering/ADR-*.md` |
| FE architecture? | `docs/04-engineering/frontend-architecture.md`, `fe-screen-architecture.md` |
| Deploy targets? | `docs/04-engineering/deploy-targets.md` (DOC-106) |
| Audit reports hiện trạng? | `docs/07-reports/` |

## Workflow

1. Map question → doc (bảng trên / INDEX.md / docfinder).
2. `Read` full file — đa số 80-300 dòng. Don't skim.
3. Answer + cite đường dẫn + section.
4. User muốn sửa code? Route: audit → `/wms-audit-code`; version mismatch → `/wms-health-check`; docs mới → `/wms-docs-layout` + `/wms-write-docs`.

## If answer not in docs

1. Grep code: `grep -rn "<symbol>" backend/src/`
2. Framework: `external/gs-backend/docs/` (`IMPLEMENTED-API.md` = API có thật)
3. Ask user if still ambiguous

## Anti-patterns

- ❌ Answer from memory without reading file (drifts as codebase updates)
- ❌ Read CLAUDE.md then infer — CLAUDE.md is index only
- ❌ Read all doc files at once — token waste. Read the right file.
- ❌ Create new doc when an existing file fits — add a section instead (`/wms-docs-layout` trước khi tạo .md mới)

## Related skills

- /wms-pitfalls — known anti-patterns
- /wms-docs-layout — where docs live
- /wms-write-docs — doc style + placement

---

<!-- skill-log-footer -->
> **Ghi sổ dùng skill.** Tool `Skill` đã được hook ghi tự động. Nếu bạn dùng nội dung
> skill này mà KHÔNG qua tool đó, hoặc nó chạy sai, hãy ghi một dòng:
> ```bash
> python D:/erp/gs.agentskill/bin/skill_log.py use architect --project wms
> python D:/erp/gs.agentskill/bin/skill_log.py use architect --project wms --status error --note "sai ở đâu"
> ```
