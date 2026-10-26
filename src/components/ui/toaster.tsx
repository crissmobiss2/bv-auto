"use client";

import * as React from "react";
import * as ToastPrimitive from "@radix-ui/react-toast";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

type ToastItem = { id: number; message: string; variant: "default" | "error" };
type Listener = (items: ToastItem[]) => void;

let items: ToastItem[] = [];
let nextId = 1;
const listeners = new Set<Listener>();
const emit = () => listeners.forEach((l) => l(items));

/** Non-blocking notice; replaces window.alert (UX-004/UX-006). */
export function toast(message: string, variant: ToastItem["variant"] = "default") {
  items = [...items.slice(-3), { id: nextId++, message, variant }];
  emit();
}
toast.error = (message: string) => toast(message, "error");

function dismiss(id: number) {
  items = items.filter((t) => t.id !== id);
  emit();
}

export function Toaster() {
  const [list, setList] = React.useState<ToastItem[]>(items);
  React.useEffect(() => {
    listeners.add(setList);
    return () => {
      listeners.delete(setList);
    };
  }, []);

  return (
    <ToastPrimitive.Provider duration={6000} swipeDirection="right">
      {list.map((t) => (
        <ToastPrimitive.Root
          key={t.id}
          type={t.variant === "error" ? "foreground" : "background"}
          onOpenChange={(open) => !open && dismiss(t.id)}
          className={cn(
            "flex items-start gap-3 rounded-md border p-4 pr-8 shadow-lg bg-white text-sm relative",
            t.variant === "error" && "border-red-300 bg-red-50 text-red-900",
          )}
        >
          <ToastPrimitive.Description className="whitespace-pre-line break-words">{t.message}</ToastPrimitive.Description>
          <ToastPrimitive.Close aria-label="Dismiss" className="absolute right-2 top-2 rounded p-1 opacity-70 hover:opacity-100 focus-visible:ring-2 focus-visible:ring-ring">
            <X className="h-4 w-4" aria-hidden />
          </ToastPrimitive.Close>
        </ToastPrimitive.Root>
      ))}
      <ToastPrimitive.Viewport className="fixed bottom-4 right-4 z-[100] flex w-[calc(100%-2rem)] max-w-sm flex-col gap-2 outline-none" />
    </ToastPrimitive.Provider>
  );
}
