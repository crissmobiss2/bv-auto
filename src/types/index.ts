import type {
  User,
  Customer,
  Vehicle,
  Job,
  Quote,
  Invoice,
  LineItem,
  Payment,
  JobPart,
  PartsVendor,
  Note,
  JobPhoto,
  Signature,
  CarfaxRecord,
  AuditLog,
  Communication,
  FollowUp,
} from "@prisma/client";

export type {
  User,
  Customer,
  Vehicle,
  Job,
  Quote,
  Invoice,
  LineItem,
  Payment,
  JobPart,
  PartsVendor,
  Note,
  JobPhoto,
  Signature,
  CarfaxRecord,
  AuditLog,
  Communication,
  FollowUp,
};

export type JobWithRelations = Job & {
  customer: Customer;
  vehicle: Vehicle;
  technician?: User | null;
  quote?: Quote & { lineItems: LineItem[] } | null;
  invoice?: Invoice & { lineItems: LineItem[]; payments: Payment[] } | null;
  parts: (JobPart & { vendor?: PartsVendor | null })[];
  photos: JobPhoto[];
  jobNotes: (Note & { author: User })[];
  signatures: Signature[];
  carfaxRecords: CarfaxRecord[];
};

export type CustomerWithRelations = Customer & {
  vehicles: Vehicle[];
  jobs: Job[];
  invoices: Invoice[];
  followUps: FollowUp[];
};

export type QuoteWithRelations = Quote & {
  job: Job & { vehicle: Vehicle };
  customer: Customer;
  lineItems: LineItem[];
};

export type InvoiceWithRelations = Invoice & {
  job: Job & { vehicle: Vehicle };
  customer: Customer;
  lineItems: LineItem[];
  payments: Payment[];
};

export type DashboardStats = {
  openJobs: number;
  jobsToday: number;
  pendingInvoices: number;
  revenue: {
    today: number;
    week: number;
    month: number;
  };
  partsWaiting: number;
  overdueInvoices: number;
};

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  role: string;
  image?: string | null;
};

declare module "next-auth" {
  interface User {
    role?: string;
  }
  interface Session {
    user: SessionUser;
  }
  interface JWT {
    role?: string;
  }
}
