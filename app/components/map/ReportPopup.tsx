"use client";

import { MapPin, User, ThumbsUp, ThumbsDown, Clock, ChevronRight } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { getCategoryConfig, getStatusConfig, type Report } from "./types";

interface ReportPopupProps {
  report: Report;
  onClose: () => void;
  onVerify: (reportId: string, type: "confirmacao" | "negacao") => void;
  onNavigate: (report: Report) => void;
  userLocation: { lat: number; lng: number } | null;
  isLoading?: boolean;
}

export function ReportPopup({
  report,
  onClose,
  onVerify,
  onNavigate,
  userLocation,
  isLoading = false,
}: ReportPopupProps) {
  const categoryConfig = getCategoryConfig(report.category);
  const statusConfig = getStatusConfig(report.status);

  // Calculate distance if user location available
  let distance: string | null = null;
  if (userLocation) {
    const R = 6371e3; // Earth radius in meters
    const φ1 = (userLocation.lat * Math.PI) / 180;
    const φ2 = (report.latitude * Math.PI) / 180;
    const Δφ = ((report.latitude - userLocation.lat) * Math.PI) / 180;
    const Δλ = ((report.longitude - userLocation.lng) * Math.PI) / 180;

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const d = R * c;

    distance = d < 1000 ? `${Math.round(d)} m` : `${(d / 1000).toFixed(1)} km`;
  }

  const timeAgo = formatDistanceToNow(new Date(report.created_at), { addSuffix: true, locale: ptBR });

  return (
    <div className="report-popup w-80 p-0 bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl overflow-hidden animate-pop-in">
      {/* Header with image */}
      <div className="relative h-40 overflow-hidden">
        <img
          src={report.photo_thumbnail_url || report.photo_url}
          alt={report.title}
          className="w-full h-full object-cover"
          loading="lazy"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
        <div className="absolute top-3 right-3 flex gap-2">
          <span className={`px-2 py-1 text-xs font-semibold rounded-full ${statusConfig.bgColor} ${statusConfig.color}`}>
            {statusConfig.label}
          </span>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full bg-white/90 dark:bg-zinc-800/90 flex items-center justify-center shadow-lg hover:bg-white dark:hover:bg-zinc-700 transition-colors"
            aria-label="Fechar"
          >
            <ChevronRight className="w-4 h-4 text-zinc-600 dark:text-zinc-400 rotate-90" aria-hidden="true" />
          </button>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Category & Title */}
        <div className="flex items-start gap-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${categoryConfig.bgColor} flex-shrink-0`}>
            <span className="text-2xl" aria-hidden="true">{categoryConfig.icon}</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className={`text-sm font-medium ${categoryConfig.color}`}>{categoryConfig.label}</p>
            <h3 className="text-lg font-bold text-zinc-900 dark:text-white truncate">{report.title}</h3>
          </div>
        </div>

        {/* Meta info */}
        <div className="flex items-center gap-4 text-sm text-zinc-600 dark:text-zinc-400">
          {distance && (
            <div className="flex items-center gap-1.5">
              <MapPin className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
              <span>{distance} de você</span>
            </div>
          )}
          <div className="flex items-center gap-1.5">
            <Clock className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
            <span>{timeAgo}</span>
          </div>
        </div>

        {/* Description */}
        {report.description && (
          <p className="text-zinc-700 dark:text-zinc-300 text-sm line-clamp-3">{report.description}</p>
        )}

        {/* Creator info */}
        <div className="flex items-center gap-2 pt-2 border-t border-zinc-100 dark:border-zinc-800">
          <div className="w-8 h-8 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center overflow-hidden">
            {report.creator_avatar ? (
              <img src={report.creator_avatar} alt="" className="w-full h-full object-cover" />
            ) : (
              <User className="w-4 h-4 text-zinc-500" aria-hidden="true" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-zinc-900 dark:text-white truncate">{report.creator_username}</p>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">Nível {report.creator_level || 1}</p>
          </div>
        </div>

        {/* Verification actions */}
        <div className="flex gap-2 pt-2">
          <button
            onClick={() => !isLoading && onVerify(report.id, "confirmacao")}
            disabled={isLoading}
            className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 rounded-xl font-medium text-sm hover:bg-green-100 dark:hover:bg-green-900/30 transition-colors disabled:opacity-50"
          >
            <ThumbsUp className="w-4 h-4" aria-hidden="true" />
            <span>Confirmar ({report.confirmations_count})</span>
          </button>
          <button
            onClick={() => !isLoading && onVerify(report.id, "negacao")}
            disabled={isLoading}
            className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 rounded-xl font-medium text-sm hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors disabled:opacity-50"
          >
            <ThumbsDown className="w-4 h-4" aria-hidden="true" />
            <span>Negar ({report.denials_count})</span>
          </button>
        </div>

        {/* Navigate button */}
        <button
          onClick={() => onNavigate(report)}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-amber-500 hover:bg-amber-600 text-white font-semibold rounded-xl transition-colors"
        >
          <MapPin className="w-4 h-4" aria-hidden="true" />
          <span>Ver Detalhes / Navegar</span>
        </button>
      </div>
    </div>
  );
}