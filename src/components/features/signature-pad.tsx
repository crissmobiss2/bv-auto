"use client";

import { useRef, useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { PenLine, Trash2, Check } from "lucide-react";

export function SignaturePad({ jobId, signatures }: {
  jobId: string;
  signatures: { id: string; signerName: string; signerRole: string; signedAt: string }[];
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [signerName, setSignerName] = useState("");
  const [hasSignature, setHasSignature] = useState(false);
  const queryClient = useQueryClient();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.strokeStyle = "#1e3a5f";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
  }, []);

  const getPos = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    if ("touches" in e) {
      return {
        x: (e.touches[0].clientX - rect.left) * scaleX,
        y: (e.touches[0].clientY - rect.top) * scaleY,
      };
    }
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  };

  const startDraw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    const { x, y } = getPos(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);
    setHasSignature(true);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    if (!isDrawing) return;
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    const { x, y } = getPos(e);
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const endDraw = () => setIsDrawing(false);

  const clear = () => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasSignature(false);
  };

  const saveMutation = useMutation({
    mutationFn: () => {
      const canvas = canvasRef.current!;
      const imageData = canvas.toDataURL("image/png");
      return axios.post(`/api/jobs/${jobId}/signature`, {
        signerName: signerName || "Customer",
        signerRole: "Customer",
        imageData,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["job", jobId] });
      clear();
      setSignerName("");
    },
  });

  return (
    <div className="space-y-4">
      {signatures.length > 0 && (
        <div className="space-y-2">
          {signatures.map((sig) => (
            <div key={sig.id} className="flex items-center gap-3 p-3 bg-green-50 border border-green-200 rounded-md text-sm">
              <Check className="h-4 w-4 text-green-600" />
              <div>
                <p className="font-medium text-green-800">{sig.signerName} signed</p>
                <p className="text-xs text-green-600">{sig.signerRole} · {new Date(sig.signedAt).toLocaleString()}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center gap-2">
            <PenLine className="h-4 w-4 text-gray-500" />
            <p className="text-sm font-medium">Capture Signature</p>
          </div>
          <div className="space-y-2">
            <Label>Signer Name</Label>
            <Input
              placeholder="Customer name..."
              value={signerName}
              onChange={(e) => setSignerName(e.target.value)}
            />
          </div>
          <div className="border-2 border-dashed border-gray-200 rounded-lg bg-gray-50">
            <canvas
              ref={canvasRef}
              width={600}
              height={200}
              className="w-full rounded-lg touch-none cursor-crosshair"
              style={{ touchAction: "none" }}
              onMouseDown={startDraw}
              onMouseMove={draw}
              onMouseUp={endDraw}
              onMouseLeave={endDraw}
              onTouchStart={startDraw}
              onTouchMove={draw}
              onTouchEnd={endDraw}
            />
            <p className="text-xs text-gray-400 text-center pb-2">Sign above</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={clear} disabled={!hasSignature}>
              <Trash2 className="h-4 w-4 mr-1" /> Clear
            </Button>
            <Button
              size="sm"
              onClick={() => saveMutation.mutate()}
              disabled={!hasSignature || saveMutation.isPending}
            >
              <Check className="h-4 w-4 mr-1" />
              {saveMutation.isPending ? "Saving..." : "Save Signature"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
