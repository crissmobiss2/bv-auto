"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Shield, Download, Trash2, AlertTriangle, CheckCircle, Loader2 } from "lucide-react";

export default function PrivacyPage() {
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteSuccess, setDeleteSuccess] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  async function handleDeleteRequest() {
    if (!confirmed) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      const res = await fetch("/api/customer/delete-request", { method: "POST" });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Request failed");
      setDeleteSuccess(true);
      setDeleteOpen(false);
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setDeleting(false);
    }
  }

  function handleDownload() {
    window.location.href = "/api/customer/export";
  }

  return (
    <div className="space-y-4 max-w-2xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Shield className="h-6 w-6 text-blue-600" /> My Privacy &amp; Data
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Your rights under the California Consumer Privacy Act (CCPA) and how we handle your data.
        </p>
      </div>

      {/* Section 1: Download My Data */}
      <Card>
        <CardContent className="p-5 space-y-3">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-blue-50 rounded-lg shrink-0">
              <Download className="h-5 w-5 text-blue-600" />
            </div>
            <div className="flex-1">
              <h2 className="font-semibold text-gray-900">Download My Data</h2>
              <p className="text-sm text-gray-600 mt-1">
                You have the right to know what personal information we have collected about you.
                Download a complete copy of your data as a JSON file, including:
              </p>
              <ul className="mt-2 text-sm text-gray-600 list-disc list-inside space-y-0.5">
                <li>Your profile and contact information</li>
                <li>Vehicles registered with us</li>
                <li>Service and repair history</li>
                <li>Invoices and payment records</li>
                <li>Communication history (emails &amp; SMS)</li>
              </ul>
              <Button onClick={handleDownload} className="mt-4 bg-blue-600 hover:bg-blue-700 text-white">
                <Download className="h-4 w-4 mr-2" />
                Download My Data
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Section 2: Delete My Account */}
      <Card className="border-red-200">
        <CardContent className="p-5 space-y-3">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-red-50 rounded-lg shrink-0">
              <Trash2 className="h-5 w-5 text-red-600" />
            </div>
            <div className="flex-1">
              <h2 className="font-semibold text-gray-900">Delete My Account</h2>
              <p className="text-sm text-gray-600 mt-1">
                You have the right to request deletion of your personal information. Once processed:
              </p>
              <ul className="mt-2 text-sm text-gray-600 list-disc list-inside space-y-0.5">
                <li>Your profile, contact info, and account will be permanently removed</li>
                <li>Service history and vehicle records will be deleted</li>
                <li>This action <strong>cannot be undone</strong></li>
                <li>We may retain certain records required by law (e.g., financial records)</li>
              </ul>
              <p className="text-sm text-gray-500 mt-3">
                Deletion requests are processed within <strong>30 days</strong> per CCPA requirements.
              </p>

              {deleteSuccess ? (
                <div className="mt-4 flex items-center gap-2 text-green-700 bg-green-50 border border-green-200 rounded-lg px-4 py-3 text-sm">
                  <CheckCircle className="h-4 w-4 shrink-0" />
                  Your deletion request has been submitted. We will process it within 30 days.
                </div>
              ) : (
                <Button
                  onClick={() => setDeleteOpen(true)}
                  variant="outline"
                  className="mt-4 border-red-300 text-red-600 hover:bg-red-50"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Request Account Deletion
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Section 3: Data We Collect */}
      <Card>
        <CardContent className="p-5 space-y-3">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-gray-50 rounded-lg shrink-0">
              <Shield className="h-5 w-5 text-gray-600" />
            </div>
            <div className="flex-1">
              <h2 className="font-semibold text-gray-900">Data We Collect</h2>
              <p className="text-sm text-gray-600 mt-1">
                We collect only the information necessary to provide our mobile auto repair services:
              </p>
              <ul className="mt-2 text-sm text-gray-600 list-disc list-inside space-y-1">
                <li><strong>Name &amp; contact info</strong> — to identify you and communicate about your service</li>
                <li><strong>Email address</strong> — for invoices, receipts, and service updates</li>
                <li><strong>Phone number</strong> — for appointment reminders and SMS updates</li>
                <li><strong>Vehicle information</strong> — make, model, year, VIN, and mileage for accurate service</li>
                <li><strong>Service history</strong> — jobs performed, parts used, and technician notes</li>
                <li><strong>Payment records</strong> — invoices, amounts, and payment methods (no card numbers stored)</li>
              </ul>
              <p className="text-sm text-gray-500 mt-3">
                We do not sell your personal information to third parties. Data is used solely to provide and improve our services.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteOpen} onOpenChange={(o) => { setDeleteOpen(o); if (!o) { setConfirmed(false); setDeleteError(null); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="h-5 w-5" />
              Confirm Account Deletion
            </DialogTitle>
            <DialogDescription>
              This will send a deletion request to B&amp;V Auto. Your data will be permanently removed within 30 days. This cannot be undone.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={confirmed}
                onChange={(e) => setConfirmed(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-gray-300 accent-red-600"
              />
              <span className="text-sm text-gray-700">
                I understand this will permanently delete all my data from B&amp;V Auto and cannot be undone.
              </span>
            </label>

            {deleteError && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
                {deleteError}
              </p>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)} disabled={deleting}>
              Cancel
            </Button>
            <Button
              onClick={handleDeleteRequest}
              disabled={!confirmed || deleting}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {deleting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Submitting…
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Submit Deletion Request
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
