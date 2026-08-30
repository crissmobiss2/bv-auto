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
  Shield, Loader2, Eye, EyeOff, CheckCircle,
  Calendar, FileText, BarChart3, Smartphone, Wrench, Zap,
} from "lucide-react";

const FEATURES = [
  { icon: Wrench,     text: "Jobs, quotes & invoicing in one place" },
  { icon: Calendar,   text: "Dispatch & schedule with live calendar" },
  { icon: FileText,   text: "AI-powered estimates and diagnostics" },
  { icon: BarChart3,  text: "Revenue pipeline & payroll reporting" },
  { icon: Smartphone, text: "Mobile-first tech app, works on any device" },
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
      email, password,
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

      {/* ── Left branding panel (desktop) ──────────────────────────────── */}
      <div className="hidden lg:flex lg:w-[52%] flex-col justify-between p-12 relative overflow-hidden"
        style={{ background: "linear-gradient(145deg, #0a0f1e 0%, #0f172a 40%, #0f1f45 100%)" }}>

        {/* Decorative elements */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          {/* Large glow */}
          <div className="absolute top-0 right-0 w-[500px] h-[500px] rounded-full"
            style={{ background: "radial-gradient(circle, rgba(59,130,246,0.08) 0%, transparent 70%)" }} />
          <div className="absolute bottom-0 left-0 w-[400px] h-[400px] rounded-full"
            style={{ background: "radial-gradient(circle, rgba(99,102,241,0.06) 0%, transparent 70%)" }} />
          {/* Concentric rings */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full border border-white/[0.03]" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[440px] h-[440px] rounded-full border border-white/[0.04]" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[280px] h-[280px] rounded-full border border-white/[0.05]" />
          {/* Grid lines */}
          <svg className="absolute inset-0 w-full h-full opacity-[0.025]" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                <path d="M 40 0 L 0 0 0 40" fill="none" stroke="white" stroke-width="0.5"/>
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid)" />
          </svg>
        </div>

        {/* Logo mark */}
        <div className="relative flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-xl shadow-blue-900/40"
            style={{ background: "linear-gradient(135deg, #1a56db, #1e3a8a)" }}>
            <Wrench className="h-5 w-5 text-white" />
          </div>
          <div>
            <p className="text-white font-bold text-base leading-tight tracking-tight">B&V Mobile Auto</p>
            <p className="text-blue-400/70 text-xs leading-tight font-medium tracking-wide uppercase">Business OS</p>
          </div>
        </div>

        {/* Hero headline */}
        <div className="relative space-y-8">
          <div className="space-y-5">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-blue-500/20 bg-blue-500/[0.08] text-xs text-blue-400 font-semibold tracking-wide">
              <Zap className="h-3 w-3" />
              Premium Shop Management
            </div>
            <h2 className="text-[2.6rem] font-bold text-white leading-[1.12] tracking-tight">
              Run your mobile<br />
              auto shop<br />
              <span className="bg-clip-text text-transparent"
                style={{ backgroundImage: "linear-gradient(90deg, #60a5fa, #a78bfa)" }}>
                from anywhere.
              </span>
            </h2>
            <p className="text-white/40 text-[15px] leading-relaxed max-w-sm">
              Everything you need to run a professional mobile auto repair business — jobs, dispatch, invoicing, and team management.
            </p>
          </div>

          <ul className="space-y-3">
            {FEATURES.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-3 text-sm text-white/60">
                <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: "rgba(59,130,246,0.12)", border: "1px solid rgba(59,130,246,0.2)" }}>
                  <Icon className="h-3.5 w-3.5 text-blue-400" />
                </div>
                {text}
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-white/20 text-xs">
          © {new Date().getFullYear()} B&V Mobile Auto · All rights reserved
        </p>
      </div>

      {/* ── Right login form ─────────────────────────────────────────────── */}
      <div className="flex-1 flex items-center justify-center bg-gray-50 dark:bg-[#0a0f1e] px-6 py-10">
        <div className="w-full max-w-[400px] space-y-6">

          {/* Mobile logo */}
          <div className="lg:hidden flex flex-col items-center gap-3 text-center pb-2">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center shadow-xl shadow-blue-900/30"
              style={{ background: "linear-gradient(135deg, #1a56db, #1e3a8a)" }}>
              <Wrench className="h-8 w-8 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-white tracking-tight">B&V Mobile Auto</h1>
              <p className="text-gray-500 dark:text-white/40 text-sm font-medium">Business Operating System</p>
            </div>
          </div>

          {/* Login card */}
          <div className="bg-white dark:bg-[#111827] rounded-2xl shadow-lg shadow-black/[0.06] dark:shadow-black/40 border border-gray-200/80 dark:border-white/[0.07]">
            <div className="px-7 pt-7 pb-3">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white tracking-tight">
                {needsTotp ? "Verify your identity" : "Welcome back"}
              </h2>
              <p className="text-sm text-gray-500 dark:text-white/40 mt-0.5">
                {needsTotp ? "Enter the code from your authenticator app" : "Sign in to continue to your dashboard"}
              </p>
            </div>

            <div className="px-7 pb-7 pt-4">
              <form onSubmit={handleSubmit} className="space-y-4" noValidate>
                {!needsTotp ? (
                  <>
                    <div className="space-y-1.5">
                      <Label htmlFor="email" className="text-sm font-semibold text-gray-700 dark:text-white/70">
                        Email address
                      </Label>
                      <Input
                        id="email"
                        type="email"
                        placeholder="you@example.com"
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                        required
                        autoComplete="email"
                        autoFocus
                        className="h-11 bg-gray-50/80 dark:bg-white/[0.05] border-gray-200 dark:border-white/[0.1] focus:bg-white dark:focus:bg-white/[0.08] focus:border-blue-400 dark:text-white dark:placeholder:text-white/25 transition-colors"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="password" className="text-sm font-semibold text-gray-700 dark:text-white/70">
                          Password
                        </Label>
                        <Link href="/reset" className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 font-semibold transition-colors">
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
                          className="h-11 bg-gray-50/80 dark:bg-white/[0.05] border-gray-200 dark:border-white/[0.1] focus:bg-white dark:focus:bg-white/[0.08] focus:border-blue-400 dark:text-white pr-10 transition-colors"
                        />
                        <button
                          type="button"
                          className="absolute right-3 top-3 text-gray-400 dark:text-white/30 hover:text-gray-600 dark:hover:text-white/60 transition-colors"
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
                    <div className="flex items-start gap-3 bg-blue-50 dark:bg-blue-500/10 border border-blue-100 dark:border-blue-500/20 rounded-xl p-3.5">
                      <Shield className="h-4 w-4 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="text-sm font-semibold text-blue-900 dark:text-blue-200">2-step verification</p>
                        <p className="text-xs text-blue-600 dark:text-blue-400 mt-0.5">Signing in as <strong>{email}</strong></p>
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="totp" className="text-sm font-semibold text-gray-700 dark:text-white/70">6-digit code</Label>
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
                        className="h-14 text-center text-2xl font-mono tracking-[0.5em] bg-gray-50 dark:bg-white/[0.05] border-gray-200 dark:border-white/[0.1] focus:bg-white dark:text-white"
                      />
                    </div>
                    <button
                      type="button"
                      className="text-xs text-gray-400 dark:text-white/30 hover:text-gray-600 dark:hover:text-white/60 flex items-center gap-1 transition-colors"
                      onClick={() => { setNeedsTotp(false); setTotpCode(""); setError(""); }}
                    >
                      ← Back to sign in
                    </button>
                  </div>
                )}

                {error && (
                  <div className="flex items-center gap-3 p-3.5 bg-red-50 dark:bg-red-500/10 border border-red-100 dark:border-red-500/20 rounded-xl text-sm text-red-700 dark:text-red-400">
                    <div className="w-1 h-8 bg-red-400 dark:bg-red-500 rounded-full flex-shrink-0" />
                    {error}
                  </div>
                )}

                <Button
                  type="submit"
                  className="w-full h-11 font-bold shadow-md shadow-blue-600/20 transition-all hover:shadow-lg hover:shadow-blue-600/25 hover:-translate-y-px active:translate-y-0"
                  style={{ background: "linear-gradient(135deg, #1a56db, #1e40af)" }}
                  disabled={loading}
                >
                  {loading
                    ? <><Loader2 className="h-4 w-4 animate-spin" /> Signing in…</>
                    : needsTotp ? "Verify & Continue" : "Sign In →"
                  }
                </Button>
              </form>

              <div className="mt-5 space-y-3.5">
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-gray-100 dark:border-white/[0.06]" />
                  </div>
                  <div className="relative flex justify-center">
                    <span className="bg-white dark:bg-[#111827] px-3 text-xs text-gray-400 dark:text-white/25">or</span>
                  </div>
                </div>
                <Button
                  variant="outline"
                  className="w-full h-11 border-gray-200 dark:border-white/[0.1] text-gray-700 dark:text-white/70 hover:bg-gray-50 dark:hover:bg-white/[0.05] font-semibold transition-all"
                  onClick={handleDemo}
                  disabled={demoLoading}
                >
                  {demoLoading
                    ? <><Loader2 className="h-4 w-4 animate-spin" /> Loading demo…</>
                    : <><CheckCircle className="h-4 w-4 text-emerald-500" /> Try the Live Demo</>
                  }
                </Button>
              </div>
            </div>
          </div>

          <p className="text-center text-sm text-gray-500 dark:text-white/30">
            New customer?{" "}
            <Link href="/register" className="text-blue-600 dark:text-blue-400 hover:text-blue-700 font-bold transition-colors">
              Create an account
            </Link>
          </p>

          {process.env.NODE_ENV !== "production" && (
            <div className="p-3.5 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 rounded-xl">
              <p className="text-xs font-bold text-amber-800 dark:text-amber-400 mb-1">Dev credentials</p>
              <p className="text-xs text-amber-700 dark:text-amber-500/80 font-mono">admin@bvauto.com / admin123</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
