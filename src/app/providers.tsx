"use client";

import { SessionProvider } from "next-auth/react";
import { MutationCache, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import axios from "axios";
import { Toaster, toast } from "@/components/ui/toaster";

export function mutationErrorMessage(e: unknown, fallback = "Something went wrong. Please try again.") {
  if (axios.isAxiosError(e)) {
    if (!e.response) return "Network error. Check your connection and try again.";
    const msg = e.response.data?.error;
    if (typeof msg === "string" && msg) return msg;
  }
  return fallback;
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 60 * 1000, retry: 1 },
        },
        // Mutations without their own onError used to fail silently.
        mutationCache: new MutationCache({
          onError: (error, _vars, _ctx, mutation) => {
            if (mutation.options.onError) return;
            toast.error(mutationErrorMessage(error));
          },
        }),
      })
  );

  return (
    <SessionProvider>
      <QueryClientProvider client={queryClient}>
        {children}
        <Toaster />
      </QueryClientProvider>
    </SessionProvider>
  );
}
