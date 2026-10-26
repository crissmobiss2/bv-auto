"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import axios from "axios";

export function useBilling() {
  return useQuery({
    queryKey: ["billing"],
    queryFn: () => axios.get("/api/billing").then((r) => r.data),
    staleTime: 5 * 60 * 1000,
  });
}

export function BillingBanner() {
  const { data } = useBilling();
  if (!data || data.state === "exempt" || data.state === "active") return null;
  const days: number = data.trialDaysLeft ?? 0;
  const text =
    data.state === "trial" ? `Free trial: ${days} day${days === 1 ? "" : "s"} left.` :
    data.state === "grace" ? "Your last payment failed. Update your card to keep access." :
    "Your subscription has ended. You can view your data, but changes are paused.";
  return (
    <div role="status" className={`px-4 py-2 text-sm flex items-center justify-between gap-3 ${data.state === "trial" ? "bg-indigo-50 text-indigo-800" : "bg-red-50 text-red-800"}`}>
      <span>{text}</span>
      <Link href="/billing" className="font-semibold underline whitespace-nowrap">{data.state === "trial" ? "Choose a plan" : "Go to Billing"}</Link>
    </div>
  );
}
