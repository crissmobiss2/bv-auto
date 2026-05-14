"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Download, Users, DollarSign, Clock, Settings } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

type TechPayroll = {
  userId: string;
  name: string;
  role: string;
  payType: string;
  rate: number;
  totalHours: number;
  totalJobs: number;
  grossPay: number;
  details: {
    logId?: string;
    jobId: string;
    jobTitle: string;
    hours?: number;
    pay: number;
    type: string;
  }[];
};

export default function PayrollPage() {
  const queryClient = useQueryClient();
  const today = new Date();
  const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split("T")[0];
  const endOfDay = today.toISOString().split("T")[0];

  const [startDate, setStartDate] = useState(firstOfMonth);
  const [endDate, setEndDate] = useState(endOfDay);
  const [rateDialog, setRateDialog] = useState<TechPayroll | null>(null);
  const [rateForm, setRateForm] = useState({ payType: "HOURLY", rate: "" });

  const { data, isLoading } = useQuery({
    queryKey: ["payroll", startDate, endDate],
    queryFn: () => axios.get(`/api/payroll?start=${startDate}&end=${endDate}`).then((r) => r.data),
  });

  const rateMutation = useMutation({
    mutationFn: ({ userId }: { userId: string }) =>
      axios.patch("/api/payroll", { userId, payType: rateForm.payType, rate: parseFloat(rateForm.rate) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payroll"] });
      setRateDialog(null);
    },
  });

  const downloadCSV = () => {
    window.open(`/api/payroll?start=${startDate}&end=${endDate}&format=csv`, "_blank");
  };

  const techs: TechPayroll[] = data?.technicians || [];
  const summary = data?.summary || {};

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Payroll Export</h1>
          <p className="text-sm text-gray-500">Calculate and export technician pay</p>
        </div>
        <Button onClick={downloadCSV} className="gap-2">
          <Download className="h-4 w-4" /> Export CSV
        </Button>
      </div>

      {/* Date Range */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-end gap-4">
            <div className="space-y-1">
              <Label className="text-xs">Period Start</Label>
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-40" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Period End</Label>
              <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-40" />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => {
                const d = new Date(); const start = new Date(d.getFullYear(), d.getMonth(), 1);
                setStartDate(start.toISOString().split("T")[0]); setEndDate(d.toISOString().split("T")[0]);
              }}>This Month</Button>
              <Button variant="outline" size="sm" onClick={() => {
                const d = new Date(); const start = new Date(d.getFullYear(), d.getMonth() - 1, 1);
                const end = new Date(d.getFullYear(), d.getMonth(), 0);
                setStartDate(start.toISOString().split("T")[0]); setEndDate(end.toISOString().split("T")[0]);
              }}>Last Month</Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 bg-blue-50 rounded-lg"><Users className="h-5 w-5 text-blue-600" /></div>
            <div>
              <p className="text-xs text-gray-500">Technicians</p>
              <p className="text-xl font-bold">{summary.techCount || 0}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 bg-green-50 rounded-lg"><DollarSign className="h-5 w-5 text-green-600" /></div>
            <div>
              <p className="text-xs text-gray-500">Total Payroll</p>
              <p className="text-xl font-bold">{formatCurrency(summary.totalPayroll || 0)}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 bg-purple-50 rounded-lg"><Clock className="h-5 w-5 text-purple-600" /></div>
            <div>
              <p className="text-xs text-gray-500">Total Hours</p>
              <p className="text-xl font-bold">{(summary.totalHours || 0).toFixed(1)}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 bg-orange-50 rounded-lg"><DollarSign className="h-5 w-5 text-orange-600" /></div>
            <div>
              <p className="text-xs text-gray-500">Avg per Tech</p>
              <p className="text-xl font-bold">{formatCurrency(summary.avgPay || 0)}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tech Table */}
      {isLoading ? (
        <div className="text-center text-gray-500 py-8">Calculating payroll...</div>
      ) : techs.length === 0 ? (
        <div className="text-center text-gray-500 py-12">
          <Users className="h-12 w-12 text-gray-300 mx-auto mb-3" />
          <p>No payroll data for this period.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {techs.map((tech) => (
            <Card key={tech.userId}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base">{tech.name}</CardTitle>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {tech.payType === "HOURLY" && `$${tech.rate}/hr · ${tech.totalHours.toFixed(1)} hrs`}
                      {tech.payType === "FLAT_RATE" && `$${tech.rate}/hr flat rate · ${tech.totalHours.toFixed(1)} billed hrs`}
                      {tech.payType === "COMMISSION" && `${tech.rate}% commission`}
                      {" · "}{tech.totalJobs} jobs
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <p className="text-lg font-bold text-green-600">{formatCurrency(tech.grossPay)}</p>
                      <p className="text-xs text-gray-400">gross pay</p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setRateDialog(tech);
                        setRateForm({ payType: tech.payType, rate: String(tech.rate) });
                      }}
                    >
                      <Settings className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="border rounded divide-y max-h-48 overflow-y-auto">
                  {tech.details.map((d, i) => (
                    <div key={i} className="flex justify-between items-center px-3 py-1.5 text-xs">
                      <div>
                        <span className="font-medium">{d.jobTitle}</span>
                        {d.hours && <span className="text-gray-400 ml-2">{d.hours.toFixed(1)}h</span>}
                        <span className={`ml-2 px-1 rounded text-[10px] ${
                          d.type === "FLAT_RATE" ? "bg-blue-50 text-blue-600" :
                          d.type === "COMMISSION" ? "bg-purple-50 text-purple-600" :
                          "bg-gray-50 text-gray-600"
                        }`}>{d.type}</span>
                      </div>
                      <span className="font-medium">{formatCurrency(d.pay)}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Rate Dialog */}
      <Dialog open={!!rateDialog} onOpenChange={() => setRateDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Set Pay Rate — {rateDialog?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Pay Type</Label>
              <Select value={rateForm.payType} onValueChange={(v) => setRateForm({ ...rateForm, payType: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="HOURLY">Hourly Rate</SelectItem>
                  <SelectItem value="FLAT_RATE">Flat Rate ($/billed hr)</SelectItem>
                  <SelectItem value="COMMISSION">Commission (%)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{rateForm.payType === "COMMISSION" ? "Commission %" : "Rate ($)"}</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={rateForm.rate}
                onChange={(e) => setRateForm({ ...rateForm, rate: e.target.value })}
                placeholder={rateForm.payType === "COMMISSION" ? "e.g. 25" : "e.g. 22.50"}
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setRateDialog(null)}>Cancel</Button>
              <Button
                disabled={!rateForm.rate || rateMutation.isPending}
                onClick={() => rateDialog && rateMutation.mutate({ userId: rateDialog.userId })}
              >
                {rateMutation.isPending ? "Saving..." : "Save Rate"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
