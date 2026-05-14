import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { prisma } from "@/lib/prisma";
import { Suspense } from "react";
import { IntegrationsPanel } from "./integrations-panel";
import { TotpSettings } from "./totp-settings";

export default async function SettingsPage() {
  const session = await auth();
  if (!session) redirect("/login");
  if (!["ADMIN", "ACCOUNTANT"].includes(session.user.role)) redirect("/dashboard");

  const users = await prisma.user.findMany({
    where: { isActive: true },
    select: { id: true, name: true, email: true, role: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });

  return (
    <div className="max-w-4xl space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Settings</h1>

      <Card>
        <CardHeader><CardTitle className="text-base">Team Members</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-3">
            {users.map((u) => (
              <div key={u.id} className="flex items-center justify-between p-3 border rounded-lg">
                <div>
                  <p className="font-medium text-sm">{u.name}</p>
                  <p className="text-xs text-gray-500">{u.email}</p>
                </div>
                <span className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded font-medium">
                  {u.role.replace(/_/g, " ")}
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Business Information</CardTitle></CardHeader>
        <CardContent className="text-sm text-gray-600 space-y-2">
          <p>Configure your business name, address, tax rates, and invoice templates in <strong>Shops &amp; Locations</strong>.</p>
        </CardContent>
      </Card>

      <TotpSettings />

      <div>
        <h2 className="text-lg font-semibold text-gray-800 mb-3">Accounting Integrations</h2>
        <Suspense fallback={<div className="text-sm text-gray-400 p-4">Loading integrations...</div>}>
          <IntegrationsPanel />
        </Suspense>
      </div>

      <div>
        <h2 className="text-lg font-semibold text-gray-800 mb-3">Coming Soon</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {[
            { name: "CARFAX", desc: "Automatically submit service records and pull vehicle history reports.", emoji: "🚗" },
            { name: "PartsTech", desc: "Order parts from 30,000+ suppliers directly from job files.", emoji: "🔩" },
            { name: "Mitchell 1 ProDemand", desc: "Access factory repair procedures, wiring diagrams, and TSBs.", emoji: "📋" },
            { name: "ALLDATA", desc: "OEM repair data and diagnostic procedures for all makes.", emoji: "🔎" },
          ].map((item) => (
            <Card key={item.name} className="opacity-70">
              <CardContent className="pt-4 pb-4 flex items-start gap-3">
                <span className="text-2xl">{item.emoji}</span>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-sm">{item.name}</p>
                    <Badge variant="secondary" className="text-xs">Coming Soon</Badge>
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">{item.desc}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
