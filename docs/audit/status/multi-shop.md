# Multi-shop isolation (AUTH-010 / DATA-001, option A)

Replaces the single-shop stopgap as the data boundary. The #66 lock still stops a shop admin from adding a second shop; new shops will come from self-signup.

## How it works
- `src/lib/tenant.ts` keeps the current shop in AsyncLocalStorage. `requireAuth`/`requireRole` (and the dashboard/settings server pages) bind every staff request to the signed-in user's `shopId` (from the JWT, refreshed every 60s; DB fallback for older tokens).
- `src/lib/prisma.ts` wraps the client in a query extension:
  - Root models (Customer, Vehicle, Job, Quote, Invoice, Payment, vendors, POs, inventory, services, bookings, campaigns, fleets, sequences, SMS, communications, reviews, payroll runs, audit log, warranties, claims, declined services, follow-ups, users) get `shopId` filters on every read/update/delete/aggregate and `shopId` stamped on creates (nested creates too).
  - Child models (line items, job parts/photos/signatures/notes/time logs, stock movements, installments, intervals, sequence steps/enrollments, sublets, payroll rates/payouts, locations, notifications, push tokens) are filtered through their parent's `shopId`.
  - Writes that reference another shop's record (e.g. `customerId` of another shop) throw `CrossShopError`; updates can't change `shopId`.
  - Without a shop context (public booking, portal/approval tokens, webhooks, crons, login) queries are unscoped; creates inherit the shop of the record they reference (a Payment takes its Invoice's shop) or fall back to the oldest active shop.
- QuickBooks/Xero connection settings are stored per shop (`<shopId>:quickbooks_connection`); payroll runs are unique per shop and period; duplicate-customer detection is limited to the current shop.

## Migration
`20261026010000_multi_shop`: adds nullable `shopId` + index to the root tables, creates a shop if none exists, assigns every existing row to it, re-keys accounting settings and swaps the payroll-run unique key. Idempotent.

## Verified
- Unit tests for the scoping rules (`tenant-scope.test.ts`).
- Against a real Postgres 17 with two shops: 20 checks (list/find/count/groupBy isolation, cross-shop update and link rejected, nested and transactional creates stamped, unscoped inheritance/fallback).
- Migration run twice on a copy of the master schema with sample data.

## Not done yet
- Public booking page still targets the oldest active shop; per-shop booking links come with branding/self-signup.
- Crons and webhooks run across all shops; per-shop sender identity is the branding step.
- Document numbers (job/quote/invoice/PO) stay globally unique.
- No browser run yet.
