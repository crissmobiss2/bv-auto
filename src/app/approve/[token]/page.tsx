"use client";

import { useParams } from "next/navigation";
import { useQuery, useMutation } from "@tanstack/react-query";
import axios from "axios";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { CheckCircle, XCircle, Clock, Car, FileText } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

export default function ApproveQuotePage() {
  const { token } = useParams<{ token: string }>();
  const [signerName, setSignerName] = useState("");
  const [declineReason, setDeclineReason] = useState("");
  const [showDecline, setShowDecline] = useState(false);
  const [result, setResult] = useState<"approved" | "declined" | null>(null);

  const { data: quote, isLoading, error } = useQuery({
    queryKey: ["approve-quote", token],
    queryFn: () => axios.get(`/api/approve/${token}`).then((r) => r.data),
    retry: false,
  });

  const actionMutation = useMutation({
    mutationFn: (action: "approve" | "decline") =>
      axios.post(`/api/approve/${token}`, { action, signerName, declineReason }),
    onSuccess: (_, action) => setResult(action === "approve" ? "approved" : "declined"),
  });

  if (isLoading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mx-auto mb-4" />
        <p className="text-gray-500">Loading your estimate...</p>
      </div>
    </div>
  );

  if (error || !quote) return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="max-w-md w-full">
        <CardContent className="p-8 text-center">
          <XCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-lg font-bold text-gray-900">Link Not Found</h2>
          <p className="text-gray-500 mt-2">This estimate link is invalid or has expired. Please contact us.</p>
          <a href="tel:5550001000" className="mt-4 inline-block text-blue-600 font-medium">(555) 000-1000</a>
        </CardContent>
      </Card>
    </div>
  );

  if (result === "approved") return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="max-w-md w-full">
        <CardContent className="p-8 text-center">
          <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-900">Estimate Approved!</h2>
          <p className="text-gray-500 mt-2">Thank you, {signerName || "Customer"}. We&apos;ll be in touch to confirm your appointment.</p>
          <p className="text-sm text-gray-400 mt-4">Questions? Call (555) 000-1000</p>
        </CardContent>
      </Card>
    </div>
  );

  if (result === "declined") return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="max-w-md w-full">
        <CardContent className="p-8 text-center">
          <XCircle className="h-16 w-16 text-gray-400 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-900">Estimate Declined</h2>
          <p className="text-gray-500 mt-2">We&apos;ve noted your response. Feel free to call us if you have questions or would like to discuss.</p>
          <a href="tel:5550001000" className="mt-4 inline-block text-blue-600 font-medium">(555) 000-1000</a>
        </CardContent>
      </Card>
    </div>
  );

  const isAlreadyActioned = ["APPROVED", "DECLINED"].includes(quote.status);
  const vehicle = quote.job?.vehicle;

  return (
    <div className="max-w-2xl mx-auto p-4 py-8 space-y-6">
      {/* Header */}
      <div className="text-center">
        <div className="bg-blue-900 text-white px-6 py-4 rounded-xl inline-block mb-4">
          <p className="text-xl font-bold">B&V Mobile Auto</p>
          <p className="text-blue-300 text-sm">Mobile Automotive Repair · Houston, TX</p>
        </div>
        <h1 className="text-2xl font-bold text-gray-900">Your Estimate</h1>
        <p className="text-gray-500 text-sm font-mono">{quote.quoteNumber}</p>
        {quote.validUntil && (
          <p className="text-sm text-orange-600 mt-1 flex items-center justify-center gap-1">
            <Clock className="h-4 w-4" /> Valid until {new Date(quote.validUntil).toLocaleDateString()}
          </p>
        )}
      </div>

      {/* Vehicle */}
      {vehicle && (
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <Car className="h-8 w-8 text-blue-600 flex-shrink-0" />
            <div>
              <p className="font-semibold">{vehicle.year} {vehicle.make} {vehicle.model}</p>
              {vehicle.plate && <p className="text-sm text-gray-500">Plate: {vehicle.plate}</p>}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Line items */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="h-4 w-4" /> Estimate Details
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {quote.lineItems?.map((li: { id: string; description: string; quantity: number; unitPrice: number; total: number; type: string; taxable: boolean }) => (
              <div key={li.id} className="flex justify-between items-start text-sm border-b pb-2 last:border-0">
                <div>
                  <p className="font-medium">{li.description}</p>
                  <p className="text-xs text-gray-400">{li.type} · {li.quantity} × {formatCurrency(li.unitPrice)}</p>
                </div>
                <p className="font-medium">{formatCurrency(li.total)}</p>
              </div>
            ))}
          </div>

          <div className="mt-4 pt-3 border-t space-y-1 text-sm">
            <div className="flex justify-between text-gray-500">
              <span>Subtotal</span>
              <span>{formatCurrency(quote.subtotal)}</span>
            </div>
            {Number(quote.taxAmount) > 0 && (
              <div className="flex justify-between text-gray-500">
                <span>Tax ({Number(quote.taxRate)}%)</span>
                <span>{formatCurrency(quote.taxAmount)}</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-lg border-t pt-2 mt-2">
              <span>Total</span>
              <span className="text-blue-700">{formatCurrency(quote.totalAmount)}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {quote.notes && (
        <Card>
          <CardContent className="p-4 text-sm text-gray-700">
            <p className="font-medium text-gray-900 mb-1">Notes from your technician:</p>
            <p>{quote.notes}</p>
          </CardContent>
        </Card>
      )}

      {/* Action */}
      {isAlreadyActioned ? (
        <Card>
          <CardContent className="p-4 text-center">
            <p className="font-medium text-gray-700">
              {quote.status === "APPROVED" ? "✓ You have already approved this estimate." : "This estimate was declined."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Your Name (for records)</Label>
            <Input
              placeholder="Your full name..."
              value={signerName}
              onChange={(e) => setSignerName(e.target.value)}
            />
          </div>

          {showDecline && (
            <div className="space-y-2">
              <Label>Reason for declining (optional)</Label>
              <Textarea
                placeholder="Let us know why..."
                value={declineReason}
                onChange={(e) => setDeclineReason(e.target.value)}
                rows={3}
              />
            </div>
          )}

          <div className="flex gap-3">
            {!showDecline ? (
              <>
                <Button
                  className="flex-1 bg-green-600 hover:bg-green-700"
                  size="lg"
                  onClick={() => actionMutation.mutate("approve")}
                  disabled={!signerName || actionMutation.isPending}
                >
                  <CheckCircle className="h-5 w-5 mr-2" />
                  {actionMutation.isPending ? "Approving..." : "Approve Estimate"}
                </Button>
                <Button
                  variant="outline"
                  size="lg"
                  onClick={() => setShowDecline(true)}
                >
                  Decline
                </Button>
              </>
            ) : (
              <>
                <Button
                  variant="outline"
                  size="lg"
                  className="flex-1"
                  onClick={() => setShowDecline(false)}
                >
                  Back
                </Button>
                <Button
                  variant="destructive"
                  size="lg"
                  className="flex-1"
                  onClick={() => actionMutation.mutate("decline")}
                  disabled={actionMutation.isPending}
                >
                  <XCircle className="h-5 w-5 mr-2" />
                  Confirm Decline
                </Button>
              </>
            )}
          </div>

          <p className="text-xs text-gray-400 text-center">
            By approving, you authorize B&V Mobile Auto to perform the services listed above.
          </p>
        </div>
      )}

      <div className="text-center text-sm text-gray-400">
        <p>Questions? Call us at <a href="tel:5550001000" className="text-blue-600">(555) 000-1000</a></p>
      </div>
    </div>
  );
}
