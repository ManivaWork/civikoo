"use client";

import { useState, useEffect, useCallback } from "react";
import { X, CheckCircle, AlertCircle, AlertTriangle } from "lucide-react";

type ToastType = "success" | "error" | "warning" | "info";

interface Toast {
  id: number;
  message: string;
  type: ToastType;
}

let toastId = 0;
const listeners: Array<(toasts: Toast[]) => void> = [];
let toasts: Toast[] = [];

function notify() {
  listeners.forEach((l) => l([...toasts]));
}

export function useToast() {
  const [localToasts, setLocalToasts] = useState<Toast[]>(toasts);

  useEffect(() => {
    listeners.push(setLocalToasts);
    return () => {
      const idx = listeners.indexOf(setLocalToasts);
      if (idx > -1) listeners.splice(idx, 1);
    };
  }, []);

  const show = useCallback((message: string, type: ToastType = "info", duration = 4000) => {
    const id = ++toastId;
    toasts = [...toasts, { id, message, type }];
    notify();
    if (duration > 0) setTimeout(() => dismiss(id), duration);
  }, []);

  const dismiss = useCallback((id: number) => {
    toasts = toasts.filter((t) => t.id !== id);
    notify();
  }, []);

  return { toasts: localToasts, show, dismiss };
}

export function ToastContainer() {
  const { toasts, dismiss } = useToast();

  if (toasts.length === 0) return null;

  return (
    <div className="absolute bottom-4 left-4 right-4 md:left-auto md:right-4 md:bottom-4 md:w-80 z-50 flex flex-col-reverse gap-2 pointer-events-none">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg border animate-slide-up ${
            t.type === "success"
              ? "bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-200 border-green-200 dark:border-green-800"
              : t.type === "error"
              ? "bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-200 border-red-200 dark:border-red-800"
              : t.type === "warning"
              ? "bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-200 border-amber-200 dark:border-amber-800"
              : "bg-blue-50 dark:bg-blue-900/20 text-blue-800 dark:text-blue-200 border-blue-200 dark:border-blue-800"
          }`}
          role="alert"
        >
          {t.type === "success" && <CheckCircle className="w-5 h-5 flex-shrink-0" />}
          {t.type === "error" && <AlertCircle className="w-5 h-5 flex-shrink-0" />}
          {t.type === "warning" && <AlertTriangle className="w-5 h-5 flex-shrink-0" />}
          {t.type === "info" && <AlertCircle className="w-5 h-5 flex-shrink-0" />}
          <p className="text-sm font-medium flex-1">{t.message}</p>
          <button
            onClick={() => dismiss(t.id)}
            className="flex-shrink-0 p-1 rounded hover:bg-black/10 dark:hover:bg-white/10"
            aria-label="Fechar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ))}
    </div>
  );
}