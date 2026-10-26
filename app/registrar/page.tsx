"use client";

import { useState, useCallback, Suspense } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { Map, X, ChevronLeft, ChevronRight, Flag } from "lucide-react";
import { useSession } from "@/lib/auth";
import { findNearbyReports } from "@/lib/supabase/client";
import { BottomNavigation } from "@/app/components/ui/BottomNavigation";
import { useToast } from "@/app/components/ui/Toast";

const ReportStepGPS = dynamic(() => import("@/app/components/ui/ReportStepGPS").then((mod) => mod.ReportStepGPS), {
  ssr: false,
  loading: () => (
    <div className="flex-1 flex items-center justify-center">
      <div className="w-10 h-10 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
    </div>
  ),
});

const ReportStepPhoto = dynamic(() => import("@/app/components/ui/ReportStepPhoto").then((mod) => mod.ReportStepPhoto), {
  ssr: false,
  loading: () => (
    <div className="flex-1 flex items-center justify-center">
      <div className="w-10 h-10 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
    </div>
  ),
});

const ReportStepCategory = dynamic(() => import("@/app/components/ui/ReportStepCategory").then((mod) => mod.ReportStepCategory), {
  ssr: false,
  loading: () => (
    <div className="flex-1 flex items-center justify-center">
      <div className="w-10 h-10 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
    </div>
  ),
});

const ReportStepDescription = dynamic(() => import("@/app/components/ui/ReportStepDescription").then((mod) => mod.ReportStepDescription), {
  ssr: false,
  loading: () => (
    <div className="flex-1 flex items-center justify-center">
      <div className="w-10 h-10 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
    </div>
  ),
});

const ReportStepSubmit = dynamic(() => import("@/app/components/ui/ReportStepSubmit").then((mod) => mod.ReportStepSubmit), {
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

export default function RegistrarPage() {
  const { user, profile, loading: authLoading } = useSession();
  const { show } = useToast();
  const [currentStep, setCurrentStep] = useState<Step>("gps");
  const [reportData, setReportData] = useState<ReportData>({});
  const [nearbyReports, setNearbyReports] = useState<NearbyReport[]>([]);
  const [showNearbyModal, setShowNearbyModal] = useState(false);

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
    }
  }, [currentIndex]);

  const handleGPSConfirm = useCallback(async (position: { lat: number; lng: number }) => {
    setReportData(prev => ({ ...prev, position }));

    // Check for nearby reports if category already selected
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
    // Clean up preview URL
    if (reportData.previewUrl) {
      URL.revokeObjectURL(reportData.previewUrl);
    }
    setReportData({});
    setCurrentStep("gps");
    show("Reporte enviado com sucesso! 🎉", "success");
  }, [reportData.previewUrl, show]);

  const handleCancel = useCallback(() => {
    // Clean up preview URL
    if (reportData.previewUrl) {
      URL.revokeObjectURL(reportData.previewUrl);
    }
    setReportData({});
    setCurrentStep("gps");
  }, [reportData.previewUrl]);

  const handleConfirmExisting = useCallback((reportId: string) => {
    setShowNearbyModal(false);
    setNearbyReports([]);
    show(`Abrindo reporte existente para confirmação...`, "info");
    // In a real app, navigate to the report detail page
  }, [show]);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user || !profile) {
    return (
      <div className="min-h-screen bg-zinc-950 flex flex-col">
        <header className="fixed top-0 left-0 right-0 z-40 bg-zinc-950/95 backdrop-blur-xl border-b border-zinc-800 navbar-safe">
          <div className="max-w-screen-xl mx-auto px-4 h-16 flex items-center justify-between">
            <Link href="/" className="flex items-center gap-3" aria-label="Civikoo - Início">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center">
                <Map className="w-5 h-5 text-white" aria-hidden="true" />
              </div>
              <div className="hidden sm:block">
                <h1 className="text-lg font-bold text-white">Civikoo</h1>
                <p className="text-xs text-zinc-500">Registrar</p>
              </div>
            </Link>
          </div>
        </header>
        <main className="flex-1 pt-20 pb-24 px-4 max-w-screen-xl mx-auto w-full">
          <div className="text-center py-16">
            <div className="relative inline-flex items-center justify-center mb-6">
              <div className="absolute inset-0 bg-amber-500/10 rounded-full blur-xl animate-pulse" />
              <div className="relative w-24 h-24 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center">
                <Flag className="w-10 h-10 text-zinc-600" aria-hidden="true" />
              </div>
            </div>
            <h2 className="text-2xl font-bold text-white mb-3">Faça login para reportar</h2>
            <p className="text-zinc-400 mb-8 max-w-md mx-auto">
              Para enviar um reporte e ganhar recompensas, você precisa estar logado.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 w-full max-w-xs mx-auto">
              <Link
                href="/login?redirect=/registrar"
                className="flex-1 px-6 py-3 text-center text-sm font-medium text-white bg-amber-500 hover:bg-amber-600 rounded-xl transition-colors flex items-center justify-center gap-2"
              >
                Entrar
              </Link>
              <Link
                href="/cadastro?redirect=/registrar"
                className="flex-1 px-6 py-3 text-center text-sm font-medium text-amber-600 bg-amber-50 hover:bg-amber-100 rounded-xl transition-colors border border-amber-200 flex items-center justify-center gap-2"
              >
                Cadastrar
              </Link>
            </div>
          </div>
        </main>
        <BottomNavigation />
      </div>
    );
  }

  // Check authentication for submit step
  if (currentStep === "submit" && !user) {
    show("Você precisa estar logado para enviar um reporte", "error");
    // This will be handled by the component re-rendering with user
  }

  const xpForNextLevel = profile.level * profile.level * 100;
  const xpProgress = (profile.total_score % xpForNextLevel) / xpForNextLevel;

  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col">
      {/* Top Bar */}
      <header className="fixed top-0 left-0 right-0 z-40 bg-zinc-950/95 backdrop-blur-xl border-b border-zinc-800 navbar-safe">
        <div className="max-w-screen-xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3" aria-label="Civikoo - Início">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center">
              <Map className="w-5 h-5 text-white" aria-hidden="true" />
            </div>
            <div className="hidden sm:block">
              <h1 className="text-lg font-bold text-white">Civikoo</h1>
              <p className="text-xs text-zinc-500">Registrar</p>
            </div>
          </Link>

          <div className="flex items-center gap-3">
            <div className="hidden md:flex items-center gap-4 pr-2">
              <div className="flex items-center gap-2 bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-1.5">
                <div className="relative flex items-center justify-center w-7 h-7 rounded-full bg-amber-500/20">
                  <span className="text-xs font-bold text-amber-400">{profile.level}</span>
                </div>
              </div>
              <div className="relative w-32 h-2 bg-zinc-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-amber-500 to-amber-400 rounded-full transition-all duration-500"
                  style={{ width: `${xpProgress * 100}%` }}
                />
              </div>
              <div className="flex items-center gap-1.5 bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-1.5">
                <span className="text-amber-400 text-sm font-bold">{profile.coins}</span>
                <span className="text-zinc-500 text-xs">moedas</span>
              </div>
            </div>

            <Link
              href="/perfil"
              className="relative w-10 h-10 rounded-xl bg-zinc-900 border border-zinc-800 overflow-hidden flex items-center justify-center hover:border-zinc-700 transition-colors"
              aria-label="Meu perfil"
            >
              {profile.avatar_url ? (
                <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-amber-500 to-amber-600">
                  <span className="text-white font-bold text-lg">
                    {profile.username?.charAt(0).toUpperCase() || "?"}
                  </span>
                </div>
              )}
              <span className="absolute -bottom-1 -right-1 w-5 h-5 bg-amber-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-zinc-950">
                {profile.level}
              </span>
            </Link>
          </div>
        </div>
      </header>

      {/* Progress indicator - mobile */}
      <div className="fixed top-16 left-0 right-0 z-30 bg-zinc-950/95 backdrop-blur-xl border-b border-zinc-800 px-4 py-3 md:hidden">
        <div className="flex items-center justify-between">
          <button
            onClick={goBack}
            disabled={currentIndex === 0}
            className="p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            aria-label="Voltar"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-1 flex-1 mx-4">
            {stepOrder.map((step, i) => (
              <div
                key={step}
                className={`h-2 flex-1 rounded-full transition-colors ${
                  i <= currentIndex ? "bg-amber-500" : "bg-zinc-700"
                }`}
              />
            ))}
          </div>
          <span className="w-10 text-right text-xs text-zinc-500 font-medium">
            {currentIndex + 1}/{stepOrder.length}
          </span>
        </div>
      </div>

      {/* Content */}
      <main className="flex-1 pt-20 pb-24 px-4 max-w-screen-xl mx-auto w-full md:pt-28">
        {/* Progress indicator - desktop */}
        <div className="hidden md:flex items-center gap-2 mb-6">
          <button
            onClick={goBack}
            disabled={currentIndex === 0}
            className="p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            aria-label="Voltar"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-1 flex-1">
            {stepOrder.map((step, i) => (
              <div
                key={step}
                className={`h-2 flex-1 rounded-full transition-colors ${
                  i <= currentIndex ? "bg-amber-500" : "bg-zinc-700"
                }`}
              />
            ))}
          </div>
          <span className="text-xs text-zinc-500 font-medium w-20 text-right">
            {currentIndex + 1}/{stepOrder.length}
          </span>
        </div>

        {/* Step Content */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
          {currentStep === "gps" && (
            <Suspense fallback={<div className="flex-1 flex items-center justify-center h-96"><div className="w-10 h-10 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" /></div>}>
              <ReportStepGPS
                onConfirm={handleGPSConfirm}
                onCancel={handleCancel}
              />
            </Suspense>
          )}
          {currentStep === "photo" && (
            <Suspense fallback={<div className="flex-1 flex items-center justify-center h-96"><div className="w-10 h-10 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" /></div>}>
              <ReportStepPhoto
                onConfirm={handlePhotoConfirm}
                onCancel={handleCancel}
                onBack={goBack}
              />
            </Suspense>
          )}
          {currentStep === "category" && (
            <Suspense fallback={<div className="flex-1 flex items-center justify-center h-96"><div className="w-10 h-10 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" /></div>}>
              <ReportStepCategory
                onConfirm={handleCategoryConfirm}
                onBack={goBack}
                initialCategory={reportData.category as any}
              />
            </Suspense>
          )}
          {currentStep === "description" && (
            <Suspense fallback={<div className="flex-1 flex items-center justify-center h-96"><div className="w-10 h-10 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" /></div>}>
              <ReportStepDescription
                onConfirm={handleDescriptionConfirm}
                onBack={goBack}
                initialDescription={reportData.description}
              />
            </Suspense>
          )}
          {currentStep === "submit" && user && (
            <Suspense fallback={<div className="flex-1 flex items-center justify-center h-96"><div className="w-10 h-10 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" /></div>}>
              <ReportStepSubmit
                reportData={reportData as any}
                onSubmit={handleSubmitComplete}
                onCancel={handleCancel}
                onBack={goBack}
              />
            </Suspense>
          )}
        </div>

        {/* Nearby Reports Modal */}
        {showNearbyModal && nearbyReports.length > 0 && (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/50 animate-fade-in" onClick={() => setShowNearbyModal(false)}>
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl shadow-xl w-full max-w-md p-6 animate-slide-up" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-white">Reporte similar encontrado</h3>
                <button onClick={() => setShowNearbyModal(false)} className="p-1 rounded-lg hover:bg-zinc-800 transition-colors">
                  <X className="w-5 h-5 text-zinc-500" />
                </button>
              </div>
              <p className="text-sm text-zinc-400 mb-4">
                Já existe um reporte parecido a menos de 30m nesta categoria. Quer confirmar o existente em vez de criar outro?
              </p>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {nearbyReports.map((r) => (
                  <button
                    key={r.id}
                    onClick={() => handleConfirmExisting(r.id)}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-zinc-700 text-left hover:bg-zinc-800 transition-colors"
                  >
                    <div className="w-10 h-10 rounded-lg bg-amber-500/20 flex items-center justify-center flex-shrink-0">
                      <Flag className="w-5 h-5 text-amber-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-white truncate">{r.title}</p>
                      <p className="text-xs text-zinc-500">{r.category} • {Math.round(r.distance_m)}m de distância</p>
                    </div>
                  </button>
                ))}
              </div>
              <button
                onClick={() => {
                  setShowNearbyModal(false);
                  setNearbyReports([]);
                }}
                className="mt-4 w-full py-2 text-sm font-medium text-zinc-400 hover:text-white transition-colors"
              >
                Continuar criando novo reporte
              </button>
            </div>
          </div>
        )}
      </main>

      <BottomNavigation />
    </div>
  );
}