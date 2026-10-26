import type { Metadata } from "next";
import { Contact, LegalPage, getLegalShop } from "@/components/legal/legal-page";

export const metadata: Metadata = { title: "Privacy Policy" };
export const dynamic = "force-dynamic";

export default async function PrivacyPage() {
  const shop = await getLegalShop();
  return (
    <LegalPage title="Privacy Policy">
      <p>This policy explains how {shop.name} (&quot;we&quot;) collects and uses information when you book service, use the customer portal, or communicate with us.</p>
      <h2>Information we collect</h2>
      <ul>
        <li>Contact details: name, phone number, email address and service address.</li>
        <li>Vehicle details: year, make, model, VIN, mileage, photos and inspection results.</li>
        <li>Service history: appointments, estimates, invoices, payments and signatures.</li>
        <li>Messages you send us by text or email, and whether you opted in or out of texts.</li>
        <li>Technician location while a technician is on the way to or at your appointment.</li>
      </ul>
      <h2>How we use it</h2>
      <ul>
        <li>To schedule, perform and bill for vehicle service.</li>
        <li>To send appointment confirmations, reminders, estimates, invoices and service updates.</li>
        <li>To send maintenance reminders and offers, unless you opt out of marketing.</li>
        <li>To keep records required for accounting, tax and warranty purposes.</li>
      </ul>
      <h2>Text messages</h2>
      <p>We text you only if you agree to receive texts. Message frequency varies. Message and data rates may apply. Reply STOP to any message to stop all texts, START to resume, or HELP for help. <strong>We do not sell, rent or share your mobile number or text-messaging opt-in with third parties or affiliates for their marketing.</strong></p>
      <h2>Who we share it with</h2>
      <p>We share information only with service providers that help us run the business, and only as needed: payment processing (Stripe), text messaging (Twilio), email delivery (Resend), hosting and databases, accounting software, parts suppliers, and AI tools that help diagnose vehicles (contact details are removed before vehicle information is sent). We may also disclose information when required by law. We do not sell personal information.</p>
      <h2>Payments</h2>
      <p>Card payments are processed by Stripe. We do not store full card numbers.</p>
      <h2>How long we keep it</h2>
      <p>We keep service and billing records for as long as needed for the purposes above and for legal, tax and warranty requirements, then delete or anonymize them.</p>
      <h2>Your choices and rights</h2>
      <p>You can ask to see, correct or delete your information, or opt out of marketing, by contacting us. Depending on where you live (for example California), you may have additional rights; we will not discriminate against you for using them. Signed-in customers can also request deletion from the Privacy page in the customer portal.</p>
      <h2>Security</h2>
      <p>We use encrypted connections, access controls and audit logs to protect your information. No system is perfectly secure.</p>
      <h2>Children</h2>
      <p>Our services are not directed to children under 13, and we do not knowingly collect their information.</p>
      <h2>Changes</h2>
      <p>We may update this policy. The date at the top shows the latest version.</p>
      <h2>Contact</h2>
      <Contact shop={shop} />
    </LegalPage>
  );
}
