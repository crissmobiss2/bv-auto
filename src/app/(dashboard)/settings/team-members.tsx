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
import { UserPlus } from "lucide-react";

const ROLES = ["ADMIN", "DISPATCHER", "TECHNICIAN", "ACCOUNTANT", "PARTS_COORDINATOR"] as const;

type Member = { id: string; name: string | null; email: string; role: string; isActive: boolean };

function errorMessage(e: unknown, fallback: string) {
  return (axios.isAxiosError(e) && e.response?.data?.error) || fallback;
}

export function TeamMembers({ users, currentUserId }: { users: Member[]; currentUserId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "TECHNICIAN" });
  const [showInactive, setShowInactive] = useState(false);

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

  const visible = users.filter((u) => showInactive || u.isActive);
  const inactiveCount = users.filter((u) => !u.isActive).length;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">Team Members</CardTitle>
        <Button size="sm" className="gap-1" onClick={() => { setError(null); setInviteOpen(true); }}>
          <UserPlus className="h-4 w-4" /> Add member
        </Button>
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
                    disabled={isSelf || !u.isActive || busy === u.id}
                    onValueChange={(role) => update(u.id, { role })}
                  >
                    <SelectTrigger className="w-44 h-8 text-xs" aria-label={`Role for ${u.email}`}><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {ROLES.map((r) => <SelectItem key={r} value={r}>{r.replace(/_/g, " ")}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  {!isSelf && (
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
              <p className="text-xs text-gray-500 mt-1">Share it with them; they can change it via Forgot password.</p>
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
    </Card>
  );
}
