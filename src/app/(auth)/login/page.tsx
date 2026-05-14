"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import axios from "axios";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Wrench, Shield, Loader2, Eye, EyeOff, CheckCircle,
  Calendar, FileText, BarChart3, Smartphone,
} from "lucide-react";

const FEATURES = [
  { icon: Wrench,     text: "Jobs, quotes & invoicing in one place" },
  { icon: Calendar,   text: "Dispatch & schedule with live calendar" },
  { icon: FileText,   text: "AI-powered estimates and diagnostics" },
  { icon: BarChart3,  text: "Revenue pipeline & payroll reporting" },
  { icon: Smartphone, text: "Mobile app for technicians, on any device" },
];

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [totpCode, setTotpCode] = useState("");
  const [needsTotp, setNeedsTotp] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [demoLoading, setDemoLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    if (!needsTotp) {
      try {
        const { data } = await axios.get(`/api/auth/totp-check?email=${encodeURIComponent(email)}`);
        if (data.totpEnabled) {
          setNeedsTotp(true);
          setLoading(false);
          return;
        }
      } catch { /* proceed without TOTP */ }
    }

    const result = await signIn("credentials", {
      email,
      password,
      ...(needsTotp ? { totpCode } : {}),
      redirect: false,
    });

    setLoading(false);

    if (result?.error) {
      setError(needsTotp ? "Invalid authenticator code. Please try again." : "Incorrect email or password.");
    } else {
      router.push("/");
    }
  }

  async function handleDemo() {
    setDemoLoading(true);
    setError("");
    try {
      const { data } = await axios.post("/api/auth/demo");
      const result = await signIn("credentials", { email: data.email, password: data.password, redirect: false });
      if (result?.error) setError("Demo login failed. Please try again.");
      else router.push("/");
    } catch {
      setError("Demo unavailable right now.");
    } finally {
      setDemoLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex">
      {/* Left panel — branding (desktop only) */}
      <div className="hidden lg:flex lg:w-[52%] bg-gradient-to-br from-gray-900 via-blue-950 to-gray-900 flex-col justify-between p-12 relative overflow-hidden">
        {/* Decorative rings */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute -top-32 -right-32 w-80 h-80 rounded-full bg-blue-600/10 blur-3xl" />
          <div className="absolute -bottom-20 -left-20 w-72 h-72 rounded-full bg-blue-500/8 blur-3xl" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[560px] h-[560px] rounded-full border border-white/[0.04]" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[380px] h-[380px] rounded-full border border-white/[0.04]" />
        </div>

        {/* Logo */}
        <div className="relative flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-blue-600 shadow-lg shadow-blue-600/30">
            <Wrench className="h-5 w-5 text-white" />
          </div>
          <div>
            <p className="text-white font-bold leading-tight">B&V Mobile Auto</p>
            <p className="text-blue-400 text-xs leading-tight">Business Operating System</p>
          </div>
        </div>

        {/* Hero */}
        <div className="relative space-y-8">
          <div className="space-y-4">
            <h2 className="text-4xl font-bold text-white leading-[1.15]">
              Run your mobile<br />
              auto repair shop<br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-400">from anywhere.</span>
            </h2>
            <p className="text-gray-400 text-sm leading-relaxed max-w-sm">
              Everything you need to manage jobs, customers, parts, invoices, and your team — in one powerful platform.
            </p>
          </div>

          <ul className="space-y-3.5">
            {FEATURES.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-3 text-sm text-gray-300">
                <div className="w-8 h-8 rounded-lg bg-blue-600/20 border border-blue-500/20 flex items-center justify-center flex-shrink-0">
                  <Icon className="h-4 w-4 text-blue-400" />
                </div>
                {text}
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-gray-600 text-xs">© {new Date().getFullYear()} B&V Mobile Auto. All rights reserved.</p>
      </div>

      {/* Right panel — login form */}
      <div className="flex-1 flex items-center justify-center bg-gray-50 px-6 py-10">
        <div className="w-full max-w-[400px] space-y-6">

          {/* Mobile logo */}
          <div className="lg:hidden flex flex-col items-center gap-3 text-center pb-2">
            <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-blue-600 shadow-lg shadow-blue-600/30">
              <Wrench className="h-7 w-7 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">B&V Mobile Auto</h1>
              <p className="text-gray-500 text-sm">Business Operating System</p>
            </div>
          </div>

          {/* Card */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200/80">
            <div className="px-7 pt-7 pb-3">
              <h2 className="text-xl font-bold text-gray-900">
                {needsTotp ? "Verify your identity" : "Welcome back"}
              </h2>
              <p className="text-sm text-gray-500 mt-0.5">
                {needsTotp ? "Enter the code from your authenticator app" : "Sign in to your account to continue"}
              </p>
            </div>

            <div className="px-7 pb-7 pt-3">
              <form onSubmit={handleSubmit} className="space-y-4" noValidate>
                {!needsTotp ? (
                  <>
                    <div className="space-y-1.5">
                      <Label htmlFor="email" className="text-sm font-medium text-gray-700">Email address</Label>
                      <Input
                        id="email"
                        type="email"
                        placeholder="you@example.com"
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                        required
                        autoComplete="email"
                        autoFocus
                        className="h-10 bg-gray-50/80 border-gray-200 focus:bg-white focus:border-blue-400 transition-colors"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="password" className="text-sm font-medium text-gray-700">Password</Label>
                        <Link href="/reset" className="text-xs text-blue-600 hover:text-blue-700 font-medium transition-colors">
                          Forgot password?
                        </Link>
                      </div>
                      <div className="relative">
                        <Input
                          id="password"
                          type={showPassword ? "text" : "password"}
                          value={password}
                          onChange={e => setPassword(e.target.value)}
                          required
                          autoComplete="current-password"
                          className="h-10 bg-gray-50/80 border-gray-200 focus:bg-white focus:border-blue-400 pr-10 transition-colors"
                        />
                        <button
                          type="button"
                          className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600"
                          onClick={() => setShowPassword(v => !v)}
                          tabIndex={-1}
                          aria-label={showPassword ? "Hide password" : "Show password"}
                        >
                          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="space-y-4">
                    <div className="flex items-start gap-3 bg-blue-50 border border-blue-100 rounded-xl p-3.5">
                      <Shield className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="text-sm font-medium text-blue-900">2-step verification</p>
                        <p className="text-xs text-blue-600 mt-0.5">Signing in as <strong>{email}</strong></p>
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="totp" className="text-sm font-medium text-gray-700">6-digit code</Label>
                      <Input
                        id="totp"
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9 ]*"
                        maxLength={7}
                        placeholder="000 000"
                        value={totpCode}
                        onChange={e => setTotpCode(e.target.value)}
                        autoFocus
                        className="h-14 text-center text-2xl font-mono tracking-[0.5em] bg-gray-50 border-gray-200 focus:bg-white"
                      />
                    </div>
                    <button
                      type="button"
                      className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1 transition-colors"
                      onClick={() => { setNeedsTotp(false); setTotpCode(""); setError(""); }}
                    >
                      ← Back to sign in
                    </button>
                  </div>
                )}

                {error && (
                  <div className="flex items-center gap-3 p-3.5 bg-red-50 border border-red-100 rounded-xl text-sm text-red-700">
                    <div className="w-1 h-8 bg-red-400 rounded-full flex-shrink-0" />
                    {error}
                  </div>
                )}

                <Button
                  type="submit"
                  className="w-full h-10 bg-blue-600 hover:bg-blue-700 font-semibold shadow-sm shadow-blue-600/25 transition-all"
                  disabled={loading}
                >
                  {loading ? <><Loader2 className="h-4 w-4 animate-spin" /> Signing in...</> : needsTotp ? "Verify & Continue" : "Sign In"}
                </Button>
              </form>

              <div className="mt-5 space-y-4">
                <div className="relative">
                  <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-100" /></div>
                  <div className="relative flex justify-center"><span className="bg-white px-3 text-xs text-gray-400">or</span></div>
                </div>
                <Button
                  variant="outline"
                  className="w-full h-10 border-gray-200 text-gray-700 hover:bg-gray-50 font-medium"
                  onClick={handleDemo}
                  disabled={demoLoading}
                >
                  {demoLoading
                    ? <><Loader2 className="h-4 w-4 animate-spin" /> Loading demo...</>
                    : <><CheckCircle className="h-4 w-4 text-green-500" /> Try the Live Demo</>}
                </Button>
              </div>
            </div>
          </div>

          <p className="text-center text-sm text-gray-500">
            New customer?{" "}
            <Link href="/register" className="text-blue-600 hover:text-blue-700 font-semibold transition-colors">
              Create an account
            </Link>
          </p>

          {process.env.NODE_ENV !== "production" && (
            <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl">
              <p className="text-xs font-semibold text-amber-800 mb-1">Dev credentials</p>
              <p className="text-xs text-amber-700 font-mono">admin@bvauto.com / admin123</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
