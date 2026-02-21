# AUDIT CORRECTION — Orphaned Controllers

**Date:** February 17, 2026  
**Status:** ❌ **DELETION BLOCKED**

---

## ORIGINAL FINDING (INCORRECT)

The alignment audit reported 4 "orphaned" controllers:
- `admin-reports.controller.ts`
- `dashboard-urgent.controller.ts`
- `documents-templates.ts`
- `payout-statement-template.ts`

**Detection Method:** Searched for imports using pattern `import.*{filename}` in route files.

---

## CORRECTED FINDING (AFTER DEPENDENCY SCAN)

### ✅ ALL 4 FILES ARE ACTIVELY USED

| File | Used By | Import Pattern |
|---|---|---|
| `admin-reports.controller.ts` | `admin.routes.ts` | `from '../controllers/admin-reports.controller'` |
| `dashboard-urgent.controller.ts` | `dashboard.routes.ts`<br>`dashboard-urgent.service.ts` | `from '../controllers/dashboard-urgent.controller'`<br>`export * from './dashboard-urgent.service'` |
| `documents-templates.ts` | `documents.controller.ts` | `from './documents-templates'` |
| `payout-statement-template.ts` | `dashboard.routes.ts`<br>`finance.controller.ts` | Dynamic import: `await import('../controllers/payout-statement-template')` |

---

## ROOT CAUSE OF FALSE POSITIVE

The initial grep search pattern was too strict:

```bash
# This pattern FAILED to find dynamic imports and non-.controller imports
grep -l "$name" src/routes/*.ts
```

**Missed patterns:**
- Dynamic imports: `await import('./payout-statement-template')`
- Non-controller files: `documents-templates.ts` (no `.controller` suffix)
- Service re-exports: `export * from './dashboard-urgent.service'`

---

## CORRECTED AUDIT RESULT

**Orphaned Controllers:** **0** (not 4)

All controllers are actively used in the codebase.

---

## LESSONS LEARNED

1. **Grep patterns must account for:**
   - Dynamic imports (`await import()`)
   - Re-exports (`export * from`)
   - Files without `.controller` suffix
   - Relative vs absolute import paths

2. **Better detection method:**
   ```bash
   # Search for ANY reference to the filename (without extension)
   grep -r "filename-without-extension" src/ --include="*.ts"
   ```

3. **Always run dependency scan before deletion**
   - The Pre-Delete Safety Protocol caught this error
   - Without it, we would have deleted 4 actively-used files

---

## UPDATED ALIGNMENT SCORE

| Metric | Before | After |
|---|---|---|
| Orphaned Controllers | 4 | 0 |
| Alignment Score | 78/100 | **82/100** |

**Status:** Still **NOT CERTIFIED** (OpenAPI coverage and contract tests remain critical gaps)

---

## ACTION ITEMS

1. ✅ **CANCEL** deletion of all 4 files
2. ✅ Update alignment report to reflect 0 orphaned controllers
3. ✅ Improve grep patterns in audit scripts
4. ⏭️ Focus on real issues: OpenAPI spec generation + contract testing

---

**Signed:** Pre-Delete Safety Committee  
**Date:** February 17, 2026
