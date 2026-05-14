"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@radix-ui/react-switch";
import { Label } from "@/components/ui/label";
import { formatDateTime } from "@/lib/utils";

type Note = {
  id: string;
  content: string;
  isInternal: boolean;
  createdAt: string;
  author: { id: string; name: string };
};

export function NotesTab({ jobId, notes }: { jobId: string; notes: Note[] }) {
  const queryClient = useQueryClient();
  const [content, setContent] = useState("");
  const [isInternal, setIsInternal] = useState(false);

  const addMutation = useMutation({
    mutationFn: () =>
      axios.post(`/api/jobs/${jobId}/notes`, { content, isInternal }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["job", jobId] });
      setContent("");
    },
  });

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-3">
          <Textarea
            rows={3}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Add a note..."
          />
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="internal"
                checked={isInternal}
                onChange={(e) => setIsInternal(e.target.checked)}
                className="h-4 w-4"
              />
              <Label htmlFor="internal" className="text-sm cursor-pointer">
                Internal note only
              </Label>
            </div>
            <Button
              size="sm"
              onClick={() => addMutation.mutate()}
              disabled={!content.trim() || addMutation.isPending}
            >
              {addMutation.isPending ? "Saving..." : "Add Note"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {notes.length === 0 ? (
        <p className="text-sm text-gray-500 text-center py-4">No notes yet.</p>
      ) : (
        <div className="space-y-3">
          {notes.map((note) => (
            <div
              key={note.id}
              className={`p-4 rounded-lg border text-sm ${
                note.isInternal
                  ? "bg-yellow-50 border-yellow-200"
                  : "bg-white border-gray-200"
              }`}
            >
              {note.isInternal && (
                <span className="text-xs font-medium text-yellow-700 mb-1 block">Internal</span>
              )}
              <p className="text-gray-800 whitespace-pre-wrap">{note.content}</p>
              <p className="text-xs text-gray-400 mt-2">
                {note.author.name} · {formatDateTime(note.createdAt)}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
