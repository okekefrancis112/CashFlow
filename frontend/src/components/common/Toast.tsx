"use client";

import { createContext, useContext, useState, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle, AlertCircle, AlertTriangle, Info, X } from "lucide-react";

/* ================================================================
   TYPES
   ================================================================ */

type ToastType = "success" | "error" | "warning" | "info";
type ToastPosition = "top-right" | "top-left" | "bottom-right" | "bottom-left";

interface Toast {
  id: string;
  type: ToastType;
  message: string;
  description?: string;
}

interface ToastContextValue {
  toast: (type: ToastType, message: string, description?: string) => void;
  dismiss: (id: string) => void;
}

/* ================================================================
   CONTEXT
   ================================================================ */

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}

/* ================================================================
   CONFIG
   ================================================================ */

const ICONS: Record<ToastType, typeof CheckCircle> = {
  success: CheckCircle,
  error: AlertCircle,
  warning: AlertTriangle,
  info: Info,
};

const STYLES: Record<ToastType, { bg: string; border: string; icon: string; glow: string }> = {
  success: {
    bg: "bg-emerald-500/[0.08]",
    border: "border-emerald-500/20",
    icon: "text-emerald-400",
    glow: "shadow-[0_0_24px_rgba(16,185,129,0.15)]",
  },
  error: {
    bg: "bg-red-500/[0.08]",
    border: "border-red-500/20",
    icon: "text-red-400",
    glow: "shadow-[0_0_24px_rgba(239,68,68,0.15)]",
  },
  warning: {
    bg: "bg-amber-500/[0.08]",
    border: "border-amber-500/20",
    icon: "text-amber-400",
    glow: "shadow-[0_0_24px_rgba(245,158,11,0.15)]",
  },
  info: {
    bg: "bg-blue-500/[0.08]",
    border: "border-blue-500/20",
    icon: "text-blue-400",
    glow: "shadow-[0_0_24px_rgba(37,99,235,0.15)]",
  },
};

/* ================================================================
   SINGLE TOAST
   ================================================================ */

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: (id: string) => void }) {
  const style = STYLES[toast.type];
  const Icon = ICONS[toast.type];

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -10, scale: 0.95 }}
      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
      className={`
        relative flex items-start gap-3 w-[360px] p-4 rounded-xl
        backdrop-blur-xl border
        ${style.bg} ${style.border} ${style.glow}
        bg-[rgba(12,12,20,0.85)]
      `}
    >
      <Icon className={`w-5 h-5 mt-0.5 shrink-0 ${style.icon}`} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-white leading-snug">{toast.message}</p>
        {toast.description && (
          <p className="text-xs text-[#8b8fa3] mt-1 leading-relaxed">{toast.description}</p>
        )}
      </div>
      <button
        onClick={() => onDismiss(toast.id)}
        className="shrink-0 p-0.5 rounded-md text-[#565a6e] hover:text-white hover:bg-white/[0.06] transition-colors"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </motion.div>
  );
}

/* ================================================================
   PROVIDER
   ================================================================ */

const POSITION: ToastPosition = "top-right";
const AUTO_DISMISS_MS = 5000;

const POSITION_CLASSES: Record<ToastPosition, string> = {
  "top-right": "top-4 right-4",
  "top-left": "top-4 left-4",
  "bottom-right": "bottom-4 right-4",
  "bottom-left": "bottom-4 left-4",
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback((type: ToastType, message: string, description?: string) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setToasts((prev) => [...prev, { id, type, message, description }]);
  }, []);

  // Auto-dismiss
  useEffect(() => {
    if (toasts.length === 0) return;
    const latest = toasts[toasts.length - 1];
    const timer = setTimeout(() => dismiss(latest.id), AUTO_DISMISS_MS);
    return () => clearTimeout(timer);
  }, [toasts, dismiss]);

  return (
    <ToastContext.Provider value={{ toast, dismiss }}>
      {children}
      <div className={`fixed z-50 flex flex-col gap-2.5 ${POSITION_CLASSES[POSITION]}`}>
        <AnimatePresence mode="popLayout">
          {toasts.map((t) => (
            <ToastItem key={t.id} toast={t} onDismiss={dismiss} />
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}
