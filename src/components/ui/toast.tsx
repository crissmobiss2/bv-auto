"use client";

import * as React from "react";
import * as ToastPrimitives from "@radix-ui/react-toast";
import { X, CheckCircle2, AlertCircle, Info, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

const ToastProvider = ToastPrimitives.Provider;

const ToastViewport = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Viewport>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Viewport>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Viewport
    ref={ref}
    className={cn(
      "fixed bottom-0 right-0 z-[100] flex max-h-screen w-full flex-col-reverse gap-2 p-4 sm:bottom-4 sm:right-4 sm:max-w-[380px]",
      className
    )}
    {...props}
  />
));
ToastViewport.displayName = ToastPrimitives.Viewport.displayName;

const toastVariants = {
  default: "bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100",
  success: "bg-white dark:bg-gray-900 border border-emerald-200 dark:border-emerald-800/60 text-gray-900 dark:text-gray-100",
  error:   "bg-white dark:bg-gray-900 border border-red-200 dark:border-red-800/60 text-gray-900 dark:text-gray-100",
  warning: "bg-white dark:bg-gray-900 border border-amber-200 dark:border-amber-800/60 text-gray-900 dark:text-gray-100",
  info:    "bg-white dark:bg-gray-900 border border-blue-200 dark:border-blue-800/60 text-gray-900 dark:text-gray-100",
};

const toastIcons = {
  default: null,
  success: <CheckCircle2 className="h-4 w-4 text-emerald-500 flex-shrink-0 mt-0.5" />,
  error:   <AlertCircle className="h-4 w-4 text-red-500 flex-shrink-0 mt-0.5" />,
  warning: <AlertTriangle className="h-4 w-4 text-amber-500 flex-shrink-0 mt-0.5" />,
  info:    <Info className="h-4 w-4 text-blue-500 flex-shrink-0 mt-0.5" />,
};

const toastAccents = {
  default: "",
  success: "before:bg-emerald-500",
  error:   "before:bg-red-500",
  warning: "before:bg-amber-500",
  info:    "before:bg-blue-500",
};

type ToastVariant = keyof typeof toastVariants;

interface ToastProps extends React.ComponentPropsWithoutRef<typeof ToastPrimitives.Root> {
  variant?: ToastVariant;
}

const Toast = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Root>,
  ToastProps
>(({ className, variant = "default", ...props }, ref) => (
  <ToastPrimitives.Root
    ref={ref}
    className={cn(
      "relative group pointer-events-auto flex w-full items-start gap-3 overflow-hidden rounded-xl p-4 pr-8 shadow-lg shadow-black/5 ring-0",
      "data-[state=open]:animate-in data-[state=closed]:animate-out",
      "data-[swipe=end]:animate-out data-[state=closed]:fade-out-80",
      "data-[state=closed]:slide-out-to-right-full data-[state=open]:slide-in-from-bottom-full",
      "data-[swipe=move]:translate-x-[var(--radix-toast-swipe-move-x)]",
      "data-[swipe=cancel]:translate-x-0 data-[swipe=cancel]:transition-[transform_200ms_ease-out]",
      `before:absolute before:inset-y-0 before:left-0 before:w-1 before:rounded-l-xl ${toastAccents[variant]}`,
      toastVariants[variant],
      className
    )}
    {...props}
  >
    {toastIcons[variant]}
    <div className="flex-1 min-w-0">{props.children}</div>
  </ToastPrimitives.Root>
));
Toast.displayName = ToastPrimitives.Root.displayName;

const ToastAction = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Action>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Action>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Action
    ref={ref}
    className={cn(
      "inline-flex h-7 shrink-0 items-center justify-center rounded-md border border-gray-200 dark:border-gray-700 bg-transparent px-3 text-xs font-medium transition-all hover:bg-gray-100 dark:hover:bg-gray-800 focus:outline-none focus:ring-1 focus:ring-gray-400 disabled:pointer-events-none disabled:opacity-50",
      className
    )}
    {...props}
  />
));
ToastAction.displayName = ToastPrimitives.Action.displayName;

const ToastClose = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Close>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Close>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Close
    ref={ref}
    className={cn(
      "absolute right-2 top-2 rounded-md p-1 text-gray-400 opacity-60 transition-all hover:opacity-100 hover:text-gray-700 dark:hover:text-gray-200 focus:outline-none focus:ring-1 focus:ring-gray-400",
      className
    )}
    toast-close=""
    {...props}
  >
    <X className="h-3.5 w-3.5" />
  </ToastPrimitives.Close>
));
ToastClose.displayName = ToastPrimitives.Close.displayName;

const ToastTitle = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Title>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Title>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Title
    ref={ref}
    className={cn("text-sm font-semibold leading-tight", className)}
    {...props}
  />
));
ToastTitle.displayName = ToastPrimitives.Title.displayName;

const ToastDescription = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Description>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Description>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Description
    ref={ref}
    className={cn("text-xs text-gray-500 dark:text-gray-400 mt-0.5 leading-snug", className)}
    {...props}
  />
));
ToastDescription.displayName = ToastPrimitives.Description.displayName;

function Toaster() {
  const { toasts } = useToastState();
  return (
    <ToastProvider>
      {toasts.map(({ id, title, description, action, variant, ...props }) => (
        <Toast key={id} variant={variant} {...props}>
          <div className="grid gap-1">
            {title && <ToastTitle>{title}</ToastTitle>}
            {description && <ToastDescription>{description}</ToastDescription>}
          </div>
          {action}
          <ToastClose />
        </Toast>
      ))}
      <ToastViewport />
    </ToastProvider>
  );
}

// ─── Toast State (lightweight, no context needed) ────────────────────────────

export type ToastInput = {
  id?: string;
  title?: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactElement;
  variant?: ToastVariant;
  duration?: number;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
};

type ToastState = Required<Pick<ToastInput, "id" | "open">> & ToastInput;

const listeners: Array<(toasts: ToastState[]) => void> = [];
let memoryState: ToastState[] = [];

function dispatch(toasts: ToastState[]) {
  memoryState = toasts;
  listeners.forEach(l => l(toasts));
}

let count = 0;

export function toast(input: ToastInput) {
  const id = input.id ?? String(++count);
  const duration = input.duration ?? 4000;

  const newToast: ToastState = {
    ...input,
    id,
    open: true,
    onOpenChange: (open) => {
      if (!open) {
        dispatch(memoryState.map(t => t.id === id ? { ...t, open: false } : t));
        setTimeout(() => dispatch(memoryState.filter(t => t.id !== id)), 300);
      }
    },
  };

  dispatch([...memoryState.filter(t => t.id !== id), newToast]);

  if (duration > 0) {
    setTimeout(() => {
      dispatch(memoryState.map(t => t.id === id ? { ...t, open: false } : t));
      setTimeout(() => dispatch(memoryState.filter(t => t.id !== id)), 300);
    }, duration);
  }

  return id;
}

toast.success = (title: string, description?: string) =>
  toast({ title, description, variant: "success" });
toast.error = (title: string, description?: string) =>
  toast({ title, description, variant: "error" });
toast.warning = (title: string, description?: string) =>
  toast({ title, description, variant: "warning" });
toast.info = (title: string, description?: string) =>
  toast({ title, description, variant: "info" });

function useToastState() {
  const [toasts, setToasts] = React.useState<ToastState[]>(memoryState);
  React.useEffect(() => {
    listeners.push(setToasts);
    return () => {
      const idx = listeners.indexOf(setToasts);
      if (idx > -1) listeners.splice(idx, 1);
    };
  }, []);
  return { toasts };
}

export {
  Toast,
  ToastAction,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
  Toaster,
};
