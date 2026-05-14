"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Loader2 } from "lucide-react";
import { VehicleCombobox } from "./vehicle-combobox";

interface VehicleForm {
  year: string;
  make: string;
  model: string;
  trim: string;
  color: string;
  vin: string;
  plate: string;
  plateState: string;
  mileage: string;
  engine: string;
  transmission: string;
  fuelType: string;
  driveType: string;
  notes: string;
}

const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: CURRENT_YEAR - 1980 + 2 }, (_, i) => String(CURRENT_YEAR + 1 - i));
// Covers 1981–(current year + 1), newest first
const ALL_YEARS = Array.from({ length: CURRENT_YEAR - 1899 }, (_, i) => String(CURRENT_YEAR + 1 - i));

const BLANK: VehicleForm = {
  year: String(CURRENT_YEAR),
  make: "", model: "", trim: "", color: "",
  vin: "", plate: "", plateState: "",
  mileage: "", engine: "", transmission: "",
  fuelType: "", driveType: "", notes: "",
};

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  customerId: string;
  onSuccess?: (vehicle: { id: string; year: number; make: string; model: string }) => void;
  invalidateKeys?: string[][];
}

export function AddVehicleDialog({ open, onOpenChange, customerId, onSuccess, invalidateKeys }: Props) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<VehicleForm>(BLANK);
  const [vinInput, setVinInput] = useState("");
  const [vinLoading, setVinLoading] = useState(false);
  const [vinError, setVinError] = useState("");
  const [error, setError] = useState("");

  const set = (key: keyof VehicleForm) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  const setVal = (key: keyof VehicleForm, value: string) =>
    setForm((f) => {
      const next = { ...f, [key]: value };
      // Reset model when make changes
      if (key === "make") next.model = "";
      return next;
    });

  const decodeVin = async () => {
    const v = vinInput.trim().toUpperCase();
    if (v.length !== 17) { setVinError("VIN must be 17 characters"); return; }
    setVinError("");
    setVinLoading(true);
    try {
      const res = await axios.get(`/api/vin-decode?vin=${v}`);
      const d = res.data;
      setForm((f) => ({
        ...f,
        vin: v,
        year: String(d.year || f.year),
        make: d.make || f.make,
        model: d.model || f.model,
        trim: d.trim || f.trim,
        engine: d.engine || f.engine,
        transmission: d.transmission || f.transmission,
        fuelType: d.fuelType || f.fuelType,
        driveType: d.driveType || f.driveType,
      }));
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error || "Could not decode VIN";
      setVinError(msg);
    } finally {
      setVinLoading(false);
    }
  };

  const createMutation = useMutation({
    mutationFn: () =>
      axios.post("/api/vehicles", {
        ...form,
        customerId,
        year: parseInt(form.year) || CURRENT_YEAR,
        mileage: form.mileage ? parseInt(form.mileage) : undefined,
        vin: form.vin || undefined,
      }),
    onSuccess: (res) => {
      (invalidateKeys || []).forEach((key) => queryClient.invalidateQueries({ queryKey: key }));
      queryClient.invalidateQueries({ queryKey: ["customer", customerId] });
      queryClient.invalidateQueries({ queryKey: ["vehicles"] });
      onSuccess?.(res.data);
      setForm(BLANK);
      setVinInput("");
      setError("");
      onOpenChange(false);
    },
    onError: (e: unknown) => {
      const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error || "Failed to save vehicle";
      setError(msg);
    },
  });

  const handleClose = (v: boolean) => {
    if (!v) { setForm(BLANK); setVinInput(""); setError(""); setVinError(""); }
    onOpenChange(v);
  };

  const canSubmit = form.year && form.make.trim() && form.model.trim() && !createMutation.isPending;

  const makesUrl = "/api/vehicle-lookup?type=makes";
  const modelsUrl = form.make
    ? `/api/vehicle-lookup?type=models&make=${encodeURIComponent(form.make)}${form.year ? `&year=${form.year}` : ""}`
    : "";

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Add Vehicle</DialogTitle></DialogHeader>

        {/* VIN Decoder */}
        <div className="p-3 bg-blue-50 rounded-lg space-y-2 border border-blue-200">
          <p className="text-xs font-semibold text-blue-800">VIN Decoder — auto-fill from VIN</p>
          <div className="flex gap-2">
            <Input
              placeholder="Enter 17-character VIN..."
              value={vinInput}
              onChange={(e) => { setVinInput(e.target.value.toUpperCase()); setVinError(""); }}
              className="font-mono text-sm"
              maxLength={17}
            />
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={decodeVin}
              disabled={vinLoading || vinInput.trim().length !== 17}
              className="shrink-0"
            >
              {vinLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              {!vinLoading && <span className="ml-1">Decode</span>}
            </Button>
          </div>
          {vinError && <p className="text-xs text-red-600">{vinError}</p>}
          {!vinError && <p className="text-xs text-blue-600">Auto-fills make, model, year, engine & more</p>}
        </div>

        <div className="grid grid-cols-2 gap-3">
          {/* Year */}
          <div className="space-y-1">
            <Label className="text-xs">Year *</Label>
            <Select value={form.year} onValueChange={(v) => setVal("year", v)}>
              <SelectTrigger>
                <SelectValue placeholder="Year" />
              </SelectTrigger>
              <SelectContent className="max-h-60">
                {ALL_YEARS.map((y) => (
                  <SelectItem key={y} value={y}>{y}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Make — NHTSA autocomplete */}
          <div className="space-y-1">
            <Label className="text-xs">Make *</Label>
            <VehicleCombobox
              placeholder="Select make..."
              value={form.make}
              onChange={(v) => setVal("make", v)}
              fetchUrl={makesUrl}
            />
          </div>

          {/* Model — NHTSA autocomplete (filtered by make) */}
          <div className="col-span-2 space-y-1">
            <Label className="text-xs">Model *</Label>
            <VehicleCombobox
              placeholder={form.make ? "Select model..." : "Select make first"}
              value={form.model}
              onChange={(v) => setVal("model", v)}
              fetchUrl={modelsUrl}
              disabled={!form.make}
            />
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Trim</Label>
            <Input placeholder="LE, XSE, Sport..." value={form.trim} onChange={set("trim")} />
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Color</Label>
            <Input placeholder="Silver" value={form.color} onChange={set("color")} />
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Mileage</Label>
            <Input type="number" min="0" placeholder="85000" value={form.mileage} onChange={set("mileage")} />
          </div>

          <div className="col-span-2 space-y-1">
            <Label className="text-xs">VIN</Label>
            <Input
              className="font-mono text-sm"
              placeholder="17-character VIN"
              maxLength={17}
              value={form.vin}
              onChange={set("vin")}
            />
          </div>

          <div className="space-y-1">
            <Label className="text-xs">License Plate</Label>
            <Input placeholder="ABC1234" value={form.plate} onChange={set("plate")} />
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Plate State</Label>
            <Input placeholder="TX" maxLength={2} value={form.plateState} onChange={set("plateState")} />
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Engine</Label>
            <Input placeholder="2.5L I4" value={form.engine} onChange={set("engine")} />
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Transmission</Label>
            <Input placeholder="Automatic" value={form.transmission} onChange={set("transmission")} />
          </div>
        </div>

        {error && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded p-2">{error}</p>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => handleClose(false)}>Cancel</Button>
          <Button onClick={() => createMutation.mutate()} disabled={!canSubmit}>
            {createMutation.isPending ? "Saving..." : "Add Vehicle"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
