"use client";

import { Suspense, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Eye, Car, Plus } from "lucide-react";
import Link from "next/link";
import { AddVehicleDialog } from "@/components/features/add-vehicle-dialog";

function VehiclesContent() {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [showPickCustomer, setShowPickCustomer] = useState(false);
  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [showAddVehicle, setShowAddVehicle] = useState(false);
  const [customerSearch, setCustomerSearch] = useState("");

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["vehicles-all", debouncedSearch],
    queryFn: () =>
      axios.get(`/api/vehicles${debouncedSearch ? `?search=${debouncedSearch}` : ""}`)
        .then((r) => r.data),
  });

  const { data: customersData } = useQuery({
    queryKey: ["customers-for-vehicle", customerSearch],
    queryFn: () => axios.get(`/api/customers?limit=50&search=${customerSearch}`).then((r) => r.data.customers || []),
    enabled: showPickCustomer,
  });

  const handleSearch = (value: string) => {
    setSearch(value);
    clearTimeout((window as Window & { _st?: ReturnType<typeof setTimeout> })._st);
    (window as Window & { _st?: ReturnType<typeof setTimeout> })._st = setTimeout(() => setDebouncedSearch(value), 300);
  };

  const vehicles: {
    id: string;
    year: number;
    make: string;
    model: string;
    trim?: string;
    color?: string;
    vin?: string;
    plate?: string;
    plateState?: string;
    mileage?: number;
    customer: { id: string; firstName: string; lastName: string };
  }[] = Array.isArray(data) ? data : [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Vehicles</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">{vehicles.length} total</p>
        </div>
        <Button onClick={() => setShowPickCustomer(true)}>
          <Plus className="h-4 w-4 mr-2" /> Add Vehicle
        </Button>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search by VIN, plate, make, model..."
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
          ) : vehicles.length === 0 ? (
            <div className="p-8 text-center text-gray-500 dark:text-gray-400 flex flex-col items-center gap-2">
              <Car className="h-8 w-8 text-gray-300" />
              <p>No vehicles found.</p>
              <Button variant="outline" size="sm" onClick={() => setShowPickCustomer(true)}>
                <Plus className="h-4 w-4 mr-1" /> Add First Vehicle
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Vehicle</TableHead>
                  <TableHead className="hidden sm:table-cell">Color</TableHead>
                  <TableHead className="hidden md:table-cell">VIN</TableHead>
                  <TableHead className="hidden sm:table-cell">Plate</TableHead>
                  <TableHead className="hidden lg:table-cell">Mileage</TableHead>
                  <TableHead>Owner</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {vehicles.map((v) => (
                  <TableRow key={v.id}>
                    <TableCell>
                      <p className="font-medium text-sm">{v.year} {v.make} {v.model}</p>
                      {v.trim && <p className="text-xs text-gray-500 dark:text-gray-400">{v.trim}</p>}
                    </TableCell>
                    <TableCell className="hidden sm:table-cell text-sm text-gray-600 dark:text-gray-400">{v.color || "—"}</TableCell>
                    <TableCell className="hidden md:table-cell font-mono text-xs text-gray-500 dark:text-gray-400">{v.vin || "—"}</TableCell>
                    <TableCell className="hidden sm:table-cell text-sm text-gray-600 dark:text-gray-400">
                      {v.plate ? `${v.plate}${v.plateState ? ` (${v.plateState})` : ""}` : "—"}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell text-sm text-gray-500 dark:text-gray-400">
                      {v.mileage ? v.mileage.toLocaleString() : "—"}
                    </TableCell>
                    <TableCell>
                      <Link href={`/customers/${v.customer.id}`} className="text-sm text-blue-600 hover:underline">
                        {v.customer.firstName} {v.customer.lastName}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Link href={`/vehicles/${v.id}`}>
                        <Button variant="ghost" size="icon"><Eye className="h-4 w-4" /></Button>
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Step 1: Pick customer */}
      <Dialog open={showPickCustomer} onOpenChange={setShowPickCustomer}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Select Customer for Vehicle</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
              <Input
                className="pl-9"
                placeholder="Search customers..."
                value={customerSearch}
                onChange={(e) => setCustomerSearch(e.target.value)}
              />
            </div>
            <div className="max-h-64 overflow-y-auto space-y-1">
              {(customersData || []).map((c: { id: string; firstName: string; lastName: string; phone: string }) => (
                <button
                  key={c.id}
                  className="w-full text-left px-3 py-2 rounded-md hover:bg-gray-100 dark:hover:bg-white/10 text-sm"
                  onClick={() => {
                    setSelectedCustomerId(c.id);
                    setShowPickCustomer(false);
                    setShowAddVehicle(true);
                  }}
                >
                  <span className="font-medium">{c.firstName} {c.lastName}</span>
                  <span className="text-gray-400 ml-2 text-xs">{c.phone}</span>
                </button>
              ))}
              {customersData?.length === 0 && (
                <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">
                  No customers found.{" "}
                  <Link href="/customers" className="text-blue-600 underline">Add a customer first</Link>
                </p>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Step 2: Add Vehicle with VIN decode */}
      {selectedCustomerId && (
        <AddVehicleDialog
          open={showAddVehicle}
          onOpenChange={setShowAddVehicle}
          customerId={selectedCustomerId}
          onSuccess={() => refetch()}
        />
      )}
    </div>
  );
}

export default function VehiclesPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-gray-500 dark:text-gray-400">Loading...</div>}>
      <VehiclesContent />
    </Suspense>
  );
}
