# Dark-mode inputs + AI diagnosis error surfacing

- **Dark-mode login inputs (UX):** `bg-gray-50/80`, `bg-gray-50/60`, `bg-white/70`, `hover:bg-white/80` and `focus:bg-white` were not remapped under `.dark`, so the login email/password fields kept a near-white background with near-white text. Remapped in `src/app/globals.css`, plus a dark `-webkit-autofill` style. Verified by headless screenshot (computed input background `rgb(255,255,255)` before, `rgb(25,31,46)` after).
- **AI diagnosis errors (UX):** the diagnostics page always showed "Make sure ANTHROPIC_API_KEY is configured". It ignored the server's JSON error on non-2xx, and its stream parser swallowed `{done, error}` events. It now shows the server's message. The OBD scanner auto-diagnose does the same.
- Not verified: the production cause of the user's diagnosis failure. Vercel env vars aren't reachable from this VM.
