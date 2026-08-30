"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Search, Phone, Mail, Car, Wrench, Eye } from "lucide-react";
import Link from "next/link";
import { formatPhone } from "@/lib/utils";
import type { Customer } from "@prisma/client";

type CustomerWithMeta = Customer & {
  vehicles: { id: string; year: number; make: string; model: string }[];
  _count: { jobs: number; invoices: number };
};

export default function CustomersPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState({
    firstName: "", lastName: "", company: "", email: "",
    phone: "", altPhone: "", address: "", city: "", state: "", zip: "",
    type: "INDIVIDUAL", leadSource: "OTHER", notes: "",
  });

  const { data, isLoading } = useQuery({
    queryKey: ["customers", debouncedSearch],
    queryFn: () => axios.get(`/api/customers?search=${debouncedSearch}&limit=50`).then((r) => r.data),
  });

  const createMutation = useMutation({
    mutationFn: (data: typeof form) => axios.post("/api/customers", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      setShowNew(false);
      setForm({ firstName: "", lastName: "", company: "", email: "", phone: "", altPhone: "", address: "", city: "", state: "", zip: "", type: "INDIVIDUAL", leadSource: "OTHER", notes: "" });
    },
  });

  const handleSearch = (value: string) => {
    setSearch(value);
    clearTimeout((window as Window & { _st?: ReturnType<typeof setTimeout> })._st);
    (window as Window & { _st?: ReturnType<typeof setTimeout> })._st = setTimeout(() => setDebouncedSearch(value), 300);
  };

  const customers: CustomerWithMeta[] = data?.customers || [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Customers</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">{data?.total || 0} total customers</p>
        </div>
        <Button onClick={() => setShowNew(true)}>
          <Plus className="h-4 w-4 mr-2" /> New Customer
        </Button>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search by name, phone, or email..."
              className="pl-9"
              value={search}
              onChange={(e) => handleSearch(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center text-gray-500 dark:text-gray-400">Loading...</div>
          ) : customers.length === 0 ? (
            <div className="p-8 text-center text-gray-500 dark:text-gray-400">
              No customers found. <button onClick={() => setShowNew(true)} className="text-blue-600 hover:underline">Add your first customer.</button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead className="hidden sm:table-cell">Phone</TableHead>
                  <TableHead className="hidden md:table-cell">Email</TableHead>
                  <TableHead className="hidden lg:table-cell">Vehicles</TableHead>
                  <TableHead className="hidden lg:table-cell">Jobs</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {customers.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{c.firstName} {c.lastName}</p>
                        {c.company && <p className="text-xs text-gray-500 dark:text-gray-400">{c.company}</p>}
                      </div>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      <a href={`tel:${c.phone}`} className="text-sm flex items-center gap-1 text-blue-600 hover:underline">
                        <Phone className="h-3 w-3" /> {formatPhone(c.phone)}
                      </a>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      {c.email && (
                        <a href={`mailto:${c.email}`} className="text-sm flex items-center gap-1 text-gray-600 dark:text-gray-400">
                          <Mail className="h-3 w-3" /> {c.email}
                        </a>
                      )}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      <span className="flex items-center gap-1 text-sm text-gray-600 dark:text-gray-400">
                        <Car className="h-3 w-3" /> {c.vehicles.length}
                      </span>
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      <span className="flex items-center gap-1 text-sm text-gray-600 dark:text-gray-400">
                        <Wrench className="h-3 w-3" /> {c._count.jobs}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Link href={`/customers/${c.id}`}>
                        <Button variant="ghost" size="icon">
                          <Eye className="h-4 w-4" />
                        </Button>
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* New Customer Dialog */}
      <Dialog open={showNew} onOpenChange={setShowNew}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>New Customer</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>First Name *</Label>
              <Input value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Last Name *</Label>
              <Input value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Company</Label>
              <Input value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} />
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
              <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} type="tel" />
            </div>
            <div className="space-y-2">
              <Label>Alt Phone</Label>
              <Input value={form.altPhone} onChange={(e) => setForm({ ...form, altPhone: e.target.value })} type="tel" />
            </div>
            <div className="col-span-2 space-y-2">
              <Label>Email</Label>
              <Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} type="email" />
            </div>
            <div className="col-span-2 space-y-2">
              <Label>Address</Label>
              <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>City</Label>
              <Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-2">
                <Label>State</Label>
                <Input value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} maxLength={2} />
              </div>
              <div className="space-y-2">
                <Label>ZIP</Label>
                <Input value={form.zip} onChange={(e) => setForm({ ...form, zip: e.target.value })} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Lead Source</Label>
              <Select value={form.leadSource} onValueChange={(v) => setForm({ ...form, leadSource: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["WALK_IN", "PHONE", "WEBSITE", "REFERRAL", "GOOGLE", "YELP", "SOCIAL_MEDIA", "OTHER"].map((s) => (
                    <SelectItem key={s} value={s}>{s.replace("_", " ")}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2 space-y-2">
              <Label>Notes</Label>
              <Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNew(false)}>Cancel</Button>
            <Button
              onClick={() => createMutation.mutate(form)}
              disabled={!form.firstName || !form.lastName || !form.phone || createMutation.isPending}
            >
              {createMutation.isPending ? "Saving..." : "Create Customer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
