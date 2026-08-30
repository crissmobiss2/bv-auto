"use client";

import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { MessageSquare, Send, Phone, Loader2, AlertTriangle } from "lucide-react";

interface SmsMessage {
  id: string;
  direction: "INBOUND" | "OUTBOUND";
  body: string;
  fromNumber: string;
  toNumber: string;
  createdAt: string;
}

interface Customer { firstName: string; lastName: string; phone: string }

function formatTime(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  if (isToday) return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

const QUICK_REPLIES = [
  "Your vehicle is ready for pickup!",
  "We're waiting on a part — we'll update you as soon as it arrives.",
  "Work has started on your vehicle. We'll keep you posted!",
  "Could you please confirm your availability for pickup?",
  "Your estimate is ready. Please check your approval link.",
  "Thank you for choosing B&V Auto!",
];

export function SmsThread({ jobId }: { jobId: string }) {
  const queryClient = useQueryClient();
  const [text, setText] = useState("");
  const [showQuick, setShowQuick] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["sms-thread", jobId],
    queryFn: () => axios.get(`/api/jobs/${jobId}/sms`).then(r => r.data),
    refetchInterval: 15_000,
  });

  const messages: SmsMessage[] = data?.messages ?? [];
  const customer: Customer | null = data?.customer ?? null;

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  const sendMutation = useMutation({
    mutationFn: (body: string) => axios.post(`/api/jobs/${jobId}/sms`, { body }),
    onSuccess: () => {
      setText("");
      setShowQuick(false);
      queryClient.invalidateQueries({ queryKey: ["sms-thread", jobId] });
    },
  });

  const handleSend = () => {
    const trimmed = text.trim();
    if (!trimmed || sendMutation.isPending) return;
    sendMutation.mutate(trimmed);
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleSend();
  };

  if (isLoading) return (
    <div className="flex items-center justify-center py-8 text-gray-400">
      <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading messages…
    </div>
  );

  if (isError) return (
    <div className="flex items-center gap-2 p-4 text-sm text-red-600 bg-red-50 rounded-lg border border-red-200">
      <AlertTriangle className="h-4 w-4" /> Failed to load messages.
    </div>
  );

  if (!customer?.phone) return (
    <div className="flex items-center gap-2 p-4 text-sm text-amber-700 bg-amber-50 rounded-lg border border-amber-200">
      <Phone className="h-4 w-4" /> Customer has no phone number on file. Add one to enable SMS.
    </div>
  );

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b mb-3 flex-shrink-0">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-blue-600" />
          <span className="text-sm font-semibold text-gray-800">
            {customer.firstName} {customer.lastName}
          </span>
          <span className="text-xs text-gray-400">{customer.phone}</span>
        </div>
        <Badge variant="outline" className="text-xs">{messages.length} messages</Badge>
      </div>

      {/* Message thread */}
      <div className="flex-1 overflow-y-auto space-y-2.5 min-h-[200px] max-h-[360px] pr-1">
        {messages.length === 0 ? (
          <div className="text-center py-10 text-gray-400">
            <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-30" />
            <p className="text-sm">No messages yet. Start the conversation below.</p>
          </div>
        ) : (
          messages.map(msg => (
            <div
              key={msg.id}
              className={`flex ${msg.direction === "OUTBOUND" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[80%] rounded-2xl px-3.5 py-2.5 text-sm shadow-sm ${
                  msg.direction === "OUTBOUND"
                    ? "bg-blue-600 text-white rounded-tr-sm"
                    : "bg-gray-100 text-gray-800 rounded-tl-sm"
                }`}
              >
                <p className="leading-relaxed whitespace-pre-wrap">{msg.body}</p>
                <p className={`text-[10px] mt-1 ${msg.direction === "OUTBOUND" ? "text-blue-200 text-right" : "text-gray-400"}`}>
                  {formatTime(msg.createdAt)}
                  {msg.direction === "OUTBOUND" && " · Sent"}
                </p>
              </div>
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>

      {/* Quick replies */}
      {showQuick && (
        <div className="mt-3 space-y-1.5 flex-shrink-0">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Quick Replies</p>
          <div className="flex flex-wrap gap-1.5">
            {QUICK_REPLIES.map((r, i) => (
              <button
                key={i}
                onClick={() => { setText(r); setShowQuick(false); }}
                className="text-xs px-2.5 py-1 rounded-full border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors"
              >
                {r.length > 40 ? r.slice(0, 40) + "…" : r}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Compose */}
      <div className="mt-3 space-y-2 flex-shrink-0">
        {sendMutation.isError && (
          <p className="text-xs text-red-600 bg-red-50 px-3 py-1.5 rounded border border-red-200">
            {(sendMutation.error as { response?: { data?: { error?: string } } })?.response?.data?.error || "Failed to send. Check Twilio config."}
          </p>
        )}
        <Textarea
          rows={3}
          placeholder="Type a message… (Cmd+Enter to send)"
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={handleKey}
          className="resize-none text-sm"
        />
        <div className="flex items-center justify-between gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="text-xs text-gray-500"
            onClick={() => setShowQuick(!showQuick)}
          >
            ⚡ Quick replies
          </Button>
          <Button
            size="sm"
            onClick={handleSend}
            disabled={!text.trim() || sendMutation.isPending}
            className="bg-blue-600 hover:bg-blue-700 text-white min-w-[80px]"
          >
            {sendMutation.isPending
              ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
              : <><Send className="h-3.5 w-3.5 mr-1.5" /> Send</>}
          </Button>
        </div>
      </div>
    </div>
  );
}
