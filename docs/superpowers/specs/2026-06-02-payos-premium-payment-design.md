# PayOS Premium Payment Design

## Goal

Replace the current simulated Premium upgrade with a PayOS checkout flow. A user selects one of three Premium plans, opens a PayOS payment link, and receives Premium only after the server verifies PayOS webhook data.

## Plans

- `premium_month`: 39,000 VND, display `39k/tháng`
- `premium_quarter`: 99,000 VND, display `99k/3 tháng`
- `premium_half`: 199,000 VND, display `199k/6 tháng`

## Architecture

The client never receives PayOS secrets. It calls the Express API with the selected `planId`; the server signs a PayOS payment-link request using `PAYOS_CHECKSUM_KEY`, stores a local payment record, and returns `checkoutUrl`.

PayOS `returnUrl` and `cancelUrl` are treated as user-interface navigation only. The server grants Premium from the webhook after verifying the HMAC SHA256 signature over the webhook `data` payload.

## Server Changes

- Add PayOS env keys in `server/src/config/env.ts` and `server/.env.example`:
  - `PAYOS_CLIENT_ID`
  - `PAYOS_API_KEY`
  - `PAYOS_CHECKSUM_KEY`
  - `PAYOS_RETURN_URL`
  - `PAYOS_CANCEL_URL`
  - `PAYOS_API_BASE_URL`, defaulting to `https://api-merchant.payos.vn`
- Add a `Payment` Mongoose model for PayOS Premium payment records.
- Add a PayOS service for plan lookup, signature generation, webhook signature verification, and REST calls to PayOS.
- Add `paymentsRouter`:
  - `GET /api/payments/premium/plans`
  - `POST /api/payments/payos/create`
  - `GET /api/payments/payos/:orderCode`
  - `POST /api/payments/payos/webhook`
- Remove client ability to directly patch `isPremium` through `PATCH /api/users/me`.

## Client Changes

`PremiumBenefitsScreen` shows the three approved plan prices. Pressing upgrade calls `api.createPayosPremiumPayment(token, { planId })`, opens the returned checkout URL with `expo-web-browser`, and refreshes the user after the browser closes.

The already-Premium view remains unchanged. Any payment failure or missing checkout URL shows a user-facing alert.

## Error Handling

- Invalid plan IDs return `400`.
- Missing PayOS configuration returns `500` with a clear server-side integration message.
- PayOS non-success responses return `502`.
- Webhooks with invalid signatures return `400` and do not mutate users or payments.
- Duplicate successful webhooks are idempotent.

## Testing

Server tests cover checkout creation, webhook verification, idempotent Premium activation, invalid webhook signatures, and blocking direct `isPremium` profile patches.

Client typecheck covers new API types and screen integration. No PayOS network calls are made in tests; tests stub `fetch`.
