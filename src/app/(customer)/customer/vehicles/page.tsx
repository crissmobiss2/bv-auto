"use client";

import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import Link from "next/link";
import { Car, AlertTriangle, Calendar, Hash } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format, parseISO } from "date-fns";

export default function CustomerVehicles() {
  const { data, isLoading } = useQuery({
    queryKey: ["customer-dashboard"],
    queryFn: () => axios.get("/api/customer/dashboard").then(r => r.data),
  });

  const vehicles = data?.vehicles || [];

  if (isLoading) return <div className="space-y-3">{[...Array(3)].map((_, i) => <div key={i} className="h-28 bg-gray-200 animate-pulse rounded-xl" />)}</div>;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">My Vehicles</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">{vehicles.length} vehicle{vehicles.length !== 1 ? "s" : ""} on file</p>
      </div>

      {vehicles.length === 0 ? (
        <Card><CardContent className="p-8 text-center text-gray-400">No vehicles on file. Contact us to add your vehicle.</CardContent></Card>
      ) : (
        <div className="space-y-3">
          {vehicles.map((v: {
            id: string; year: number; make: string; model: string; trim?: string;
            vin?: string; plate?: string; mileage?: number; color?: string;
            maintenanceIntervals?: { serviceName: string; nextDueDate: string }[];
          }) => (
            <Card key={v.id} className="overflow-hidden">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="bg-blue-50 p-2 rounded-lg">
                      <Car className="h-5 w-5 text-blue-600" />
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900 dark:text-gray-100">{v.year} {v.make} {v.model}</p>
                      {v.trim && <p className="text-xs text-gray-500 dark:text-gray-400">{v.trim}</p>}
                    </div>
                  </div>
                  {v.color && (
                    <span className="text-xs text-gray-400 border rounded px-2 py-0.5">{v.color}</span>
                  )}
                </div>

                <div className="grid grid-cols-3 gap-2 text-xs text-gray-500 dark:text-gray-400">
                  {v.mileage && (
                    <div className="flex items-center gap-1">
                      <Hash className="h-3 w-3" />
                      {v.mileage.toLocaleString()} mi
                    </div>
                  )}
                  {v.plate && (
                    <div className="bg-gray-100 dark:bg-white/10 rounded px-2 py-0.5 text-center font-mono font-medium text-gray-700 dark:text-gray-300">
                      {v.plate}
                    </div>
                  )}
                  {v.vin && (
                    <div className="col-span-3 font-mono text-gray-400">VIN: {v.vin}</div>
                  )}
                </div>

                {(v.maintenanceIntervals?.length ?? 0) > 0 && (
                  <div className="border-t pt-3 space-y-1.5">
                    <p className="text-xs font-medium text-orange-700 flex items-center gap-1">
                      <AlertTriangle className="h-3 w-3" /> Maintenance Due
                    </p>
                    {v.maintenanceIntervals!.map((m, i) => (
                      <div key={i} className="flex items-center justify-between bg-orange-50 rounded-lg px-3 py-1.5">
                        <span className="text-xs text-gray-700 dark:text-gray-300">{m.serviceName}</span>
                        <span className="text-xs text-orange-600 flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {format(parseISO(m.nextDueDate), "MMM d")}
                        </span>
                      </div>
                    ))}
                    <Link href="/book">
                      <button className="w-full text-xs text-blue-600 bg-blue-50 rounded-lg py-2 hover:bg-blue-100 transition-colors mt-1">
                        Schedule Service →
                      </button>
                    </Link>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
