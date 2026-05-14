"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Megaphone, Plus, Play, Pause, Send, Users, Clock, CheckCircle, Zap } from "lucide-react";
import { formatDate } from "@/lib/utils";

interface Campaign {
  id: string; name: string; type: string; triggerType: string; triggerValue?: string;
  messageTemplate: string; isActive: boolean; sentCount: number; lastRunAt?: string; createdAt: string;
}

const TRIGGER_TYPES = [
  { value: "WIN_BACK", label: "Win-Back (inactive customers)", description: "Customers with no visit in X days" },
  { value: "SERVICE_REMINDER", label: "Service Reminder", description: "Customers with upcoming maintenance due" },
  { value: "ALL_ACTIVE", label: "All Active Customers", description: "Blast to your full customer list" },
  { value: "POST_SERVICE", label: "Post-Service Review Request", description: "Sent automatically after job is paid (via cron)" },
  { value: "BIRTHDAY", label: "Birthday Message", description: "Sent on customer birthday (requires DOB on file)" },
];

const CAMPAIGN_TYPES = ["SMS", "EMAIL"];

const TEMPLATE_VARS = ["{firstName}", "{lastName}", "{name}"];

const PRESET_TEMPLATES = [
  { label: "Win-Back", template: "Hi {firstName}! We miss you at B&V Auto. It's been a while since your last service — reply BOOK to schedule your next appointment, or call us anytime. We'd love to take care of you again!" },
  { label: "Service Reminder", template: "Hi {firstName}, your vehicle is due for service soon! Give us a call or reply to this message to schedule. We'll keep you rolling. — B&V Auto" },
  { label: "Promotion", template: "Hi {firstName}! B&V Auto is running a special this week. Reply for details or call us to book your appointment. As always, we appreciate your business!" },
  { label: "Review Request", template: "Hi {firstName}, thank you for trusting us with your vehicle! If you had a great experience, we'd love a quick Google review — it means the world to a small business. Thanks! — B&V Auto" },
];

export default function MarketingPage() {
  const queryClient = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [sendResult, setSendResult] = useState<{ sentCount: number; totalTargeted: number } | null>(null);
  const [form, setForm] = useState({
    name: "", type: "SMS", triggerType: "WIN_BACK", triggerValue: "90", messageTemplate: "", isActive: true,
  });

  const { data: campaigns = [], isLoading } = useQuery<Campaign[]>({
    queryKey: ["campaigns"],
    queryFn: () => axios.get("/api/marketing/campaigns").then(r => r.data),
  });

  const createMutation = useMutation({
    mutationFn: () => axios.post("/api/marketing/campaigns", form),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["campaigns"] });
      setShowAdd(false);
      setForm({ name: "", type: "SMS", triggerType: "WIN_BACK", triggerValue: "90", messageTemplate: "", isActive: true });
    },
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      axios.patch(`/api/marketing/campaigns/${id}`, { isActive }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["campaigns"] }),
  });

  const sendMutation = useMutation({
    mutationFn: (id: string) => axios.post(`/api/marketing/campaigns/${id}/send`).then(r => r.data),
    onSuccess: (data) => { setSendResult(data); setSendingId(null); },
    onSettled: () => { queryClient.invalidateQueries({ queryKey: ["campaigns"] }); setSendingId(null); },
  });

  const TRIGGER_LABELS = Object.fromEntries(TRIGGER_TYPES.map(t => [t.value, t.label]));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Megaphone className="h-6 w-6 text-purple-600" /> Marketing Automation</h1>
          <p className="text-sm text-gray-500">Automated SMS campaigns — runs itself so you never miss a follow-up</p>
        </div>
        <Button onClick={() => setShowAdd(true)} className="bg-purple-600 hover:bg-purple-700"><Plus className="h-4 w-4 mr-2" /> New Campaign</Button>
      </div>

      {sendResult && (
        <Card className="border-green-300 bg-green-50">
          <CardContent className="p-4 flex items-center gap-3">
            <CheckCircle className="h-5 w-5 text-green-600" />
            <div>
              <p className="font-medium text-green-800">Campaign sent successfully!</p>
              <p className="text-sm text-green-700">{sendResult.sentCount} messages sent out of {sendResult.totalTargeted} targeted customers</p>
            </div>
            <Button size="sm" variant="outline" className="ml-auto" onClick={() => setSendResult(null)}>Dismiss</Button>
          </CardContent>
        </Card>
      )}

      {/* Quick stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card><CardContent className="p-4">
          <p className="text-xs text-gray-500">Total Campaigns</p>
          <p className="text-2xl font-bold">{campaigns.length}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-xs text-gray-500">Active Campaigns</p>
          <p className="text-2xl font-bold text-green-600">{campaigns.filter(c => c.isActive).length}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-xs text-gray-500">Total Messages Sent</p>
          <p className="text-2xl font-bold text-purple-600">{campaigns.reduce((s, c) => s + c.sentCount, 0)}</p>
        </CardContent></Card>
      </div>

      {/* How it works */}
      <Card className="border-purple-200 bg-purple-50">
        <CardContent className="p-4">
          <h3 className="font-semibold text-purple-900 flex items-center gap-2 mb-2"><Zap className="h-4 w-4" /> How It Works</h3>
          <div className="grid grid-cols-3 gap-4 text-sm text-purple-800">
            <div className="flex items-start gap-2"><span className="font-bold text-purple-600 text-base">1.</span> Create a campaign with a trigger (win-back, service reminder, etc.)</div>
            <div className="flex items-start gap-2"><span className="font-bold text-purple-600 text-base">2.</span> Click Send Now to run immediately, or it fires automatically via daily cron job</div>
            <div className="flex items-start gap-2"><span className="font-bold text-purple-600 text-base">3.</span> Customers receive personalized SMS messages and responses flow into their SMS thread</div>
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="text-center py-8 text-gray-500">Loading campaigns...</div>
      ) : campaigns.length === 0 ? (
        <Card><CardContent className="p-12 text-center text-gray-400">
          <Megaphone className="h-12 w-12 mx-auto mb-3 opacity-20" />
          <p className="font-medium">No campaigns yet</p>
          <p className="text-sm mt-1">Create your first automated campaign to re-engage customers</p>
        </CardContent></Card>
      ) : (
        <div className="space-y-3">
          {campaigns.map(campaign => (
            <Card key={campaign.id} className={campaign.isActive ? "" : "opacity-60"}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-bold text-gray-900">{campaign.name}</p>
                      <Badge className={campaign.isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}>
                        {campaign.isActive ? "Active" : "Paused"}
                      </Badge>
                      <Badge variant="outline" className="text-xs">{campaign.type}</Badge>
                      <Badge variant="outline" className="text-xs">{TRIGGER_LABELS[campaign.triggerType] || campaign.triggerType}</Badge>
                    </div>
                    <p className="text-sm text-gray-600 mt-1 bg-gray-50 rounded p-2 border mt-2 italic">"{campaign.messageTemplate.substring(0, 120)}{campaign.messageTemplate.length > 120 ? "..." : ""}"</p>
                    <div className="flex gap-4 mt-2 text-xs text-gray-500">
                      <span className="flex items-center gap-1"><Users className="h-3 w-3" />{campaign.sentCount} sent</span>
                      {campaign.lastRunAt && <span className="flex items-center gap-1"><Clock className="h-3 w-3" />Last run: {formatDate(campaign.lastRunAt)}</span>}
                      <span>Created {formatDate(campaign.createdAt)}</span>
                    </div>
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    <Button
                      size="sm" variant="outline"
                      onClick={() => toggleMutation.mutate({ id: campaign.id, isActive: !campaign.isActive })}
                    >
                      {campaign.isActive ? <><Pause className="h-3 w-3 mr-1" /> Pause</> : <><Play className="h-3 w-3 mr-1" /> Activate</>}
                    </Button>
                    <Button
                      size="sm"
                      className="bg-purple-600 hover:bg-purple-700"
                      disabled={sendingId === campaign.id}
                      onClick={() => { setSendingId(campaign.id); sendMutation.mutate(campaign.id); }}
                    >
                      <Send className="h-3 w-3 mr-1" />
                      {sendingId === campaign.id ? "Sending..." : "Send Now"}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Add campaign dialog */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>New Campaign</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Campaign Name *</Label>
              <Input placeholder="90-Day Win-Back" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label>Type</Label>
              <div className="flex gap-2">
                {CAMPAIGN_TYPES.map(t => (
                  <button key={t} onClick={() => setForm({ ...form, type: t })}
                    className={`px-4 py-1.5 rounded-md text-sm font-medium border ${form.type === t ? "bg-purple-600 text-white border-purple-600" : "border-gray-200 text-gray-600"}`}>
                    {t}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label>Trigger</Label>
              {TRIGGER_TYPES.map(t => (
                <label key={t.value} className={`flex items-start gap-3 p-2 rounded-lg border cursor-pointer transition-colors ${form.triggerType === t.value ? "border-purple-400 bg-purple-50" : "border-gray-200 hover:bg-gray-50"}`}>
                  <input type="radio" name="trigger" value={t.value} checked={form.triggerType === t.value} onChange={() => setForm({ ...form, triggerType: t.value })} className="mt-1" />
                  <div>
                    <p className="font-medium text-sm">{t.label}</p>
                    <p className="text-xs text-gray-500">{t.description}</p>
                  </div>
                </label>
              ))}
            </div>
            {form.triggerType === "WIN_BACK" && (
              <div className="space-y-1">
                <Label>Days of Inactivity</Label>
                <Input type="number" value={form.triggerValue} onChange={e => setForm({ ...form, triggerValue: e.target.value })} placeholder="90" />
              </div>
            )}
            <div className="space-y-2">
              <Label>Message Template *</Label>
              <p className="text-xs text-gray-500">Use {"{firstName}"}, {"{lastName}"}, {"{name}"} for personalization</p>
              <div className="flex gap-1 flex-wrap mb-1">
                {PRESET_TEMPLATES.map(t => (
                  <button key={t.label} onClick={() => setForm({ ...form, messageTemplate: t.template })}
                    className="text-xs px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded border">
                    Use {t.label} template
                  </button>
                ))}
              </div>
              <Textarea
                rows={4}
                placeholder="Hi {firstName}, ..."
                value={form.messageTemplate}
                onChange={e => setForm({ ...form, messageTemplate: e.target.value })}
              />
              <p className="text-xs text-gray-400">{form.messageTemplate.length} chars · {form.messageTemplate.length > 160 ? "Will send as multiple SMS" : "Single SMS"}</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAdd(false)}>Cancel</Button>
            <Button className="bg-purple-600 hover:bg-purple-700" onClick={() => createMutation.mutate()} disabled={!form.name || !form.messageTemplate || createMutation.isPending}>
              {createMutation.isPending ? "Creating..." : "Create Campaign"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
