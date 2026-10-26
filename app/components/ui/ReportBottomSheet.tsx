"use client";

import { useState, useCallback, Suspense } from "react";
import dynamic from "next/dynamic";
import { X, Flag } from "lucide-react";
import { useToast } from "./Toast";
import { useSession } from "@/lib/auth";
import { findNearbyReports } from "@/lib/supabase/client";

const ReportStepGPS = dynamic(() => import("./ReportStepGPS").then((mod) => mod.ReportStepGPS), {
  ssr: false,
  loading: () => (
    <div className="flex-1 flex items-center justify-center">
      <div className="w-10 h-10 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
    </div>
  ),
});

const ReportStepPhoto = dynamic(() => import("./ReportStepPhoto").then((mod) => mod.ReportStepPhoto), {
  ssr: false,
  loading: () => (
    <div className="flex-1 flex items-center justify-center">
      <div className="w-10 h-10 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
    </div>
  ),
});

const ReportStepCategory = dynamic(() => import("./ReportStepCategory").then((mod) => mod.ReportStepCategory), {
  ssr: false,
  loading: () => (
    <div className="flex-1 flex items-center justify-center">
      <div className="w-10 h-10 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
    </div>
  ),
});

const ReportStepDescription = dynamic(() => import("./ReportStepDescription").then((mod) => mod.ReportStepDescription), {
  ssr: false,
  loading: () => (
    <div className="flex-1 flex items-center justify-center">
      <div className="w-10 h-10 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
    </div>
  ),
});

const ReportStepSubmit = dynamic(() => import("./ReportStepSubmit").then((mod) => mod.ReportStepSubmit), {
  ssr: false,
  loading: () => (
    <div className="flex-1 flex items-center justify-center">
      <div className="w-10 h-10 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
    </div>
  ),
});

type Step = "gps" | "photo" | "category" | "description" | "submit";

interface ReportData {
  position?: { lat: number; lng: number };
  file?: File;
  previewUrl?: string;
  compressedBlob?: Blob;
  category?: string;
  description?: string;
}

interface NearbyReport {
  id: string;
  title: string;
  category: string;
  distance_m: number;
}

export function ReportBottomSheet({
  isOpen,
  onClose,
  initialPosition
}: {
  isOpen: boolean;
  onClose: () => void;
  initialPosition?: { lat: number; lng: number } | null;
}) {
  const [currentStep, setCurrentStep] = useState<Step>("gps");
  const [reportData, setReportData] = useState<ReportData>({});
  const [nearbyReports, setNearbyReports] = useState<NearbyReport[]>([]);
  const [showNearbyModal, setShowNearbyModal] = useState(false);
  const { show } = useToast();
  const { user } = useSession();

  const stepOrder: Step[] = ["gps", "photo", "category", "description", "submit"];
  const currentIndex = stepOrder.indexOf(currentStep);

  const goToStep = useCallback((step: Step) => {
    setCurrentStep(step);
  }, []);

  const goNext = useCallback(() => {
    if (currentIndex < stepOrder.length - 1) {
      setCurrentStep(stepOrder[currentIndex + 1]);
    }
  }, [currentIndex]);

  const goBack = useCallback(() => {
    if (currentIndex > 0) {
      setCurrentStep(stepOrder[currentIndex - 1]);
    } else {
      onClose();
    }
  }, [currentIndex, onClose]);

  const handleGPSConfirm = useCallback(async (position: { lat: number; lng: number }) => {
    setReportData(prev => ({ ...prev, position }));

    if (reportData.category) {
      try {
        const nearby = await findNearbyReports(
          position.lat,
          position.lng,
          reportData.category,
          30
        );
        if (nearby.length > 0) {
          setNearbyReports(nearby);
          setShowNearbyModal(true);
          return;
        }
      } catch (err) {
        console.warn("Failed to check nearby reports:", err);
      }
    }
    goNext();
  }, [goNext, reportData.category]);

  const handlePhotoConfirm = useCallback((file: File, previewUrl: string, compressedBlob: Blob) => {
    setReportData(prev => ({ ...prev, file, previewUrl, compressedBlob }));
    goNext();
  }, [goNext]);

  const handleCategoryConfirm = useCallback((category: string) => {
    setReportData(prev => ({ ...prev, category }));
    goNext();
  }, [goNext]);

  const handleDescriptionConfirm = useCallback((description: string) => {
    setReportData(prev => ({ ...prev, description }));
    goNext();
  }, [goNext]);

  const handleSubmitComplete = useCallback(() => {
    if (reportData.previewUrl) {
      URL.revokeObjectURL(reportData.previewUrl);
    }
    setReportData({});
    setCurrentStep("gps");
    onClose();
  }, [onClose, reportData.previewUrl]);

  const handleCancel = useCallback(() => {
    if (reportData.previewUrl) {
      URL.revokeObjectURL(reportData.previewUrl);
    }
    setReportData({});
    setCurrentStep("gps");
    onClose();
  }, [reportData.previewUrl, onClose]);

  const handleConfirmExisting = useCallback((reportId: string) => {
    // Close modals and navigate to the existing report
    setShowNearbyModal(false);
    setNearbyReports([]);
    onClose();
    // The parent component should handle navigating to the existing report
    // We could emit an event or call a callback, but for now just close
    show(`Abrindo reporte existente para confirmação...`, "info");
  }, [onClose, show]);

  if (!isOpen) return null;

  // Check authentication for submit step - render inline instead of early return
  const showAuthError = currentStep === "submit" && !user;

  if (showAuthError) {
    return (
      <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/50" onClick={handleCancel}>
        <div className="bg-white dark:bg-zinc-900 rounded-2xl p-6 max-w-sm mx-4 shadow-xl animate-slide-up">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
              <span className="text-red-600 dark:text-red-400 text-xl">⚠️</span>
            </div>
            <h3 className="text-lg font-semibold text-zinc-900 dark:text-white">Login necessário</h3>
          </div>
          <p className="text-zinc-600 dark:text-zinc-400 mb-6">Você precisa estar logado para enviar um reporte.</p>
          <div className="flex gap-3">
            <button onClick={goBack} className="flex-1 py-2.5 bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 rounded-xl font-medium hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors">
              Voltar
            </button>
            <button onClick={() => { handleCancel(); window.location.href = '/login?redirect=/registrar'; }} className="flex-1 py-2.5 bg-amber-500 text-white rounded-xl font-medium hover:bg-amber-600 transition-colors">
              Fazer login
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="absolute inset-0 z-50 flex items-end animate-slide-up">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={handleCancel}
        aria-hidden="true"
      />

      {/* Bottom Sheet */}
      <div className="relative w-full max-h-[90vh] bg-white dark:bg-zinc-900 rounded-t-3xl shadow-xl flex flex-col">
        {/* Handle bar */}
        <div className="flex items-center justify-between p-4 border-b border-zinc-200 dark:border-zinc-700">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-amber-500 flex items-center justify-center">
              <span className="text-white font-bold text-sm">📍</span>
            </div>
            <h3 className="text-lg font-semibold text-zinc-900 dark:text-white">Novo Reporte</h3>
          </div>

          {/* Step indicator */}
          <div className="flex items-center gap-1">
            {stepOrder.map((step, i) => (
              <div
                key={step}
                className={`w-2 h-2 rounded-full transition-colors ${
                      i <= currentIndex ? "bg-amber-500" : "bg-zinc-300 dark:bg-zinc-600"
                    }`}
                  />
                ))}
              </div>
            </div>

            {/* Step Content */}
            <div className="flex-1 overflow-hidden min-h-0">
              {currentStep === "gps" && (
                <Suspense fallback={<div className="flex-1 flex items-center justify-center"><div className="w-10 h-10 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" /></div>}>
                  <ReportStepGPS
                    initialPosition={initialPosition || reportData.position || null}
                    onConfirm={handleGPSConfirm}
                    onCancel={handleCancel}
                  />
                </Suspense>
              )}
          {currentStep === "photo" && (
            <Suspense fallback={<div className="flex-1 flex items-center justify-center"><div className="w-10 h-10 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" /></div>}>
              <ReportStepPhoto
                onConfirm={handlePhotoConfirm}
                onCancel={handleCancel}
                onBack={goBack}
              />
            </Suspense>
          )}
          {currentStep === "category" && (
            <Suspense fallback={<div className="flex-1 flex items-center justify-center"><div className="w-10 h-10 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" /></div>}>
              <ReportStepCategory
                onConfirm={handleCategoryConfirm}
                onBack={goBack}
                initialCategory={reportData.category as any}
              />
            </Suspense>
          )}
          {currentStep === "description" && (
            <Suspense fallback={<div className="flex-1 flex items-center justify-center"><div className="w-10 h-10 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" /></div>}>
              <ReportStepDescription
                onConfirm={handleDescriptionConfirm}
                onBack={goBack}
                initialDescription={reportData.description}
              />
            </Suspense>
          )}
          {currentStep === "submit" && user && (
            <Suspense fallback={<div className="flex-1 flex items-center justify-center"><div className="w-10 h-10 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" /></div>}>
              <ReportStepSubmit
                reportData={reportData as any}
                onSubmit={handleSubmitComplete}
                onCancel={handleCancel}
                onBack={goBack}
              />
            </Suspense>
          )}
        </div>
      </div>

      {/* Nearby Reports Modal */}
      {showNearbyModal && nearbyReports.length > 0 && (
        <div className="absolute inset-0 z-60 flex items-center justify-center p-4 bg-black/50 animate-fade-in" onClick={() => setShowNearbyModal(false)}>
          <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-xl w-full max-w-md p-6 animate-slide-up" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-zinc-900 dark:text-white">Reporte similar encontrado</h3>
              <button onClick={() => setShowNearbyModal(false)} className="p-1 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">
                <X className="w-5 h-5 text-zinc-500" />
              </button>
            </div>
            <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-4">
              Já existe um reporte parecido a menos de 30m nesta categoria. Quer confirmar o existente em vez de criar outro?
            </p>
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {nearbyReports.map((r) => (
                <button
                  key={r.id}
                  onClick={() => handleConfirmExisting(r.id)}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-zinc-200 dark:border-zinc-700 text-left hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
                >
                  <div className="w-10 h-10 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center flex-shrink-0">
                    <Flag className="w-5 h-5 text-amber-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-zinc-900 dark:text-white truncate">{r.title}</p>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">{r.category} • {Math.round(r.distance_m)}m de distância</p>
                  </div>
                </button>
              ))}
            </div>
            <button
              onClick={() => {
                setShowNearbyModal(false);
                setNearbyReports([]);
              }}
              className="mt-4 w-full py-2 text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors"
            >
              Continuar criando novo reporte
            </button>
          </div>
        </div>
      )}
    </div>
  );
}