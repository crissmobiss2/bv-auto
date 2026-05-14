"use client";

import { useState } from "react";
import QRCode from "qrcode";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { CreditCard, Copy, Check, ExternalLink, Loader2 } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

interface Props {
  invoiceId: string;
  amountDue: number;
  invoiceNumber: string;
}

export function CollectPaymentButton({ invoiceId, amountDue, invoiceNumber }: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [paymentUrl, setPaymentUrl] = useState<string | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCollect() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/invoices/${invoiceId}/collect`, { method: "POST" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Failed to create payment session");
      }
      const { url } = await res.json();
      if (!url) throw new Error("No payment URL returned");

      setPaymentUrl(url);

      // Generate QR code
      const dataUrl = await QRCode.toDataURL(url, {
        width: 280,
        margin: 2,
        color: { dark: "#1e3a5f", light: "#ffffff" },
      });
      setQrDataUrl(dataUrl);
      setOpen(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  async function handleCopy() {
    if (!paymentUrl) return;
    await navigator.clipboard.writeText(paymentUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <>
      <Button
        onClick={handleCollect}
        disabled={loading || amountDue <= 0}
        className="bg-blue-600 hover:bg-blue-700 text-white"
      >
        {loading ? (
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
        ) : (
          <CreditCard className="h-4 w-4 mr-2" />
        )}
        {loading ? "Preparing…" : "Collect Payment"}
      </Button>

      {error && <p className="text-sm text-red-600 mt-1">{error}</p>}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-blue-600" />
              Collect Payment
            </DialogTitle>
            <DialogDescription>
              Invoice {invoiceNumber} &mdash; {formatCurrency(amountDue)} due
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* QR Code */}
            {qrDataUrl && (
              <div className="flex flex-col items-center gap-2">
                <p className="text-sm text-gray-600 text-center">
                  Have the customer scan this QR code to pay with their phone (tap-to-pay, Apple Pay, Google Pay, or card).
                </p>
                <div className="border-2 border-gray-200 rounded-xl p-3 bg-white shadow-sm">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={qrDataUrl} alt="Payment QR Code" width={256} height={256} className="rounded" />
                </div>
              </div>
            )}

            {/* Divider */}
            <div className="flex items-center gap-2 text-xs text-gray-400">
              <div className="flex-1 h-px bg-gray-200" />
              or share the link
              <div className="flex-1 h-px bg-gray-200" />
            </div>

            {/* Copyable URL */}
            {paymentUrl && (
              <div className="flex gap-2">
                <input
                  readOnly
                  value={paymentUrl}
                  className="flex-1 text-xs border rounded-md px-2 py-1.5 bg-gray-50 text-gray-700 truncate focus:outline-none"
                />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleCopy}
                  className="shrink-0"
                >
                  {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            )}

            {/* Open in browser */}
            {paymentUrl && (
              <a href={paymentUrl} target="_blank" rel="noopener noreferrer">
                <Button variant="outline" className="w-full" size="sm">
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Open Payment Page
                </Button>
              </a>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
