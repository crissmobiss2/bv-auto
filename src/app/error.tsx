"use client";

import { ErrorFallback } from "@/components/features/error-fallback";

export default function SegmentError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return <ErrorFallback error={error} retry={retry} homeHref="/" />;
}
