"use client";

import { useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Camera, Upload, X, Trash2, PenLine, RotateCcw, Check } from "lucide-react";

type Photo = { id: string; url: string; caption?: string; takenAt: string };

export function PhotoUpload({ jobId, photos }: { jobId: string; photos: Photo[] }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [caption, setCaption] = useState("");
  const [preview, setPreview] = useState<{ file: File; url: string } | null>(null);
  const [annotating, setAnnotating] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const strokes = useRef<{ x: number; y: number }[][]>([]);
  const queryClient = useQueryClient();

  const uploadMutation = useMutation({
    mutationFn: () => {
      if (!preview) throw new Error("No file selected");
      const fd = new FormData();
      fd.append("file", preview.file);
      fd.append("caption", caption);
      return axios.post(`/api/jobs/${jobId}/photos`, fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["job", jobId] });
      setPreview(null);
      setCaption("");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (photoId: string) =>
      axios.delete(`/api/jobs/${jobId}/photos`, { data: { photoId } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["job", jobId] }),
  });

  const handleFile = (file: File) => {
    const url = URL.createObjectURL(file);
    setPreview({ file, url });
  };

  const startAnnotating = () => {
    if (!preview) return;
    setAnnotating(true);
    strokes.current = [];
    const img = new Image();
    img.onload = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const maxW = Math.min(img.width, 900);
      const scale = maxW / img.width;
      canvas.width = maxW;
      canvas.height = img.height * scale;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      ctx.strokeStyle = "#ef4444";
      ctx.lineWidth = Math.max(3, canvas.width / 200);
      ctx.lineJoin = "round";
      ctx.lineCap = "round";
    };
    img.src = preview.url;
  };

  const canvasPos = (e: React.PointerEvent) => {
    const canvas = canvasRef.current!;
    const r = canvas.getBoundingClientRect();
    return { x: (e.clientX - r.left) * (canvas.width / r.width), y: (e.clientY - r.top) * (canvas.height / r.height) };
  };

  const redraw = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx || !preview) return;
    const img = new Image();
    img.onload = () => {
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      ctx.strokeStyle = "#ef4444";
      ctx.lineWidth = Math.max(3, canvas.width / 200);
      ctx.lineJoin = "round";
      ctx.lineCap = "round";
      for (const stroke of strokes.current) {
        if (stroke.length < 2) continue;
        ctx.beginPath();
        ctx.moveTo(stroke[0].x, stroke[0].y);
        for (const pt of stroke.slice(1)) ctx.lineTo(pt.x, pt.y);
        ctx.stroke();
      }
    };
    img.src = preview.url;
  };

  const finishAnnotating = () => {
    const canvas = canvasRef.current;
    if (!canvas || !preview) return;
    canvas.toBlob((blob) => {
      if (!blob) return;
      const name = preview.file.name.replace(/\.[^.]+$/, "") + "-annotated.png";
      const file = new File([blob], name, { type: "image/png" });
      setPreview({ file, url: URL.createObjectURL(file) });
      setAnnotating(false);
    }, "image/png");
  };

  return (
    <div className="space-y-4">
      {/* Upload area */}
      <div
        className="border-2 border-dashed border-gray-200 rounded-lg p-6 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors"
        onClick={() => fileRef.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          const file = e.dataTransfer.files[0];
          if (file?.type.startsWith("image/")) handleFile(file);
        }}
      >
        <Camera className="h-8 w-8 text-gray-300 mx-auto mb-2" />
        <p className="text-sm text-gray-500">Click to upload or drag & drop</p>
        <p className="text-xs text-gray-400">JPG, PNG, HEIC up to 10MB</p>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
        />
      </div>

      {/* Preview + upload */}
      {preview && (
        <div className="border rounded-lg overflow-hidden">
          <div className="relative">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={preview.url} alt="Preview" className="w-full max-h-64 object-cover" />
            <button
              onClick={() => setPreview(null)}
              className="absolute top-2 right-2 bg-black/50 text-white rounded-full p-1"
            >
              <X className="h-4 w-4" />
            </button>
            <button
              onClick={startAnnotating}
              title="Annotate"
              className="absolute bottom-2 right-2 bg-black/60 text-white rounded-full p-2 hover:bg-black/80"
            >
              <PenLine className="h-4 w-4" />
            </button>
          </div>
          <div className="p-3 space-y-2">
            <Input
              placeholder="Add a caption (optional)"
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
            />
            <Button
              className="w-full"
              onClick={() => uploadMutation.mutate()}
              disabled={uploadMutation.isPending}
            >
              <Upload className="h-4 w-4 mr-2" />
              {uploadMutation.isPending ? "Uploading..." : "Upload Photo"}
            </Button>
          </div>
        </div>
      )}

      {/* Annotator */}
      {annotating && preview && (
        <div className="border rounded-lg p-3 space-y-2 bg-gray-50">
          <p className="text-xs text-gray-500">Draw on the photo to mark damage or notes — touch or mouse works.</p>
          <canvas
            ref={canvasRef}
            className="w-full rounded touch-none cursor-crosshair border"
            onPointerDown={(e) => { drawing.current = true; strokes.current.push([canvasPos(e)]); }}
            onPointerMove={(e) => {
              if (!drawing.current) return;
              const pt = canvasPos(e);
              strokes.current[strokes.current.length - 1].push(pt);
              const ctx = canvasRef.current?.getContext("2d");
              if (ctx) {
                const stroke = strokes.current[strokes.current.length - 1];
                const prev = stroke[stroke.length - 2];
                ctx.beginPath();
                ctx.moveTo(prev.x, prev.y);
                ctx.lineTo(pt.x, pt.y);
                ctx.stroke();
              }
            }}
            onPointerUp={() => { drawing.current = false; }}
            onPointerLeave={() => { drawing.current = false; }}
          />
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => { strokes.current = []; redraw(); }}>
              <RotateCcw className="h-4 w-4 mr-1" /> Clear
            </Button>
            <Button variant="outline" size="sm" onClick={() => setAnnotating(false)}>Cancel</Button>
            <Button size="sm" className="ml-auto" onClick={finishAnnotating}>
              <Check className="h-4 w-4 mr-1" /> Use annotated
            </Button>
          </div>
        </div>
      )}

      {/* Photo grid */}
      {photos.length === 0 && !preview ? (
        <p className="text-sm text-gray-500 text-center">No photos yet.</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {photos.map((photo) => (
            <div key={photo.id} className="relative group rounded-lg overflow-hidden bg-gray-100 aspect-square">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={photo.url}
                alt={photo.caption || "Job photo"}
                className="object-cover w-full h-full"
              />
              {photo.caption && (
                <p className="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-xs p-1 truncate">
                  {photo.caption}
                </p>
              )}
              <button
                onClick={() => deleteMutation.mutate(photo.id)}
                className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
