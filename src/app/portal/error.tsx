"use client";

import { usePathname } from "next/navigation";
import { ErrorFallback } from "@/components/features/error-fallback";

export default function SegmentError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  // Portal visitors are signed-out guests: "home" is their tokenized portal page, not "/" (which redirects to login).
  const token = usePathname()?.split("/")[2];
  return <ErrorFallback error={error} retry={retry} homeHref={token ? `/portal/${token}` : "/portal"} />;
}
