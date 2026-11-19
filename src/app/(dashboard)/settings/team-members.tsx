"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import axios from "axios";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { UserPlus, KeyRound, Copy, Check } from "lucide-react";

const ROLES = ["ADMIN", "DISPATCHER", "TECHNICIAN", "ACCOUNTANT", "PARTS_COORDINATOR"] as const;

type Member = { id: string; name: string | null; email: string; role: string; isActive: boolean };

function errorMessage(e: unknown, fallback: string) {
  return (axios.isAxiosError(e) && e.response?.data?.error) || fallback;
}

export function TeamMembers({ users, currentUserId, canManage }: { users: Member[]; currentUserId: string; canManage: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "TECHNICIAN" });
  const [showInactive, setShowInactive] = useState(false);
  const [resetResult, setResetResult] = useState<{ email: string; tempPassword: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const update = async (id: string, data: { role?: string; isActive?: boolean }) => {
    setBusy(id);
    setError(null);
    try {
      await axios.patch(`/api/users/${id}`, data);
      router.refresh();
    } catch (e) {
      setError(errorMessage(e, "Update failed"));
    } finally {
      setBusy(null);
    }
  };

  const invite = async () => {
    setBusy("invite");
    setError(null);
    try {
      await axios.post("/api/users", form);
      setInviteOpen(false);
      setForm({ name: "", email: "", password: "", role: "TECHNICIAN" });
      router.refresh();
    } catch (e) {
      setError(errorMessage(e, "Could not add team member"));
    } finally {
      setBusy(null);
    }
  };

  const resetPassword = async (id: string, email: string) => {
    if (!confirm(`Reset the password for ${email}? Every active session for this member will be signed out.`)) return;
    setBusy(id);
    setError(null);
    try {
      const { data } = await axios.post<{ email: string; tempPassword: string }>(`/api/users/${id}/reset-password`);
      setResetResult({ email: data.email, tempPassword: data.tempPassword });
    } catch (e) {
      setError(errorMessage(e, "Could not reset the password"));
    } finally {
      setBusy(null);
    }
  };

  const copyPassword = async () => {
    if (!resetResult) return;
    try {
      await navigator.clipboard.writeText(resetResult.tempPassword);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Selecting the value in the input still lets the admin copy it manually.
    }
  };

  const visible = users.filter((u) => showInactive || u.isActive);
  const inactiveCount = users.filter((u) => !u.isActive).length;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">Team Members</CardTitle>
        {canManage && (
          <Button size="sm" className="gap-1" onClick={() => { setError(null); setInviteOpen(true); }}>
            <UserPlus className="h-4 w-4" /> Add member
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {error && <p className="mb-3 text-sm text-red-600" role="alert">{error}</p>}
        <div className="space-y-3">
          {visible.map((u) => {
            const isSelf = u.id === currentUserId;
            return (
              <div key={u.id} className={`flex flex-wrap items-center justify-between gap-2 p-3 border rounded-lg ${u.isActive ? "" : "opacity-60"}`}>
                <div>
                  <p className="font-medium text-sm">{u.name}{isSelf && <span className="text-gray-400"> (you)</span>}</p>
                  <p className="text-xs text-gray-500">{u.email}{!u.isActive && " · deactivated"}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Select
                    value={u.role}
                    disabled={!canManage || isSelf || !u.isActive || busy === u.id}
                    onValueChange={(role) => update(u.id, { role })}
                  >
                    <SelectTrigger className="w-44 h-8 text-xs" aria-label={`Role for ${u.email}`}><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {ROLES.map((r) => <SelectItem key={r} value={r}>{r.replace(/_/g, " ")}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  {canManage && !isSelf && (
                    <>
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={busy === u.id || !u.isActive}
                        onClick={() => resetPassword(u.id, u.email)}
                      >
                        <KeyRound className="h-3.5 w-3.5 mr-1" /> Reset
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busy === u.id}
                        onClick={() => {
                          if (u.isActive && !confirm(`Deactivate ${u.email}? They will be signed out and unable to log in.`)) return;
                          update(u.id, { isActive: !u.isActive });
                        }}
                      >
                        {u.isActive ? "Deactivate" : "Reactivate"}
                      </Button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        {inactiveCount > 0 && (
          <button className="mt-3 text-xs text-blue-600 hover:underline" onClick={() => setShowInactive((v) => !v)}>
            {showInactive ? "Hide" : "Show"} {inactiveCount} deactivated
          </button>
        )}
      </CardContent>

      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add team member</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label htmlFor="tm-name">Name</Label><Input id="tm-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div><Label htmlFor="tm-email">Email</Label><Input id="tm-email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
            <div>
              <Label htmlFor="tm-password">Temporary password (min 8 characters)</Label>
              <Input id="tm-password" type="text" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
              <p className="text-xs text-gray-500 mt-1">Share it with them; they can change it after signing in.</p>
            </div>
            <div>
              <Label>Role</Label>
              <Select value={form.role} onValueChange={(role) => setForm({ ...form, role })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ROLES.map((r) => <SelectItem key={r} value={r}>{r.replace(/_/g, " ")}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {error && <p className="text-sm text-red-600" role="alert">{error}</p>}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setInviteOpen(false)}>Cancel</Button>
              <Button
                disabled={busy === "invite" || !form.name || !form.email || form.password.length < 8}
                onClick={invite}
              >
                {busy === "invite" ? "Adding..." : "Add member"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!resetResult} onOpenChange={(open) => { if (!open) { setResetResult(null); setCopied(false); } }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Temporary password</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-gray-600">
              Share this with <strong>{resetResult?.email}</strong>. Their other sessions are signed out. They can change it after signing in.
            </p>
            <div className="flex gap-2">
              <Input
                readOnly
                value={resetResult?.tempPassword ?? ""}
                aria-label="Temporary password"
                onFocus={(e) => e.currentTarget.select()}
                className="font-mono"
              />
              <Button type="button" variant="outline" onClick={copyPassword}>
                {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
                <span className="sr-only">{copied ? "Copied" : "Copy password"}</span>
              </Button>
            </div>
            <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-2">
              This password is shown once. It is not stored anywhere in readable form. Two-factor authentication is unchanged.
            </p>
            <div className="flex justify-end">
              <Button onClick={() => { setResetResult(null); setCopied(false); }}>Done</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
