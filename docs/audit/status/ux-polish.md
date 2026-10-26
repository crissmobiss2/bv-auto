# Status update — UX polish (branch `devin/*-ux-polish`)

- **UX-001 (fixed)**: New Job uses `CustomerCombobox`, a server-searched picker (`/api/customers?search=`). Before, it was a select capped at the first 200 customers.
- **UX-002 (fixed for numeric keypads)**: the shared `Input` defaults `inputMode="decimal"` on `type="number"`, which covers every number field. A dedicated `MoneyInput` and per-field autocapitalize/autocorrect are still open.
- **UX-004/UX-006 (fixed)**: blocking `window.alert` calls are replaced with `toast()` / `toast.error()` (`src/components/ui/toaster.tsx`, Radix Toast). A global `MutationCache.onError` shows the API error, or a network-error message, for any mutation without its own handler, so failures no longer pass silently. A retry button in the toast is still open.
- **UX-011 (fixed for shared helpers)**: `formatDate`/`formatDateTime` render in `NEXT_PUBLIC_SHOP_TIMEZONE` (default `America/Los_Angeles`, matching the server's `SHOP_TIMEZONE` default). Pages that call `toLocaleDateString` directly still use the device timezone.
- **UX-010 (partial)**: the combobox and the New Job icon button have accessible labels. The app-wide label/focus sweep is still open.
