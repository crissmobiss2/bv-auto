import type { Metadata } from "next";
import { Contact, LegalPage, getLegalShop } from "@/components/legal/legal-page";

export const metadata: Metadata = { title: "Terms of Service" };
export const dynamic = "force-dynamic";

export default async function TermsPage() {
  const shop = await getLegalShop();
  return (
    <LegalPage title="Terms of Service">
      <p>These terms apply when you book or receive service from {shop.name} (&quot;we&quot;), or use our booking page, customer portal or text messages.</p>
      <h2>Estimates and authorization</h2>
      <p>We give you an estimate before starting work. We will not perform work or charge more than the approved amount without your approval, which you can give in writing, through the portal, or by text. Diagnostic time may be charged even if you decline the repair.</p>
      <h2>Appointments</h2>
      <p>Booking requests are confirmed once we contact you. Mobile service requires a safe, legal place to work on the vehicle. Please tell us as early as possible if you need to cancel or reschedule.</p>
      <h2>Payment</h2>
      <p>Payment is due when work is complete unless we agree otherwise. Deposits may be required for parts or large jobs and are applied to your invoice. Card payments are processed by Stripe.</p>
      <h2>Refunds</h2>
      <p>If you believe a charge is wrong, contact us and we will review it. Approved refunds go back to the original payment method.</p>
      <h2>Parts and warranty</h2>
      <p>Parts carry the manufacturer&apos;s or supplier&apos;s warranty. Any labor warranty will be stated on your invoice. Warranties do not cover misuse, accidents, or parts supplied by the customer.</p>
      <h2>Diagnostic information</h2>
      <p>We may use software, including AI tools, to help diagnose problems and look up parts. A technician reviews that information; it is not a guarantee of the cause or the final cost.</p>
      <h2>Text messaging program</h2>
      <p>If you opt in, {shop.name} will text you about your appointments, estimates, invoices and service updates, and, unless you opt out of marketing, maintenance reminders and offers. Message frequency varies. Message and data rates may apply. Reply STOP to cancel, START to resume, or HELP for help. Consent to texts is not a condition of purchase. Carriers are not liable for delayed or undelivered messages.</p>
      <h2>Limitation of liability</h2>
      <p>To the extent allowed by law, our liability for any claim is limited to the amount you paid for the service involved. Nothing here limits rights you have under consumer protection law.</p>
      <h2>Changes</h2>
      <p>We may update these terms. The date at the top shows the latest version.</p>
      <h2>Contact</h2>
      <Contact shop={shop} />
    </LegalPage>
  );
}
