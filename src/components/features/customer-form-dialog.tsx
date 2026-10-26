"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import Link from "next/link";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

const LEAD_SOURCES = ["WALK_IN", "PHONE", "WEBSITE", "REFERRAL", "GOOGLE", "YELP", "SOCIAL_MEDIA", "OTHER"];

export type CustomerFormValues = {
  firstName: string;
  lastName: string;
  company: string;
  email: string;
  phone: string;
  altPhone: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  type: string;
  leadSource: string;
  notes: string;
  smsConsent?: boolean;
};

export const BLANK_CUSTOMER: CustomerFormValues = {
  firstName: "", lastName: "", company: "", email: "",
  phone: "", altPhone: "", address: "", city: "", state: "", zip: "",
  type: "INDIVIDUAL", leadSource: "OTHER", notes: "",
};

export function customerToForm(c: {
  firstName?: string | null; lastName?: string | null; company?: string | null; email?: string | null;
  phone?: string | null; altPhone?: string | null; address?: string | null; city?: string | null;
  state?: string | null; zip?: string | null; type?: string | null; leadSource?: string | null; notes?: string | null;
  smsConsentAt?: string | Date | null;
}): CustomerFormValues {
  return {
    firstName: c.firstName || "", lastName: c.lastName || "", company: c.company || "", email: c.email || "",
    phone: c.phone || "", altPhone: c.altPhone || "", address: c.address || "", city: c.city || "",
    state: c.state || "", zip: c.zip || "", type: c.type || "INDIVIDUAL", leadSource: c.leadSource || "OTHER",
    notes: c.notes || "", smsConsent: !!c.smsConsentAt,
  };
}

interface Props {
  /** Prefill for a new customer (ignored when editing). */
  initial?: Partial<CustomerFormValues>;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** When provided, edits that customer (PATCH). When omitted, creates a new one (POST). */
  customer?: ({ id: string } & Parameters<typeof customerToForm>[0]) | null;
  /** Called with the created customer (create mode only). */
  onSuccess?: (customer: { id: string; firstName: string; lastName: string; phone: string }) => void;
}

export function CustomerFormDialog({ open, onOpenChange, customer, initial, onSuccess }: Props) {
  const queryClient = useQueryClient();
  const isEdit = !!customer;
  const [form, setForm] = useState<CustomerFormValues>(BLANK_CUSTOMER);
  const [prevOpen, setPrevOpen] = useState(open);

  // Prefill/reset whenever the dialog opens
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) setForm(customer ? customerToForm(customer) : { ...BLANK_CUSTOMER, ...initial });
  }

  const set = (key: keyof CustomerFormValues) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  const mutation = useMutation({
    // 409 duplicates are shown inline below, so keep the global error toast out of it.
    onError: () => {},
    mutationFn: ({ allowDuplicate, ...data }: CustomerFormValues & { allowDuplicate?: boolean }) => {
      const payload = {
        allowDuplicate: allowDuplicate || undefined,
        ...data,
        email: data.email || undefined,
        altPhone: data.altPhone || undefined,
        address: data.address || undefined,
        city: data.city || undefined,
        state: data.state || undefined,
        zip: data.zip || undefined,
        company: data.company || undefined,
        notes: data.notes || undefined,
      };
      return isEdit
        ? axios.patch(`/api/customers/${customer!.id}`, payload)
        : axios.post("/api/customers", payload);
    },
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      if (isEdit) {
        queryClient.invalidateQueries({ queryKey: ["customer", customer!.id] });
      } else {
        onSuccess?.(res.data);
      }
      onOpenChange(false);
    },
  });

  const duplicates: { id: string; firstName: string; lastName: string; phone: string; email: string | null }[] =
    (axios.isAxiosError(mutation.error) && mutation.error.response?.status === 409 && mutation.error.response.data?.duplicates) || [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Customer" : "New Customer"}</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>First Name *</Label>
            <Input autoCapitalize="words" autoCorrect="off" value={form.firstName} onChange={set("firstName")} />
          </div>
          <div className="space-y-2">
            <Label>Last Name *</Label>
            <Input autoCapitalize="words" autoCorrect="off" value={form.lastName} onChange={set("lastName")} />
          </div>
          <div className="space-y-2">
            <Label>Company</Label>
            <Input autoCapitalize="words" value={form.company} onChange={set("company")} />
          </div>
          <div className="space-y-2">
            <Label>Type</Label>
            <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="INDIVIDUAL">Individual</SelectItem>
                <SelectItem value="BUSINESS">Business</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Phone *</Label>
            <Input
              value={form.phone}
              onChange={set("phone")}
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              placeholder="(555) 123-4567"
            />
          </div>
          <div className="space-y-2">
            <Label>Alt Phone</Label>
            <Input value={form.altPhone} onChange={set("altPhone")} type="tel" inputMode="tel" />
          </div>
          <div className="col-span-2 space-y-2">
            <Label>Email</Label>
            <Input value={form.email} onChange={set("email")} type="email" inputMode="email" autoComplete="email" />
          </div>
          <div className="col-span-2 space-y-2">
            <Label>Address</Label>
            <Input autoCapitalize="words" autoComplete="street-address" value={form.address} onChange={set("address")} />
          </div>
          <div className="space-y-2">
            <Label>City</Label>
            <Input autoCapitalize="words" value={form.city} onChange={set("city")} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-2">
              <Label>State</Label>
              <Input value={form.state} onChange={set("state")} maxLength={2} autoCapitalize="characters" />
            </div>
            <div className="space-y-2">
              <Label>ZIP</Label>
              <Input value={form.zip} onChange={set("zip")} inputMode="numeric" autoComplete="postal-code" />
            </div>
          </div>
          {!isEdit && (
            <div className="space-y-2">
              <Label>Lead Source</Label>
              <Select value={form.leadSource} onValueChange={(v) => setForm({ ...form, leadSource: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {LEAD_SOURCES.map((s) => (
                    <SelectItem key={s} value={s}>{s.replace(/_/g, " ")}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className={isEdit ? "col-span-2 space-y-2" : "col-span-2 space-y-2"}>
            <Label>Notes</Label>
            <Textarea rows={2} value={form.notes} onChange={set("notes")} />
          </div>
        </div>
        {duplicates.length > 0 && (
          <div className="text-sm bg-amber-50 border border-amber-200 rounded p-2 space-y-1" role="alert">
            <p className="font-medium text-amber-900">Possible duplicate — this phone or email is already on file:</p>
            <ul className="list-disc pl-5">
              {duplicates.map((d) => (
                <li key={d.id}>
                  <Link href={`/customers/${d.id}`} className="text-blue-700 underline" onClick={() => onOpenChange(false)}>
                    {d.firstName} {d.lastName}
                  </Link>{" "}
                  <span className="text-gray-600">{d.phone}{d.email ? ` · ${d.email}` : ""}</span>
                </li>
              ))}
            </ul>
            <Button size="sm" variant="outline" onClick={() => mutation.mutate({ ...form, allowDuplicate: true })} disabled={mutation.isPending}>
              Create anyway
            </Button>
          </div>
        )}
        {mutation.isError && duplicates.length === 0 && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded p-2">
            {(mutation.error as { response?: { data?: { error?: string } } })?.response?.data?.error || "Failed to save customer."}
          </p>
        )}
        <label className="flex items-start gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            className="mt-1"
            checked={!!form.smsConsent}
            onChange={(e) => setForm({ ...form, smsConsent: e.target.checked })}
          />
          <span>Customer agreed to receive text messages (appointment, estimate and invoice updates, maintenance reminders and offers).</span>
        </label>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            onClick={() => mutation.mutate(form)}
            disabled={!form.firstName || !form.lastName || !form.phone || mutation.isPending}
          >
            {mutation.isPending ? "Saving..." : isEdit ? "Save Changes" : "Create Customer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}