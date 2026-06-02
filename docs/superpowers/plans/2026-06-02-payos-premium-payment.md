# PayOS Premium Payment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a PayOS-backed Premium checkout flow for the existing Premium screen.

**Architecture:** Keep PayOS secrets on the Express server. Store local payment records, generate signed PayOS payment-link requests server-side, and use verified webhooks as the only authority for granting Premium.

**Tech Stack:** Express, Mongoose, Vitest, Supertest, Expo React Native, built-in `fetch`, `expo-web-browser`.

---

### Task 1: Server Payment Foundation

**Files:**
- Create: `server/src/models/Payment.ts`
- Create: `server/src/services/payos.ts`
- Modify: `server/src/config/env.ts`
- Modify: `server/.env.example`
- Test: `server/src/tests/api.test.ts`

- [ ] Write failing tests for PayOS checkout creation and direct `isPremium` patch blocking.
- [ ] Implement env fields and the `Payment` model.
- [ ] Implement PayOS plan lookup, request signing, webhook signing, and payment-link creation.
- [ ] Run `npm --workspace server run test -- --runInBand` or `npm --workspace server run test` and confirm the targeted tests pass.

### Task 2: Server Routes And Webhook

**Files:**
- Create: `server/src/routes/payments.ts`
- Modify: `server/src/app.ts`
- Modify: `server/src/routes/users.ts`
- Test: `server/src/tests/api.test.ts`

- [ ] Write failing tests for webhook Premium activation, idempotent duplicate webhook handling, invalid signature rejection, and payment status lookup.
- [ ] Add authenticated create/status routes and public PayOS webhook route.
- [ ] Update `PATCH /api/users/me` so client profile updates cannot set `isPremium`.
- [ ] Run `npm --workspace server run test` and confirm the server suite passes.

### Task 3: Client Checkout Wiring

**Files:**
- Modify: `client/src/types/api.ts`
- Modify: `client/src/api/client.ts`
- Modify: `client/src/screens/PremiumBenefitsScreen.tsx`

- [ ] Add Premium plan and payment response types.
- [ ] Add API client methods for plan list, checkout creation, and payment status lookup.
- [ ] Replace fake upgrade logic with PayOS checkout opening and `refreshUser`.
- [ ] Run `npm --workspace client run typecheck` and fix type errors.

### Task 4: Final Verification

**Files:**
- All files changed above.

- [ ] Run `npm --workspace server run test`.
- [ ] Run `npm --workspace server run typecheck`.
- [ ] Run `npm --workspace client run typecheck`.
- [ ] Review `git diff --stat` and `git diff` for accidental unrelated changes.
