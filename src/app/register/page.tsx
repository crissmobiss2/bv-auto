"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import axios from "axios";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Wrench, User, Shield, Package, AlertCircle, CheckCircle, Eye, EyeOff } from "lucide-react";

type RoleOption = {
  id: string;
  label: string;
  description: string;
  icon: React.ElementType;
  requiresCode: boolean;
  color: string;
};

const ROLES: RoleOption[] = [
  {
    id: "CUSTOMER",
    label: "Customer",
    description: "View your vehicles, service history, invoices, and book appointments",
    icon: User,
    requiresCode: false,
    color: "border-blue-200 bg-blue-50 text-blue-700",
  },
  {
    id: "TECHNICIAN",
    label: "Technician",
    description: "Access job assignments, log time, upload inspection photos",
    icon: Wrench,
    requiresCode: true,
    color: "border-orange-200 bg-orange-50 text-orange-700",
  },
  {
    id: "SERVICE_ADVISOR",
    label: "Service Advisor",
    description: "Manage jobs, quotes, invoices, and customer communication",
    icon: Shield,
    requiresCode: true,
    color: "border-green-200 bg-green-50 text-green-700",
  },
  {
    id: "PARTS_COORDINATOR",
    label: "Parts Coordinator",
    description: "Manage parts ordering, inventory, and supplier relationships",
    icon: Package,
    requiresCode: true,
    color: "border-purple-200 bg-purple-50 text-purple-700",
  },
];

export default function RegisterPage() {
  const router = useRouter();
  const [step, setStep] = useState<"role" | "details">("role");
  const [selectedRole, setSelectedRole] = useState<string>("CUSTOMER");
  const [form, setForm] = useState({ name: "", email: "", phone: "", password: "", confirm: "", inviteCode: "" });
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const role = ROLES.find(r => r.id === selectedRole)!;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (form.password !== form.confirm) { setError("Passwords do not match"); return; }
    if (form.password.length < 8) { setError("Password must be at least 8 characters"); return; }

    setLoading(true);
    try {
      await axios.post("/api/auth/register", {
        name: form.name,
        email: form.email,
        phone: form.phone || undefined,
        password: form.password,
        role: selectedRole,
        inviteCode: form.inviteCode || undefined,
      });
      setDone(true);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } };
      setError(e?.response?.data?.error || "Registration failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (done) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <Card className="w-full max-w-md text-center">
          <CardContent className="p-8 space-y-4">
            <CheckCircle className="h-14 w-14 text-green-500 mx-auto" />
            <h2 className="text-xl font-bold text-gray-900">Account Created!</h2>
            <p className="text-gray-500 text-sm">Your account is ready. Sign in to get started.</p>
            <Button className="w-full bg-blue-600 hover:bg-blue-700" onClick={() => router.push("/login")}>
              Sign In Now
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="w-full max-w-lg space-y-4">
        {/* Header */}
        <div className="text-center">
          <div className="flex items-center justify-center gap-2 mb-2">
            <div className="bg-blue-600 rounded-xl p-2">
              <Wrench className="h-6 w-6 text-white" />
            </div>
            <span className="text-2xl font-bold text-gray-900">B&V Auto</span>
          </div>
          <p className="text-gray-500 text-sm">Create your account</p>
        </div>

        <Card className="shadow-lg">
          <CardHeader className="pb-3">
            <div className="flex gap-2 text-sm">
              <button
                className={`px-3 py-1 rounded-full font-medium transition-colors ${step === "role" ? "bg-blue-600 text-white" : "text-gray-400"}`}
                onClick={() => setStep("role")}
              >
                1. Account Type
              </button>
              <button
                className={`px-3 py-1 rounded-full font-medium transition-colors ${step === "details" ? "bg-blue-600 text-white" : "text-gray-400"}`}
                onClick={() => selectedRole && setStep("details")}
              >
                2. Your Details
              </button>
            </div>
          </CardHeader>

          <CardContent>
            {step === "role" ? (
              <div className="space-y-3">
                <p className="text-sm text-gray-600 font-medium mb-2">Who are you?</p>
                {ROLES.map(r => (
                  <button
                    key={r.id}
                    onClick={() => setSelectedRole(r.id)}
                    className={`w-full flex items-start gap-3 p-3 rounded-xl border-2 transition-all text-left ${
                      selectedRole === r.id ? `${r.color} border-current` : "border-gray-200 hover:border-gray-300"
                    }`}
                  >
                    <r.icon className={`h-5 w-5 mt-0.5 flex-shrink-0 ${selectedRole === r.id ? "" : "text-gray-400"}`} />
                    <div>
                      <p className="font-medium text-sm">{r.label}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{r.description}</p>
                      {r.requiresCode && (
                        <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded mt-1 inline-block">Requires invite code</span>
                      )}
                    </div>
                  </button>
                ))}
                <Button className="w-full mt-2 bg-blue-600 hover:bg-blue-700" onClick={() => setStep("details")}>
                  Continue as {role.label}
                </Button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-3">
                <div className="space-y-1">
                  <Label className="text-xs">Full Name</Label>
                  <Input
                    required placeholder="John Smith"
                    value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Email Address</Label>
                  <Input
                    type="email" required placeholder="john@example.com"
                    value={form.email} onChange={e => setForm({ ...form, email: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Phone (optional)</Label>
                  <Input
                    type="tel" placeholder="(555) 555-5555"
                    value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Password</Label>
                  <div className="relative">
                    <Input
                      type={showPass ? "text" : "password"} required placeholder="Min 8 characters"
                      value={form.password} onChange={e => setForm({ ...form, password: e.target.value })}
                      className="pr-10"
                    />
                    <button type="button" className="absolute right-3 top-2.5 text-gray-400"
                      onClick={() => setShowPass(v => !v)}>
                      {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Confirm Password</Label>
                  <Input
                    type="password" required placeholder="Repeat password"
                    value={form.confirm} onChange={e => setForm({ ...form, confirm: e.target.value })}
                  />
                </div>
                {role.requiresCode && (
                  <div className="space-y-1">
                    <Label className="text-xs">Invite Code (from your shop admin)</Label>
                    <Input
                      required placeholder="Enter invite code"
                      value={form.inviteCode} onChange={e => setForm({ ...form, inviteCode: e.target.value })}
                    />
                  </div>
                )}
                {error && (
                  <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                    <AlertCircle className="h-4 w-4 flex-shrink-0" />
                    {error}
                  </div>
                )}
                <div className="flex gap-2 pt-1">
                  <Button type="button" variant="outline" className="flex-1" onClick={() => setStep("role")}>Back</Button>
                  <Button type="submit" className="flex-1 bg-blue-600 hover:bg-blue-700" disabled={loading}>
                    {loading ? "Creating Account..." : "Create Account"}
                  </Button>
                </div>
              </form>
            )}
          </CardContent>
        </Card>

        <p className="text-center text-sm text-gray-500">
          Already have an account?{" "}
          <Link href="/login" className="text-blue-600 hover:underline font-medium">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
