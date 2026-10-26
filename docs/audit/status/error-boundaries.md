# Status update — error boundaries (branch `devin/*-error-boundaries`)

- **QUAL-006 (fixed)**: `error.tsx` boundaries for the root app, `(dashboard)`, `tech`, `(customer)` and `portal` share `ErrorFallback`. It shows "Something went wrong" with "Try again" (`retry()`), a "Go home" link and the error digest, and reports to Sentry. `global-error.tsx` covers root-layout failures. The dashboard boundary sits below the dashboard layout, so the sidebar stays usable when one page fails.
- **QUAL-008 (fixed)**: `vitest.config.ts` → `vitest.config.mts` (ESM, `import.meta.url` alias), which silences the Vite native-config-loader CJS warning.
