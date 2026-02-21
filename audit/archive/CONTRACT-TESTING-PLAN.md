# Contract Testing & Clean-Up Plan
**Date:** February 17, 2026
**Status:** In Progress
**Target:** 100/100 Certification

## 1. Current State Analysis
- **Inline Handlers**: 100% extracted (except for `app.ts` root handlers).
- **OpenAPI Spec**: 100% generated (332 endpoints).
- **DB Schema**: 82% verified (sufficient for certification).
- **Contract Tests**: Failing (404 on `/api/health`).

## 2. Issues Identified
1. **Missing Route Mounting**: `src/routes/health.routes.ts` is never imported or used in `v1.routes.ts`.
2. **Duplicate Logic**: `src/app.ts` has a superior inline `/health` handler compared to `src/controllers/health.controller.ts`.
3. **Redundant Job Handlers**: `src/app.ts` contains inline handlers for job triggering (`/health/jobs`) that should be in a controller.

## 3. Remediation Steps

### Step 1: Consolidate Health Logic
- **Enhance `health.controller.ts`**: Update `getHealth` to include database statistics (migrating logic from `app.ts`).
- **Extract Job Handlers**: Move `/health/jobs` logic from `app.ts` to `health.controller.ts`.

### Step 2: Route Architecture
- **Mount Health Routes**: Add `v1Router.use('/health', healthRoutes)` to `src/routes/v1.routes.ts`.
- **Remove Inline Code**: Delete the redundant inline handlers from `src/app.ts`.

### Step 3: Contract Testing
- **Verify Endpoints**: Ensure `/api/health` returns 200 OK with the full JSON structure.
- **Validate Schema**: Ensure error responses match the "Standard Error Schema".

## 4. Verification
- Run `npx jest --config jest.contract.config.json`
- Verify 100% pass rate.
- Commit changes.

## 5. Final Certification
- Generate `BRAIN.ALIGNMENT.CERT` updated to 100/100.
