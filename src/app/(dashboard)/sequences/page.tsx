"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Trash2, MessageSquare, Users, ChevronRight, GripVertical } from "lucide-react";

type SequenceStep = {
  stepNumber: number;
  delayHours: number;
  channel: string;
  messageTemplate: string;
};

type Sequence = {
  id: string;
  name: string;
  triggerEvent: string;
  isActive: boolean;
  steps: SequenceStep[];
  _count: { enrollments: number };
  createdAt: string;
};

const TRIGGER_EVENTS = [
  { value: "JOB_COMPLETED", label: "Job Completed" },
  { value: "INVOICE_SENT", label: "Invoice Sent" },
  { value: "QUOTE_SENT", label: "Quote Sent" },
  { value: "APPOINTMENT_BOOKED", label: "Appointment Booked" },
  { value: "CUSTOMER_CREATED", label: "New Customer" },
  { value: "SERVICE_DUE", label: "Service Due Reminder" },
  { value: "MANUAL", label: "Manual Enrollment" },
];

const TEMPLATE_VARS = ["{{firstName}}", "{{lastName}}", "{{name}}"];

export default function SequencesPage() {
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: "", triggerEvent: "JOB_COMPLETED" });
  const [steps, setSteps] = useState<SequenceStep[]>([
    { stepNumber: 1, delayHours: 0, channel: "SMS", messageTemplate: "Hi {{firstName}}, thank you for choosing us! We appreciate your business." },
  ]);

  const { data, isLoading } = useQuery({
    queryKey: ["sequences"],
    queryFn: () => axios.get("/api/sequences").then((r) => r.data),
  });

  const createMutation = useMutation({
    mutationFn: () => axios.post("/api/sequences", { ...form, steps }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sequences"] });
      setShowCreate(false);
      setForm({ name: "", triggerEvent: "JOB_COMPLETED" });
      setSteps([{ stepNumber: 1, delayHours: 0, channel: "SMS", messageTemplate: "Hi {{firstName}}, thank you for choosing us! We appreciate your business." }]);
    },
  });

  const addStep = () => {
    const last = steps[steps.length - 1];
    setSteps([...steps, {
      stepNumber: steps.length + 1,
      delayHours: (last?.delayHours || 0) + 24,
      channel: "SMS",
      messageTemplate: "",
    }]);
  };

  const removeStep = (index: number) => {
    setSteps(steps.filter((_, i) => i !== index).map((s, i) => ({ ...s, stepNumber: i + 1 })));
  };

  const updateStep = (index: number, field: keyof SequenceStep, value: string | number) => {
    const updated = [...steps];
    (updated[index] as Record<string, unknown>)[field] = value;
    setSteps(updated);
  };

  const sequences: Sequence[] = data?.sequences || [];
  const activeEnrollments: number = data?.activeEnrollments || 0;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Communication Sequences</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">Automated SMS follow-up workflows · {activeEnrollments} active enrollments</p>
        </div>
        <Button onClick={() => setShowCreate(true)}>
          <Plus className="h-4 w-4 mr-2" /> New Sequence
        </Button>
      </div>

      {/* Sequences */}
      {isLoading ? (
        <div className="text-center text-gray-500 dark:text-gray-400 py-8">Loading sequences...</div>
      ) : sequences.length === 0 ? (
        <div className="text-center text-gray-500 dark:text-gray-400 py-12">
          <MessageSquare className="h-12 w-12 text-gray-300 mx-auto mb-3" />
          <p>No sequences yet. Create your first automated workflow.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {sequences.map((seq) => (
            <Card key={seq.id}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <MessageSquare className="h-4 w-4 text-blue-500" />
                      <span className="font-semibold">{seq.name}</span>
                      <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">
                        {TRIGGER_EVENTS.find((t) => t.value === seq.triggerEvent)?.label || seq.triggerEvent}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400 mb-3">
                      <span className="flex items-center gap-1"><Users className="h-3 w-3" /> {seq._count.enrollments} enrolled</span>
                      <span>{seq.steps.length} step{seq.steps.length !== 1 ? "s" : ""}</span>
                      <span>Created {new Date(seq.createdAt).toLocaleDateString()}</span>
                    </div>

                    {/* Steps visualization */}
                    <div className="flex items-center gap-1 flex-wrap">
                      {seq.steps.map((step, i) => (
                        <div key={i} className="flex items-center gap-1">
                          <div className="bg-gray-50 dark:bg-white/5 border rounded px-2 py-1 text-xs">
                            <span className="font-medium text-gray-600 dark:text-gray-400">Step {step.stepNumber}</span>
                            <span className="text-gray-400 ml-1">
                              {step.delayHours === 0 ? "immediately" : `+${step.delayHours}h`}
                            </span>
                            <span className="ml-1 text-blue-500">{step.channel}</span>
                          </div>
                          {i < seq.steps.length - 1 && <ChevronRight className="h-3 w-3 text-gray-400" />}
                        </div>
                      ))}
                    </div>

                    {/* Message preview */}
                    {seq.steps[0] && (
                      <p className="text-xs text-gray-400 mt-2 italic truncate max-w-lg">
                        &quot;{seq.steps[0].messageTemplate}&quot;
                      </p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Communication Sequence</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Sequence Name *</Label>
                <Input
                  placeholder="e.g. Post-Job Follow-up"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Trigger Event *</Label>
                <Select value={form.triggerEvent} onValueChange={(v) => setForm({ ...form, triggerEvent: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TRIGGER_EVENTS.map((t) => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="text-xs text-gray-500 dark:text-gray-400 bg-blue-50 p-2 rounded">
              Template variables: {TEMPLATE_VARS.map((v) => <code key={v} className="bg-white dark:bg-gray-900 border px-1 rounded mx-0.5">{v}</code>)}
            </div>

            {/* Steps */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Steps</Label>
                <Button type="button" size="sm" variant="outline" onClick={addStep}>
                  <Plus className="h-3 w-3 mr-1" /> Add Step
                </Button>
              </div>

              {steps.map((step, index) => (
                <div key={index} className="border rounded-lg p-3 space-y-2 bg-gray-50 dark:bg-white/5">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium flex items-center gap-2">
                      <GripVertical className="h-4 w-4 text-gray-400" />
                      Step {step.stepNumber}
                    </span>
                    {steps.length > 1 && (
                      <Button type="button" size="icon" variant="ghost" className="h-6 w-6 text-red-500" onClick={() => removeStep(index)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="space-y-1">
                      <Label className="text-xs">Delay (hours)</Label>
                      <Input
                        type="number"
                        min="0"
                        value={step.delayHours}
                        onChange={(e) => updateStep(index, "delayHours", parseInt(e.target.value) || 0)}
                        placeholder="0 = immediate"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Channel</Label>
                      <Select value={step.channel} onValueChange={(v) => updateStep(index, "channel", v)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="SMS">SMS</SelectItem>
                          <SelectItem value="EMAIL">Email</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Message Template</Label>
                    <Textarea
                      rows={3}
                      value={step.messageTemplate}
                      onChange={(e) => updateStep(index, "messageTemplate", e.target.value)}
                      placeholder="Hi {{firstName}}, ..."
                    />
                    <p className="text-xs text-gray-400">{step.messageTemplate.length} chars</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
              <Button
                disabled={!form.name || !steps.every((s) => s.messageTemplate) || createMutation.isPending}
                onClick={() => createMutation.mutate()}
              >
                {createMutation.isPending ? "Creating..." : "Create Sequence"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
