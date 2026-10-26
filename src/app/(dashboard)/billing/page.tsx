"use client";

import { useState } from "react";
import axios from "axios";
import { toast } from "@/components/ui/toaster";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useBilling } from "@/components/billing/billing-banner";

type Plan = { id: string; name: string; price: number; features: string[]; available: boolean };

const STATE_TEXT: Record<string, string> = {
  exempt: "Your shop has free access.",
  active: "Your subscription is active.",
  grace: "Your last payment failed. Update your card in Manage billing to avoid losing access.",
  trial: "You're on the free trial.",
  locked: "Your trial or subscription has ended. You can still view your data, but changes are paused until you choose a plan.",
};

export default function BillingPage() {
  const { data } = useBilling();
  const [busy, setBusy] = useState<string | null>(null);

  const go = async (path: string, body: object, key: string) => {
    setBusy(key);
    try {
      const { data: r } = await axios.post(path, body);
      window.location.href = r.url;
    } catch (e) {
      toast.error(axios.isAxiosError(e) ? e.response?.data?.error ?? "Something went wrong" : "Something went wrong");
      setBusy(null);
    }
  };

  if (!data) return <p className="text-gray-500">Loading…</p>;
  const plans = (data.plans as Plan[]).filter((p) => p.available);

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold">Billing</h1>
        <p className="text-gray-600 mt-1">{STATE_TEXT[data.state]}</p>
        {data.state === "trial" && data.trialEndsAt && (
          <p className="text-gray-600">Trial ends {new Date(data.trialEndsAt).toLocaleDateString()}.</p>
        )}
        {data.plan && <p className="text-gray-600">Current plan: {data.plans.find((p: Plan) => p.id === data.plan)?.name ?? data.plan}</p>}
      </div>
      {data.hasBillingAccount && (
        <Button variant="outline" disabled={busy !== null} onClick={() => go("/api/billing/portal", {}, "portal")}>
          {busy === "portal" ? "Opening…" : "Manage billing (card, invoices, cancel)"}
        </Button>
      )}
      {data.state !== "exempt" && data.state !== "active" && data.state !== "grace" && (
        !data.configured || plans.length === 0 ? (
          <p className="text-sm text-gray-500">Online sign-up for plans isn&apos;t open yet. Contact us to subscribe.</p>
        ) : (
          <div className="grid gap-4 md:grid-cols-3">
            {plans.map((p) => (
              <Card key={p.id}>
                <CardHeader><CardTitle>{p.name}</CardTitle><p className="text-2xl font-bold">${p.price}<span className="text-sm font-normal text-gray-500">/month</span></p></CardHeader>
                <CardContent className="space-y-3">
                  <ul className="text-sm text-gray-600 space-y-1">{p.features.map((f) => <li key={f}>• {f}</li>)}</ul>
                  <Button className="w-full" disabled={busy !== null} onClick={() => go("/api/billing/checkout", { plan: p.id }, p.id)}>
                    {busy === p.id ? "Opening checkout…" : `Choose ${p.name}`}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )
      )}
    </div>
  );
}
