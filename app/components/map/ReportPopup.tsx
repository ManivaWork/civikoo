"use client";

import { useState, useCallback } from "react";
import { MapPin, User, CheckCircle, RefreshCw, Clock, ChevronRight, Image as ImageIcon, Tag, AlertCircle, MapPin as MapPinIcon, Flag, X } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { getCategoryConfig, getStatusConfig, type Report } from "./types";
import { confirmReport, flagReport } from "@/lib/supabase/client";
import { useToast } from "@/app/components/ui/Toast";

interface ReportPopupProps {
  report: Report;
  onClose: () => void;
  onVerify: (reportId: string, type: "continua" | "resolvido") => void; // NEW: updated types
  onNavigate: (report: Report) => void;
  userLocation: { lat: number; lng: number } | null;
  userAccuracy: number | null;
  currentUserId: string | null;
  isLoading?: boolean;
}

export function ReportPopup({
  report,
  onClose,
  onVerify,
  onNavigate,
  userLocation,
  userAccuracy,
  currentUserId,
  isLoading = false,
}: ReportPopupProps) {
  const categoryConfig = getCategoryConfig(report.category);
  const statusConfig = getStatusConfig(report.status);
  const { show: showToast } = useToast();
  const [confirming, setConfirming] = useState<"continua" | "resolvido" | null>(null);
  const [showFlagModal, setShowFlagModal] = useState(false);
  const [flagging, setFlagging] = useState(false);

  // Flag reasons
  const flagReasons = [
    { value: 'falso' as const, label: 'Falso / Não existe', icon: AlertCircle },
    { value: 'duplicado' as const, label: 'Duplicado de outro reporte', icon: Tag },
    { value: 'ofensivo' as const, label: 'Ofensivo / Inapropriado', icon: Flag },
    { value: 'outro' as const, label: 'Outro motivo', icon: AlertCircle },
  ];

  const handleFlag = useCallback(async (reason: 'falso' | 'duplicado' | 'ofensivo' | 'outro') => {
    if (!currentUserId || flagging) return;

    setFlagging(true);

    try {
      const result = await flagReport(report.id, currentUserId, reason);
      showToast(result.message, result.hidden ? "warning" : "success");
      setShowFlagModal(false);
      // If report was hidden, close popup
      if (result.hidden) {
        onClose();
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro ao denunciar";
      showToast(message, "error");
    } finally {
      setFlagging(false);
    }
  }, [report.id, currentUserId, flagging, showToast, onClose]);

  // Calculate distance if user location available
  let distance: string | null = null;
  let distanceMeters: number | null = null;
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

    distanceMeters = d;
    distance = d < 1000 ? `${Math.round(d)} m` : `${(d / 1000).toFixed(1)} km`;
  }

  const timeAgo = formatDistanceToNow(new Date(report.created_at), { addSuffix: true, locale: ptBR });

  // Use new image_url field, fallback to old photo fields
  const imageUrl = report.image_url || report.photo_url || report.photo_thumbnail_url;

  // Determine if buttons should be disabled
  const isAuthor = currentUserId === report.user_id; // NEW: user_id instead of creator_id
  const isResolved = report.status === "resolvido";
  const userConfirmedContinua = report.user_has_confirmed_continua;
  const userConfirmedResolvido = report.user_has_confirmed_resolvido;

  const handleConfirm = useCallback(async (type: "continua" | "resolvido") => {
    if (!userLocation || confirming || isLoading) return;

    setConfirming(type);

    try {
      // Call the new confirmReport function with GPS accuracy
      // NOTA: userAccuracy vem do cliente (navigator.geolocation) e pode ser falsificado.
      // O servidor valida accuracy < 100m e distância < 50m, mas não garante autenticidade.
      // Ver comentário em lib/supabase/client.ts para limitações e mitigações futuras.
      const result = await confirmReport(
        report.id,
        currentUserId!,
        type,
        userLocation.lat,
        userLocation.lng,
        userAccuracy ?? undefined
      );

      // Show success toast with XP earned
      showToast(result.message, "success");

      // Refresh the report data
      onVerify(report.id, type);

    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro ao confirmar";
      showToast(message, "error");
    } finally {
      setConfirming(null);
    }
  }, [userLocation, userAccuracy, confirming, isLoading, report.id, currentUserId, showToast, onVerify]);

  const isContinuaDisabled = confirming !== null || isLoading || isAuthor || isResolved || userConfirmedContinua;
  const isResolvidoDisabled = confirming !== null || isLoading || isResolved || userConfirmedResolvido;

  return (
    <>
      <div className="report-popup w-80 p-0 bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl overflow-hidden animate-pop-in">
      {/* Header with image */}
      <div className="relative h-40 overflow-hidden">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={report.title}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
            <ImageIcon className="w-12 h-12 text-zinc-400" />
          </div>
        )}
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
            <div className="flex items-center gap-2 mb-1">
              <p className={`text-sm font-medium ${categoryConfig.color}`}>{categoryConfig.label}</p>
              {report.category && (
                <Tag className="w-3 h-3 text-zinc-400" aria-hidden="true" />
              )}
            </div>
            <h3 className="text-lg font-bold text-zinc-900 dark:text-white truncate">{report.title}</h3>
          </div>
        </div>

        {/* Meta info */}
        <div className="flex items-center gap-4 text-sm text-zinc-600 dark:text-zinc-400 flex-wrap">
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

        {/* Community Validation Actions */}
        <div className="space-y-2 pt-2 border-t border-zinc-100 dark:border-zinc-800">
          {/* "Ainda está lá" button */}
          <button
            onClick={() => handleConfirm("continua")}
            disabled={isContinuaDisabled}
            className={`w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl font-medium text-sm transition-colors ${
              isContinuaDisabled
                ? "opacity-50 cursor-not-allowed bg-zinc-100 dark:bg-zinc-800 text-zinc-400"
                : "bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/30"
            }`}
            aria-label={isContinuaDisabled ? undefined : "Confirmar que o problema ainda existe"}
          >
            <CheckCircle className="w-4 h-4" aria-hidden="true" />
            <span>
              Ainda está lá
              {report.confirmations_continua !== undefined && (
                <span className="ml-1 px-2 py-0.5 text-xs bg-blue-100 dark:bg-blue-900/30 rounded-full">
                  {report.confirmations_continua}
                </span>
              )}
            </span>
            {confirming === "continua" && (
              <RefreshCw className="w-4 h-4 animate-spin" aria-hidden="true" />
            )}
          </button>

          {/* "Foi resolvido" button */}
          <button
            onClick={() => handleConfirm("resolvido")}
            disabled={isResolvidoDisabled}
            className={`w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl font-medium text-sm transition-colors ${
              isResolvidoDisabled
                ? "opacity-50 cursor-not-allowed bg-zinc-100 dark:bg-zinc-800 text-zinc-400"
                : "bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-900/30"
            }`}
            aria-label={isResolvidoDisabled ? undefined : "Confirmar que o problema foi resolvido"}
          >
            <MapPinIcon className="w-4 h-4" aria-hidden="true" />
            <span>
              Foi resolvido
              {report.confirmations_resolvido !== undefined && (
                <span className="ml-1 px-2 py-0.5 text-xs bg-green-100 dark:bg-green-900/30 rounded-full">
                  {report.confirmations_resolvido}/2
                </span>
              )}
            </span>
            {confirming === "resolvido" && (
              <RefreshCw className="w-4 h-4 animate-spin" aria-hidden="true" />
            )}
          </button>

          {/* Disabled reason hints */}
          {(isContinuaDisabled || isResolvidoDisabled) && (
            <div className="text-xs text-zinc-500 dark:text-zinc-400 space-y-1">
              {isAuthor && <p>• Você não pode confirmar seu próprio reporte</p>}
              {isResolved && <p>• Este reporte já foi resolvido</p>}
              {userConfirmedContinua && !isAuthor && !isResolved && <p>• Você já confirmou que o problema continua</p>}
              {userConfirmedResolvido && !isResolved && <p>• Você já confirmou que o problema foi resolvido</p>}
              {!userLocation && <p>• Ative a localização para confirmar</p>}
            </div>
          )}
        </div>

        {/* Denunciar button */}
        <button
          onClick={() => setShowFlagModal(true)}
          disabled={isLoading || !currentUserId}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 rounded-xl font-medium text-sm hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors disabled:opacity-50"
        >
          <Flag className="w-4 h-4" aria-hidden="true" />
          <span>Denunciar este reporte</span>
        </button>

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

    {/* Flag Modal */}
    {showFlagModal && (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => setShowFlagModal(false)}>
        <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-xl w-full max-w-md p-6 animate-pop-in" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-zinc-900 dark:text-white">Denunciar reporte</h3>
            <button onClick={() => setShowFlagModal(false)} className="p-1 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">
              <X className="w-5 h-5 text-zinc-500" />
            </button>
          </div>
          <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-4">
            Por que você quer denunciar este reporte? Isso ajuda a manter a qualidade da comunidade.
          </p>
          <div className="space-y-2">
            {flagReasons.map((reason) => (
              <button
                key={reason.value}
                onClick={() => handleFlag(reason.value)}
                disabled={flagging}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-zinc-200 dark:border-zinc-700 text-left hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors disabled:opacity-50"
              >
                <reason.icon className="w-5 h-5 text-red-500 flex-shrink-0" aria-hidden="true" />
                <span className="text-zinc-900 dark:text-white">{reason.label}</span>
                {flagging && <RefreshCw className="w-4 h-4 animate-spin ml-auto" />}
              </button>
            ))}
          </div>
          <button
            onClick={() => setShowFlagModal(false)}
            disabled={flagging}
            className="mt-4 w-full py-2 text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors"
          >
            Cancelar
          </button>
        </div>
      </div>
    )}
    </>
  );
}