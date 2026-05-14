"use client";

import { useState } from "react";
import axios from "axios";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CheckCircle, Wrench } from "lucide-react";

const SERVICE_TYPES = [
  "Oil Change",
  "Brake Service",
  "Tire Rotation / Balance",
  "Battery Replacement",
  "Engine Diagnostics",
  "AC / Heat Repair",
  "Suspension / Steering",
  "Transmission Service",
  "Electrical Issue",
  "Pre-Purchase Inspection",
  "General Maintenance",
  "Other",
];

export default function BookPage() {
  const [form, setForm] = useState({
    name: "", phone: "", email: "",
    vehicleYear: "", vehicleMake: "", vehicleModel: "",
    serviceType: "", description: "", preferredDate: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async () => {
    if (!form.name || !form.phone || !form.serviceType || !form.description) {
      setError("Please fill in all required fields.");
      return;
    }
    setError("");
    setSubmitting(true);
    try {
      await axios.post("/api/booking", {
        ...form,
        vehicleYear: form.vehicleYear ? parseInt(form.vehicleYear) : undefined,
      });
      setSubmitted(true);
    } catch {
      setError("Something went wrong. Please try again or call us.");
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="max-w-md w-full">
        <CardContent className="p-8 text-center">
          <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-900">Request Received!</h2>
          <p className="text-gray-500 mt-2">We&apos;ll review your request and contact you within a few hours to confirm your appointment.</p>
          <p className="text-sm text-gray-400 mt-4">Questions? Call <a href="tel:5550001000" className="text-blue-600">(555) 000-1000</a></p>
        </CardContent>
      </Card>
    </div>
  );

  return (
    <div className="max-w-2xl mx-auto p-4 py-8 space-y-6">
      <div className="text-center">
        <div className="bg-blue-900 text-white px-6 py-4 rounded-xl inline-block mb-4">
          <p className="text-xl font-bold">B&V Mobile Auto</p>
          <p className="text-blue-300 text-sm">Mobile Automotive Repair · Houston, TX</p>
        </div>
        <h1 className="text-2xl font-bold text-gray-900">Request Service</h1>
        <p className="text-gray-500 text-sm mt-1">We come to you — home, work, or anywhere in Houston</p>
      </div>

      <Card>
        <CardContent className="p-6 space-y-4">
          <p className="font-semibold text-gray-800 flex items-center gap-2"><Wrench className="h-4 w-4 text-blue-600" /> Your Information</p>

          <div className="grid grid-cols-1 gap-4">
            <div className="space-y-2">
              <Label>Full Name *</Label>
              <Input placeholder="John Smith" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Phone *</Label>
                <Input placeholder="(555) 000-1000" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input type="email" placeholder="you@email.com" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </div>
            </div>
          </div>

          <hr />
          <p className="font-semibold text-gray-800">Vehicle</p>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-2">
              <Label>Year</Label>
              <Input type="number" placeholder="2020" value={form.vehicleYear} onChange={(e) => setForm({ ...form, vehicleYear: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Make</Label>
              <Input placeholder="Toyota" value={form.vehicleMake} onChange={(e) => setForm({ ...form, vehicleMake: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Model</Label>
              <Input placeholder="Camry" value={form.vehicleModel} onChange={(e) => setForm({ ...form, vehicleModel: e.target.value })} />
            </div>
          </div>

          <hr />
          <p className="font-semibold text-gray-800">Service Needed</p>
          <div className="space-y-2">
            <Label>Service Type *</Label>
            <Select value={form.serviceType} onValueChange={(v) => setForm({ ...form, serviceType: v })}>
              <SelectTrigger><SelectValue placeholder="Select a service..." /></SelectTrigger>
              <SelectContent>
                {SERVICE_TYPES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Describe the Issue *</Label>
            <Textarea
              rows={3}
              placeholder="Tell us what's happening with your vehicle..."
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>Preferred Date</Label>
            <Input type="date" value={form.preferredDate} onChange={(e) => setForm({ ...form, preferredDate: e.target.value })} />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <Button className="w-full" size="lg" onClick={handleSubmit} disabled={submitting}>
            {submitting ? "Submitting..." : "Submit Request"}
          </Button>

          <p className="text-xs text-gray-400 text-center">
            We&apos;ll contact you to confirm availability. Same-day service often available.
          </p>
        </CardContent>
      </Card>

      <div className="text-center text-sm text-gray-400">
        <p>Or call us directly: <a href="tel:5550001000" className="text-blue-600 font-medium">(555) 000-1000</a></p>
      </div>
    </div>
  );
}
