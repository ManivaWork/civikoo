"use client";

import { Plus, MapPin, AlertCircle } from "lucide-react";
import { useState, useRef, useEffect } from "react";

interface NewReportFabProps {
  onOpenReport: () => void;
  userLocation: { lat: number; lng: number } | null;
}

export function NewReportFab({ onOpenReport, userLocation }: NewReportFabProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const fabRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (isExpanded && fabRef.current && !fabRef.current.contains(event.target as Node)) {
        setIsExpanded(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isExpanded]);

  return (
    <div ref={fabRef} className="fixed bottom-6 right-6 z-30">
      {/* Expanded options */}
      <div
        className={`absolute bottom-16 right-0 flex flex-col-reverse gap-3 transition-all duration-200 ${
          isExpanded ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none translate-y-2"
        }`}
      >
        <button
          onClick={() => {
            onOpenReport();
            setIsExpanded(false);
          }}
          className="group flex items-center gap-3 bg-white dark:bg-zinc-800 rounded-xl px-4 py-3 shadow-lg border border-zinc-200 dark:border-zinc-700 hover:shadow-xl transition-shadow"
        >
          <div className="w-10 h-10 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center group-hover:scale-110 transition-transform">
            <MapPin className="w-5 h-5 text-amber-600 dark:text-amber-400" aria-hidden="true" />
          </div>
          <span className="font-medium text-zinc-900 dark:text-white">Reportar Problema</span>
        </button>

        <button
          onClick={() => {
            onOpenReport();
            setIsExpanded(false);
          }}
          className="group flex items-center gap-3 bg-white dark:bg-zinc-800 rounded-xl px-4 py-3 shadow-lg border border-zinc-200 dark:border-zinc-700 hover:shadow-xl transition-shadow"
        >
          <div className="w-10 h-10 rounded-lg bg-red-100 dark:bg-red-900/30 flex items-center justify-center group-hover:scale-110 transition-transform">
            <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400" aria-hidden="true" />
          </div>
          <span className="font-medium text-zinc-900 dark:text-white">Urgente / Perigo</span>
        </button>
      </div>

      {/* Main FAB */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="relative w-14 h-14 rounded-2xl bg-amber-500 hover:bg-amber-600 flex items-center justify-center shadow-xl transition-all duration-200 hover:shadow-2xl active:scale-95"
        aria-label={isExpanded ? "Fechar opções" : "Novo reporte"}
        aria-expanded={isExpanded}
      >
        <Plus
          className={`w-7 h-7 text-white transition-transform duration-200 ${isExpanded ? "rotate-45" : ""}`}
          aria-hidden="true"
        />
      </button>

      {/* Location status indicator */}
      {userLocation && (
        <div className="absolute -top-10 right-0 flex items-center gap-1.5 bg-green-500/90 text-white px-3 py-1.5 rounded-full text-xs font-medium shadow-lg animate-slide-down">
          <span className="relative flex h-1.5 w-1.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-green-500"></span>
          </span>
          GPS Ativo
        </div>
      )}
    </div>
  );
}