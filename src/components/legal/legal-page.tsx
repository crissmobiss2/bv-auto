import Link from "next/link";
import { getDefaultShop } from "@/lib/shop";

export const LEGAL_UPDATED = "October 26, 2026";

export async function getLegalShop() {
  const shop = await getDefaultShop().catch(() => null);
  return {
    name: shop?.name || "B&V Mobile Auto",
    phone: shop?.phone || null,
    email: shop?.email || null,
  };
}

export function LegalPage({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-gray-50 py-10 px-4">
      <article className="mx-auto max-w-3xl rounded-xl bg-white p-6 sm:p-10 shadow-sm text-gray-700 text-sm leading-6 space-y-4 [&_h2]:text-base [&_h2]:font-semibold [&_h2]:text-gray-900 [&_h2]:pt-2 [&_ul]:list-disc [&_ul]:pl-5">
        <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
        <p className="text-xs text-gray-500">Last updated {LEGAL_UPDATED}</p>
        {children}
        <p className="pt-6 text-xs text-gray-500">
          <Link href="/privacy" className="underline">Privacy Policy</Link> · <Link href="/terms" className="underline">Terms</Link> ·{" "}
          <Link href="/book" className="underline">Book service</Link>
        </p>
      </article>
    </main>
  );
}

export function Contact({ shop }: { shop: Awaited<ReturnType<typeof getLegalShop>> }) {
  return (
    <p>
      {shop.name}
      {shop.phone && <> · {shop.phone}</>}
      {shop.email && <> · <a className="underline" href={`mailto:${shop.email}`}>{shop.email}</a></>}
    </p>
  );
}
