"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, X } from "lucide-react";

const STORAGE_KEY = "civikoo_first_report_warning_dismissed";

export function FirstReportWarning({ onDismiss }: { onDismiss: () => void }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const dismissed = localStorage.getItem(STORAGE_KEY);
    if (!dismissed) setVisible(true);
  }, []);

  const handleDismiss = () => {
    localStorage.setItem(STORAGE_KEY, "true");
    setVisible(false);
    onDismiss();
  };

  if (!visible) return null;

  return (
    <div
      className="absolute bottom-24 left-4 right-4 md:left-auto md:right-4 md:bottom-24 md:w-80 z-40 animate-slide-up"
      role="alert"
    >
      <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4 shadow-lg flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
        <div className="flex-1">
          <p className="text-sm text-amber-800 dark:text-amber-200">
            <strong>Segurança primeiro:</strong> não use o app dirigindo e evite fotografar rostos e placas.
          </p>
        </div>
        <button
          onClick={handleDismiss}
          className="flex-shrink-0 p-1 rounded hover:bg-amber-200 dark:hover:bg-amber-800 text-amber-600 dark:text-amber-400"
          aria-label="Dispensar aviso"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}