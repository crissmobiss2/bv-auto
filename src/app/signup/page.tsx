"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import axios from "axios";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { APP_NAME } from "@/lib/app-name";

export default function SignupPage() {
  const router = useRouter();
  const [form, setForm] = useState({ shopName: "", name: "", email: "", phone: "", password: "", confirm: "" });
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (form.password.length < 8) return setError("Password must be at least 8 characters.");
    if (form.password !== form.confirm) return setError("Passwords do not match.");
    if (!acceptTerms) return setError("Please accept the Terms and Privacy Policy.");
    setLoading(true);
    try {
      await axios.post("/api/signup", {
        shopName: form.shopName, name: form.name, email: form.email,
        phone: form.phone || undefined, password: form.password, acceptTerms: true,
      });
      const result = await signIn("credentials", { email: form.email, password: form.password, redirect: false });
      router.push(result?.error ? "/login" : "/onboarding");
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } };
      setError(e?.response?.data?.error || "Sign-up failed. Please try again.");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center space-y-1">
          <h1 className="text-2xl font-bold text-gray-900">Set up your shop on {APP_NAME}</h1>
          <p className="text-sm text-gray-500">Jobs, quotes, invoices, parts and texting for your repair shop.</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-4">
            <div><Label htmlFor="shopName">Shop name</Label><Input id="shopName" required value={form.shopName} onChange={set("shopName")} placeholder="Main Street Auto Repair" /></div>
            <div><Label htmlFor="name">Your name</Label><Input id="name" required autoComplete="name" value={form.name} onChange={set("name")} /></div>
            <div><Label htmlFor="email">Email</Label><Input id="email" type="email" required autoComplete="email" value={form.email} onChange={set("email")} /></div>
            <div><Label htmlFor="phone">Shop phone (optional)</Label><Input id="phone" type="tel" inputMode="tel" autoComplete="tel" value={form.phone} onChange={set("phone")} /></div>
            <div><Label htmlFor="password">Password</Label><Input id="password" type="password" required autoComplete="new-password" value={form.password} onChange={set("password")} /></div>
            <div><Label htmlFor="confirm">Confirm password</Label><Input id="confirm" type="password" required autoComplete="new-password" value={form.confirm} onChange={set("confirm")} /></div>
            <label className="flex items-start gap-2 text-sm text-gray-600">
              <input type="checkbox" className="mt-1" checked={acceptTerms} onChange={(e) => setAcceptTerms(e.target.checked)} />
              <span>I agree to the <Link href="/terms" className="text-blue-600 underline">Terms</Link> and <Link href="/privacy" className="text-blue-600 underline">Privacy Policy</Link>.</span>
            </label>
            {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
            <Button type="submit" disabled={loading} className="w-full">{loading ? "Creating your shop..." : "Create shop"}</Button>
            <p className="text-center text-sm text-gray-500">Already have an account? <Link href="/login" className="text-blue-600 font-semibold">Sign in</Link></p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
