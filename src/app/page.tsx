import type { Metadata } from "next";
import Link from "next/link";
import { APP_NAME } from "@/lib/app-name";
import { PLANS, TRIAL_DAYS } from "@/lib/billing";

export const metadata: Metadata = {
  title: { absolute: `${APP_NAME} — Shop management software for independent auto repair` },
  description:
    "Jobs, estimates, invoices, online booking, customer texts, parts, inventory and payroll in one app for independent and mobile auto repair shops.",
  alternates: { canonical: "/" },
};

const FEATURES = [
  ["Jobs, estimates and invoices", "Build estimates, send them for online approval, turn them into jobs and invoices, and take card payments."],
  ["Online booking", "Each shop gets its own booking link for its website or Google profile. New requests alert your team."],
  ["Customer texts and email", "Confirmations, reminders and review requests, with recorded consent and STOP/START handling."],
  ["Parts and inventory", "Purchase orders, partial receiving and a stock ledger that never goes negative."],
  ["Technician app", "Clock in and out, job timers, inspections with photos, and AI-assisted diagnosis."],
  ["Payroll and reports", "Hours, overtime and commissions with locked pay periods, plus revenue and job reports."],
];

export default function Home() {
  const plans = PLANS.filter((p) => p.id !== "founding");
  const founding = PLANS.find((p) => p.id === "founding");
  return (
    <div className="min-h-screen bg-white text-gray-900">
      <header className="border-b">
        <div className="mx-auto max-w-6xl flex items-center justify-between px-4 py-4">
          <span className="text-lg font-bold">{APP_NAME}</span>
          <nav className="flex items-center gap-4 text-sm">
            <a href="#pricing" className="hover:underline">Pricing</a>
            <Link href="/login" className="hover:underline">Sign in</Link>
            <Link href="/signup" className="rounded-md bg-indigo-600 px-3 py-2 font-semibold text-white hover:bg-indigo-700">Start free trial</Link>
          </nav>
        </div>
      </header>

      <main>
        <section className="mx-auto max-w-6xl px-4 py-20 text-center">
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight">Run your repair shop from one app</h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-gray-600">
            Estimates, jobs, invoices, booking, customer texts, parts and payroll, built for independent and mobile auto repair shops.
          </p>
          <div className="mt-8 flex justify-center gap-3">
            <Link href="/signup" className="rounded-md bg-indigo-600 px-5 py-3 font-semibold text-white hover:bg-indigo-700">Start your {TRIAL_DAYS}-day free trial</Link>
            <Link href="/login" className="rounded-md border px-5 py-3 font-semibold hover:bg-gray-50">Sign in</Link>
          </div>
          <p className="mt-3 text-sm text-gray-500">No card needed to start.</p>
        </section>

        <section className="bg-gray-50 py-16">
          <div className="mx-auto grid max-w-6xl gap-6 px-4 md:grid-cols-3">
            {FEATURES.map(([title, text]) => (
              <div key={title} className="rounded-lg border bg-white p-6">
                <h2 className="font-semibold">{title}</h2>
                <p className="mt-2 text-sm text-gray-600">{text}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="pricing" className="mx-auto max-w-6xl px-4 py-16">
          <h2 className="text-center text-3xl font-bold">Simple monthly pricing</h2>
          <p className="mt-2 text-center text-gray-600">Every plan starts with a {TRIAL_DAYS}-day free trial. Cancel anytime.</p>
          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {plans.map((p) => (
              <div key={p.id} className="rounded-lg border p-6">
                <h3 className="text-lg font-semibold">{p.name}</h3>
                <p className="mt-2 text-3xl font-bold">${p.price}<span className="text-base font-normal text-gray-500">/month</span></p>
                <ul className="mt-4 space-y-1 text-sm text-gray-600">{p.features.map((f) => <li key={f}>• {f}</li>)}</ul>
                <Link href="/signup" className="mt-6 block rounded-md bg-indigo-600 px-4 py-2 text-center font-semibold text-white hover:bg-indigo-700">Start free trial</Link>
              </div>
            ))}
          </div>
          {founding && (
            <p className="mt-6 text-center text-sm text-gray-600">
              <strong>Founding offer:</strong> Pro for ${founding.price}/month, price locked for 12 months, for the first 20 shops.
            </p>
          )}
        </section>
      </main>

      <footer className="border-t">
        <div className="mx-auto flex max-w-6xl flex-wrap gap-4 px-4 py-6 text-sm text-gray-500">
          <span>© {APP_NAME}</span>
          <Link href="/privacy" className="hover:underline">Privacy</Link>
          <Link href="/terms" className="hover:underline">Terms</Link>
        </div>
      </footer>
    </div>
  );
}
