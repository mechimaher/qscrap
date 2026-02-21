# Support Dashboard Audit Report - Feb 2026

## 1. Executive Summary
The support dashboard serves as the "Industrial Control Room" for QScrap operations, allowing agents to manage customer issues, orders, and tickets. This audit reveals a system with a strong technical foundation (RBAC, real-time sockets) but significant "logic drift" and "hardcode rot" that affects business accuracy, particularly in financial operations (refunds/cancellations).

## 2. Component Mapping & Architecture
- **Frontend Hub:** `support-dashboard.html` / `js/support-dashboard.js`
- **Backend Orchestrator:** `src/controllers/support.controller.ts`
- **Business Logic Layer:**
    - `src/services/support/support.service.ts` (Legacy/Common functionality)
    - `src/services/support/support-actions.service.ts` (Enterprise-grade actions with Finance integration)
    - `src/services/finance/refund-calculator.service.ts` (Refund Source of Truth)
- **Database Tables:** `support_tickets`, `chat_messages`, `refunds`, `resolution_logs`, `customer_notes`.

---

## 3. High-Priority Issues: Hardcoded Values & Logic Drift

### 3.1 Hardcoded Financial Constants (Frontend)
The `quickAction` function in `js/support-dashboard.js` contains hardcoded business rules that bypass the backend's `refund-calculator.service.ts`:
- **Platform Fees:** Hardcoded at 20% in frontend calculations (`partPrice * 0.20`).
- **Delivery Fees:** Hardcoded at 10 QAR (`deliveryFee = 10`).
- **Policy Mismatch:** The frontend enforces "BRAIN v3.0 Stage 7" rules (Post-delivery deductions) manually in the UI string builders, rather than fetching them from a central policy API.

### 3.2 Refund Logic Desync (BRAIN v3.0 vs v3.1)
- **Frontend:** Implements BRAIN v3.0 logic (Stage 7 focus).
- **SupportActionsService:** Implements BRAIN v3.0 (Stage-based refund calculation).
- **SupportService (Legacy):** Implements BRAIN v3.1 (First cancellation free policy, max fee cap).
> [!WARNING]
> This split creates "calculation anxiety" for agents. Depending on which endpoint or service is invoked, the fee might vary (e.g., 5% vs 10% vs FREE for first-time).

### 3.3 Modal Strings & Labels
- **Status Labels:** Many status mappings (e.g., `cancelled_by_ops`, `refund_pending`) are hardcoded in `renderOrders` and `renderResolutionLog` instead of being driven by a centralized status dictionary.
- **Refund Reasons:** The dropdown options for "Request Refund" are hardcoded strings in the JS, making it impossible to update policy-compliant reasons without a code change.

---

## 4. Business Flow Gaps

### 4.1 "Goodwill Credit" is a Stub
The `goodwill_credit` action is currently a "logging-only" operation. It records the interaction in `resolution_logs` but does not actually issue credit to the customer's wallet or loyalty account because the relevant tables (e.g., `loyalty_points`) are not consistently integrated or available on current VPS environments.

### 4.2 Spare Parts Transparency
While `getOrderDetailsForSupport` retrieves rich bid data, the agent dashboard doesn't fully display **garage-specific part photos** (bid images) in the main flow, requiring agents to rely on text descriptions, which complicates "Defective Part" disputes.

### 4.3 Cancellation Friction
The `cancel_order` flow in `js/support-dashboard.js` doesn't always perform a "pre-flight" check on the driver’s current physical location (from `delivery_assignments`), which can lead to ghost cancellations for orders already picked up by a driver but not yet marked "in transit".

---

## 5. Remediation Plan

1. **[P0] Centralize Refund Calculation:** Deprecate frontend-side math. Modify `quickAction` to call a `preview-refund` API that uses `refund-calculator.service.ts`.
2. **[P1] Unified Constants:** Move fees (20%, 10 QAR) to a `ConfigService` or global settings table.
3. **[P1] Policy Alignment:** Upgrade all services to BRAIN v3.1 (First-time free, Max QAR cap) to ensure consistency.
4. **[P2] Feature Fulfillment:** Implement the backend ledger logic for "Goodwill Credit".
5. **[P2] UI Polish:** Move status colors and labels to a centralized mapping object.

---
*Audit conducted by Antigravity AI - Feb 21, 2026*
