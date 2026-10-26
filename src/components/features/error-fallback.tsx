"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";
import { Button } from "@/components/ui/button";

/** Shared route-segment error UI (QUAL-006): no more blank screens on a render error. */
export function ErrorFallback({
  error,
  retry,
  homeHref = "/",
}: {
  error: Error & { digest?: string };
  retry: () => void;
  homeHref?: string;
}) {
  useEffect(() => {
    Sentry.captureException(error);
    console.error(error);
  }, [error]);

  return (
    <div role="alert" className="mx-auto my-16 max-w-md rounded-lg border bg-white p-6 text-center shadow-sm">
      <h2 className="text-lg font-semibold text-gray-900">Something went wrong</h2>
      <p className="mt-2 text-sm text-gray-600">
        This page hit an unexpected error. Your data is safe. Try again, or go back and retry in a moment.
      </p>
      {error.digest && <p className="mt-2 text-xs text-gray-400">Reference: {error.digest}</p>}
      <div className="mt-4 flex justify-center gap-2">
        <Button onClick={() => retry()}>Try again</Button>
        <Button variant="outline" onClick={() => (window.location.href = homeHref)}>
          Go home
        </Button>
      </div>
    </div>
  );
}
