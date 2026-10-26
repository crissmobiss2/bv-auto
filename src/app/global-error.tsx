"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";

export default function GlobalError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, sans-serif", display: "grid", placeItems: "center", minHeight: "100vh", margin: 0 }}>
        <title>Something went wrong</title>
        <div role="alert" style={{ maxWidth: 420, textAlign: "center", padding: 24 }}>
          <h2>Something went wrong</h2>
          <p style={{ color: "#4b5563" }}>The app hit an unexpected error. Please try again.</p>
          {error.digest && <p style={{ color: "#9ca3af", fontSize: 12 }}>Reference: {error.digest}</p>}
          <button onClick={() => retry()} style={{ padding: "8px 16px", borderRadius: 6, border: "1px solid #d1d5db", cursor: "pointer" }}>
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
