"use client";

import { useState, useEffect } from "react";
import axios from "axios";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Shield, CheckCircle, Loader2 } from "lucide-react";
import Image from "next/image";

type Step = "idle" | "setup" | "disable";

export function TotpSettings() {
  const [step, setStep] = useState<Step>("idle");
  const [enabled, setEnabled] = useState(false);
  const [qrCode, setQrCode] = useState("");
  const [code, setCode] = useState("");
  const [disableCode, setDisableCode] = useState("");
  const [disablePassword, setDisablePassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    axios.get("/api/auth/totp/status").then(({ data }) => setEnabled(data.enabled)).catch(() => {});
  }, []);

  async function startSetup() {
    setLoading(true); setMsg(null);
    try {
      const { data } = await axios.post("/api/auth/totp/setup");
      setQrCode(data.qrCode);
      setStep("setup");
    } catch {
      setMsg({ ok: false, text: "Failed to generate QR code." });
    } finally {
      setLoading(false);
    }
  }

  async function verify() {
    setLoading(true); setMsg(null);
    try {
      await axios.post("/api/auth/totp/verify", { code });
      setEnabled(true); setStep("idle"); setCode("");
      setMsg({ ok: true, text: "Two-factor authentication enabled." });
    } catch {
      setMsg({ ok: false, text: "Invalid code. Check your authenticator app." });
    } finally {
      setLoading(false);
    }
  }

  async function disable() {
    setLoading(true); setMsg(null);
    try {
      await axios.post("/api/auth/totp/disable", { code: disableCode, password: disablePassword });
      setEnabled(false); setStep("idle"); setDisableCode(""); setDisablePassword("");
      setMsg({ ok: true, text: "Two-factor authentication disabled." });
    } catch {
      setMsg({ ok: false, text: "Invalid code or password." });
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Shield className="h-4 w-4 text-blue-600" /> Two-Factor Authentication
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {msg && (
          <p className={`text-sm font-medium ${msg.ok ? "text-green-600" : "text-red-600"}`}>{msg.text}</p>
        )}

        {step === "idle" && (
          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div>
              <p className="font-medium text-sm">Authenticator App (TOTP)</p>
              <p className="text-xs text-gray-500 mt-0.5">
                {enabled ? "Your account is protected with 2FA." : "Add a second factor to protect sensitive operations."}
              </p>
            </div>
            <div className="flex items-center gap-3">
              {enabled && <Badge variant="secondary" className="text-green-700 bg-green-50 border-green-200">Active</Badge>}
              {enabled ? (
                <Button variant="outline" size="sm" onClick={() => setStep("disable")}>Disable</Button>
              ) : (
                <Button size="sm" onClick={startSetup} disabled={loading}>
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Enable"}
                </Button>
              )}
            </div>
          </div>
        )}

        {step === "setup" && qrCode && (
          <div className="space-y-4 p-4 border rounded-lg">
            <div>
              <p className="text-sm font-medium">Scan with your authenticator app</p>
              <p className="text-xs text-gray-500 mt-0.5">Use Google Authenticator, Authy, or any TOTP-compatible app.</p>
            </div>
            <div className="flex justify-center">
              <Image src={qrCode} alt="TOTP QR Code" width={180} height={180} className="rounded border" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="totp-verify">Enter the 6-digit code to confirm</Label>
              <Input id="totp-verify" type="text" inputMode="numeric" pattern="[0-9 ]*" maxLength={7}
                placeholder="000 000" value={code} onChange={e => setCode(e.target.value)}
                className="text-center font-mono tracking-widest text-xl" autoFocus />
            </div>
            <div className="flex gap-2">
              <Button onClick={verify} disabled={loading || code.replace(/\s/g, "").length < 6}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle className="h-4 w-4 mr-2" />}
                Verify & Enable
              </Button>
              <Button variant="outline" onClick={() => { setStep("idle"); setQrCode(""); setCode(""); }}>Cancel</Button>
            </div>
          </div>
        )}

        {step === "disable" && (
          <div className="space-y-4 p-4 border border-red-200 rounded-lg bg-red-50">
            <div>
              <p className="text-sm font-medium text-red-800">Disable two-factor authentication</p>
              <p className="text-xs text-red-600 mt-0.5">Enter your password and current authenticator code to confirm.</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="dis-pw">Password</Label>
              <Input id="dis-pw" type="password" value={disablePassword} onChange={e => setDisablePassword(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dis-code">Authenticator code</Label>
              <Input id="dis-code" type="text" inputMode="numeric" pattern="[0-9 ]*" maxLength={7}
                placeholder="000 000" value={disableCode} onChange={e => setDisableCode(e.target.value)}
                className="text-center font-mono tracking-widest text-xl" autoFocus />
            </div>
            <div className="flex gap-2">
              <Button variant="destructive" onClick={disable} disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Disable 2FA
              </Button>
              <Button variant="outline" onClick={() => setStep("idle")}>Cancel</Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
