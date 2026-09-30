import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  LayoutDashboard, LayoutGrid, Wrench, CalendarDays, Calendar, CalendarCheck,
  Users, Car, Building2, FileText, Receipt, TrendingUp, BarChart3, DollarSign,
  Package, ShoppingCart, Boxes, BookOpen, Brain, Timer, Shield, Megaphone,
  MessageSquare, Star, MapPin, Bell, Smartphone, Settings, HelpCircle,
  ArrowRight, CheckCircle,
} from "lucide-react";

const FLOW = [
  "Customer calls or books online at /book — a Service Request lands in your queue",
  "Create the customer + vehicle (VIN decode fills year/make/model automatically)",
  "Build a Quote with parts, labor times, and markups — send it for approval (SMS/email link)",
  "Approved quote converts to a Job — assign a technician in Dispatch",
  "Tech works from Tech View on their phone: clock in, checklist, photos, status updates",
  "Complete the job → generate the Invoice → take payment or send the pay link",
  "Review request goes out automatically — revenue shows in Pipeline and Reports",
];

const MODULES: {
  icon: React.ElementType; name: string; what: string; steps: string[]; tip?: string;
}[] = [
  {
    icon: LayoutDashboard, name: "Dashboard",
    what: "Daily command center — today's jobs, revenue, schedule, and alerts at a glance.",
    steps: [
      "Open it first thing each morning to see what's booked today",
      "Tap any job card to jump straight into the job",
      "Watch revenue and job-count cards update in real time",
    ],
  },
  {
    icon: LayoutGrid, name: "Shop Board",
    what: "Kanban view of every active job by status (scheduled → in progress → waiting → done).",
    steps: [
      "Drag a job card between columns to change its status",
      "Bottlenecks are obvious — anything stuck in 'Waiting on Parts' stands out",
    ],
  },
  {
    icon: Wrench, name: "Jobs",
    what: "The heart of the system — every repair order with tabs for details, estimate, inspection, photos, parts, and invoice.",
    steps: [
      "New Job → pick customer + vehicle → set service type and priority",
      "Add line items (parts & labor) — markups from your Price Book apply automatically",
      "Photos tab: techs upload before/during/after shots — stored in the app",
      "Inspection tab: the digital DVI checklist (green/yellow/red per item)",
      "Invoice tab: convert the job to an invoice when work is done",
    ],
    tip: "Job rows are tappable — open the job, don't hunt for an edit button.",
  },
  {
    icon: CalendarDays, name: "Schedule",
    what: "Calendar of appointments — day, week, and month views.",
    steps: [
      "Click a time slot to book a job into it",
      "Reschedule by editing the job's scheduled date",
    ],
  },
  {
    icon: Calendar, name: "Dispatch",
    what: "Assign jobs to technicians across the week (phone shows a day-by-day agenda).",
    steps: [
      "Each tech gets a column — drop their jobs onto their day",
      "The unscheduled list shows work still needing a slot",
    ],
  },
  {
    icon: CalendarCheck, name: "Service Requests",
    what: "Inbound requests from the public /book form — approve or decline each one.",
    steps: [
      "Share your /book link — customers request service without calling",
      "Approve a request to create a real job; it auto-fills customer + vehicle",
    ],
  },
  {
    icon: Users, name: "Customers",
    what: "Customer records — contact info, vehicles, history, lifetime value.",
    steps: [
      "Add Customer → name, phone, email",
      "Open a customer to see their vehicles, jobs, quotes, and invoices",
    ],
  },
  {
    icon: Car, name: "Vehicles",
    what: "Vehicle records linked to customers — VIN, plate, mileage, service history.",
    steps: [
      "Add Vehicle → enter the VIN and hit decode (or scan the door sticker with the camera button in the app)",
      "Every job ties to a vehicle so history builds itself",
    ],
  },
  {
    icon: Building2, name: "Fleet",
    what: "Commercial accounts — companies with multiple vehicles and NET billing terms.",
    steps: [
      "Add a fleet account with billing terms (NET_30, COD, etc.)",
      "Link vehicles and jobs to the fleet — open A/R balance tracked per account",
    ],
  },
  {
    icon: FileText, name: "Quotes",
    what: "Estimates sent to customers for approval before work starts.",
    steps: [
      "Build with the Quote Builder — search parts, pick labor ops, adjust markup",
      "Send → customer gets an approval link (no login needed)",
      "Their approve/decline updates the quote status instantly",
    ],
  },
  {
    icon: Receipt, name: "Invoices",
    what: "Billing — convert completed jobs to invoices, record payments, print/PDF.",
    steps: [
      "Create from the job's Invoice tab or the Invoices page",
      "Record Payment → method + amount; balance due updates",
      "Print view doubles as the PDF the customer gets",
    ],
  },
  {
    icon: TrendingUp, name: "Pipeline",
    what: "Sales funnel — open quotes and their win probability, forecasted revenue.",
    steps: [
      "See which quotes are pending and their expected value",
      "Follow up on big pending quotes before they go cold",
    ],
  },
  {
    icon: BarChart3, name: "Reports",
    what: "Business analytics — revenue, job counts, margins, technician output.",
    steps: ["Pick a date range and read the charts — no setup needed"],
  },
  {
    icon: DollarSign, name: "Payroll",
    what: "Tech hours and pay — clock-ins from Tech View feed it automatically.",
    steps: [
      "Pick the pay period → hours per tech with rates",
      "Approve to mark the period paid",
    ],
  },
  {
    icon: Package, name: "Parts",
    what: "Parts on jobs (status: ordered → received → installed), vendors, and margins.",
    steps: [
      "Parts tab: every part request across jobs with status tracking",
      "Vendors tab: your supplier accounts — name, rep, account #, ordering portal link",
      "Margins tab: parts revenue vs cost for the last 30 days",
    ],
    tip: "Commercial accounts (AutoZone Pro, O'Reilly First Call, etc.): save the rep contact, account number, and the ordering portal URL here so it's one tap to order.",
  },
  {
    icon: ShoppingCart, name: "Parts Search",
    what: "AI parts pricing across suppliers with a shared order cart tied to a job.",
    steps: [
      "Enter vehicle + part → estimates from NAPA, Worldpac, O'Reilly",
      "Prices are AI estimates — hit 'Check live' to open the real supplier site and order with your commercial account",
      "Add to Order → pick the job → creates parts requests on the job",
    ],
    tip: "For true live catalog feeds you'd need a PartsTech/Nexpart or Worldpac commercial API account — plug it in and this module goes fully live.",
  },
  {
    icon: Boxes, name: "Inventory",
    what: "On-hand stock for your own shelves — quantities, reorder points, locations.",
    steps: [
      "Add stocked items with qty, cost, and reorder threshold",
      "Low-stock items surface so you reorder before you run out",
    ],
  },
  {
    icon: BookOpen, name: "Price Book",
    what: "Your canned services and labor pricing — the menu you quote from.",
    steps: [
      "Define services once (name, labor hours, price, included parts)",
      "They drop into quotes and jobs with consistent pricing",
    ],
  },
  {
    icon: Brain, name: "Diagnostics",
    what: "AI symptom analysis, DTC lookup, OBD-II Bluetooth scanning, TSBs, and specs.",
    steps: [
      "AI Diagnosis: describe symptoms → likely causes ranked",
      "OBD-II Scan (mobile app): pair your BLE dongle → read VIN, codes, freeze frame, live data",
      "One-tap pipeline: scanned codes → AI diagnosis → drafted estimate",
      "DTC Lookup and TSB search for known fixes",
    ],
  },
  {
    icon: Timer, name: "Labor Times",
    what: "Flat-rate labor guide — look up book hours for an operation.",
    steps: ["Search the operation → standard hours feed your quote pricing"],
  },
  {
    icon: Shield, name: "Warranty",
    what: "Warranty tracking on jobs — what's covered and when it expires.",
    steps: ["Attach warranty terms to work; expiry dates are tracked"],
  },
  {
    icon: Megaphone, name: "Marketing",
    what: "Customer outreach campaigns (SMS/email) — promos, reminders, win-backs.",
    steps: [
      "Pick a template or write a message → choose the audience → send or schedule",
      "Needs Twilio/Resend keys configured to actually send",
    ],
  },
  {
    icon: MessageSquare, name: "Sequences",
    what: "Automated follow-up chains — e.g. quote sent → 2-day reminder → decline-save.",
    steps: ["Build the sequence once; it runs on its own for matching customers"],
  },
  {
    icon: Star, name: "Reviews",
    what: "Google review requests fired after completed jobs + review monitoring.",
    steps: ["Set your Google review link in Shops — requests go out automatically"],
  },
  {
    icon: MapPin, name: "Shops",
    what: "Your shop profile — name, address, phone, tax rate, labor rate, review link.",
    steps: [
      "Set your real phone number — it shows on invoices, emails, booking & portal pages",
      "Tax and labor rates flow into quotes and invoices",
    ],
  },
  {
    icon: Bell, name: "Notifications",
    what: "Your alert inbox — job updates, approvals, mentions.",
    steps: ["Unread badge on the bell; enable push on your phone for real-time pings"],
  },
  {
    icon: Smartphone, name: "Tech View",
    what: "The technician's mobile workspace — bottom nav, offline queue, clock-in.",
    steps: [
      "Techs open /tech on their phone → My Jobs",
      "Clock in → update status → run the inspection checklist → add photos",
      "Works offline in dead zones — changes queue and sync when signal returns",
    ],
  },
  {
    icon: Settings, name: "Settings & Audit Log",
    what: "Users/roles, 2FA, integrations, and the full change history.",
    steps: [
      "Settings → manage team accounts and enable TOTP two-factor",
      "Audit Log (admin): who changed what, when",
    ],
  },
];

const FIRST_WEEK = [
  { day: "Day 1", text: "Shops → enter your real shop name, phone, tax & labor rates" },
  { day: "Day 1", text: "Settings → invite your techs/advisors (staff need the invite code)" },
  { day: "Day 2", text: "Customers → add your 5 most recent customers + vehicles" },
  { day: "Day 2", text: "Price Book → enter your 10 most common services" },
  { day: "Day 3", text: "Parts → Vendors → save your AutoZone/O'Reilly/NAPA account + portal link" },
  { day: "Day 3", text: "Run one real job end-to-end: request → quote → approve → job → invoice" },
  { day: "Day 4+", text: "Share your /book link in your bio/texts — requests flow into Service Requests" },
];

export default function GuidePage() {
  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <HelpCircle className="h-6 w-6 text-blue-600" /> Walkthrough & Guide
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          How every module fits together — from first booking to paid invoice.
        </p>
      </div>

      {/* The core loop */}
      <Card>
        <CardHeader><CardTitle className="text-base">The core loop — a job&rsquo;s life</CardTitle></CardHeader>
        <CardContent>
          <ol className="space-y-2">
            {FLOW.map((step, i) => (
              <li key={i} className="flex items-start gap-3 text-sm">
                <span className="flex-shrink-0 w-5 h-5 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center mt-0.5">{i + 1}</span>
                <span className="text-gray-700">{step}</span>
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>

      {/* First week checklist */}
      <Card>
        <CardHeader><CardTitle className="text-base">Set up in your first week</CardTitle></CardHeader>
        <CardContent>
          <ol className="space-y-2">
            {FIRST_WEEK.map((item, i) => (
              <li key={i} className="flex items-start gap-3 text-sm">
                <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                <span className="text-gray-700"><Badge variant="secondary" className="mr-2 text-xs">{item.day}</Badge>{item.text}</span>
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>

      {/* Per-module guides */}
      <div className="space-y-4">
        <h2 className="text-lg font-bold text-gray-900">Every module, explained</h2>
        {MODULES.map((m) => (
          <Card key={m.name}>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <m.icon className="h-5 w-5 text-blue-600" /> {m.name}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="text-sm text-gray-600">{m.what}</p>
              <ul className="space-y-1.5">
                {m.steps.map((step, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                    <ArrowRight className="h-3.5 w-3.5 text-blue-500 mt-0.5 flex-shrink-0" /> {step}
                  </li>
                ))}
              </ul>
              {m.tip && (
                <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-2 mt-1">
                  <strong>Tip:</strong> {m.tip}
                </p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Customer-facing links</CardTitle></CardHeader>
        <CardContent className="text-sm text-gray-600 space-y-2">
          <p><Badge variant="secondary">/book</Badge> — public booking form. Share it anywhere; requests land in Service Requests.</p>
          <p><Badge variant="secondary">/portal/[token]</Badge> — customer portal link per customer: history, invoices, approvals, messaging.</p>
          <p><Badge variant="secondary">/track/[jobId]</Badge> — live job tracking the customer can watch.</p>
          <p><Badge variant="secondary">/approve/[token]</Badge> — quote approval page sent with estimates.</p>
        </CardContent>
      </Card>
    </div>
  );
}
