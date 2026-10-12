"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Search, Phone, Mail, Car, Wrench, Eye, Pencil } from "lucide-react";
import Link from "next/link";
import { formatPhone } from "@/lib/utils";
import type { Customer } from "@prisma/client";
import { CustomerFormDialog } from "@/components/features/customer-form-dialog";

type CustomerWithMeta = Customer & {
  vehicles: { id: string; year: number; make: string; model: string }[];
  _count: { jobs: number; invoices: number };
};

export default function CustomersPage() {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editCustomer, setEditCustomer] = useState<CustomerWithMeta | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["customers", debouncedSearch],
    queryFn: () => axios.get(`/api/customers?search=${debouncedSearch}&limit=50`).then((r) => r.data),
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
          <h1 className="text-2xl font-bold text-gray-900">Customers</h1>
          <p className="text-sm text-gray-500">{data?.total || 0} total customers</p>
        </div>
        <Button onClick={() => { setEditCustomer(null); setShowForm(true); }}>
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
            <div className="p-8 text-center text-gray-500">Loading...</div>
          ) : customers.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              No customers found. <button onClick={() => { setEditCustomer(null); setShowForm(true); }} className="text-blue-600 hover:underline">Add your first customer.</button>
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
                        <p className="font-medium">{`${c.firstName} ${c.lastName}`}</p>
                        {c.company && <p className="text-xs text-gray-500">{c.company}</p>}
                      </div>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      <a href={`tel:${c.phone}`} className="text-sm flex items-center gap-1 text-blue-600 hover:underline">
                        <Phone className="h-3 w-3" /> {formatPhone(c.phone)}
                      </a>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      {c.email && (
                        <a href={`mailto:${c.email}`} className="text-sm flex items-center gap-1 text-gray-600">
                          <Mail className="h-3 w-3" /> {c.email}
                        </a>
                      )}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      <span className="flex items-center gap-1 text-sm text-gray-600">
                        <Car className="h-3 w-3" /> {c.vehicles.length}
                      </span>
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      <span className="flex items-center gap-1 text-sm text-gray-600">
                        <Wrench className="h-3 w-3" /> {c._count.jobs}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Link href={`/customers/${c.id}`}>
                          <Button variant="ghost" size="icon" title="View">
                            <Eye className="h-4 w-4" />
                          </Button>
                        </Link>
                        <Button
                          variant="ghost" size="icon" title="Edit"
                          onClick={() => { setEditCustomer(c); setShowForm(true); }}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* New / Edit Customer Dialog */}
      <CustomerFormDialog
        open={showForm}
        onOpenChange={setShowForm}
        customer={editCustomer}
      />
    </div>
  );
}
