"use client";

import React, { useState, useRef } from "react";
import { Loader2, CheckCircle, AlertCircle, MapPin, Image, Tag, FileText } from "lucide-react";
import { uploadReportImage } from "@/lib/supabase/client";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "./Toast";

interface ReportData {
  position: { lat: number; lng: number };
  file: File;
  previewUrl: string;
  compressedBlob: Blob;
  category: string;
  description: string;
}

interface ReportStepSubmitProps {
  reportData: ReportData;
  userId: string;
  onSubmit: () => void;
  onCancel: () => void;
  onBack: () => void;
}

export function ReportStepSubmit({ reportData, userId, onSubmit, onCancel, onBack }: ReportStepSubmitProps) {
  const [step, setStep] = useState<"uploading" | "saving" | "success" | "error">("uploading");
  const [error, setError] = useState<string | null>(null);
  const { show } = useToast();

  const steps = [
    { id: "uploading", label: "Enviando foto", icon: Image },
    { id: "saving", label: "Salvando reporte", icon: FileText },
    { id: "success", label: "Concluído!", icon: CheckCircle },
  ];

  const runSubmit = async () => {
    try {
      // Step 1: Upload image
      setStep("uploading");
      const imageUrl = await uploadReportImage(reportData.file, userId);

      // Step 2: Save report
      setStep("saving");
      const supabase = createClient();

      const { error: insertError } = await supabase
        .from("reports")
        .insert({
          location: `POINT(${reportData.position.lng} ${reportData.position.lat})`,
          category: reportData.category,
          description: reportData.description || null,
          image_url: imageUrl,
        });

      if (insertError) throw insertError;

      setStep("success");
      show("Reporte enviado com sucesso! 🎉", "success");

      setTimeout(() => {
        onSubmit();
      }, 1500);
    } catch (err) {
      console.error("Submit error:", err);
      setError(err instanceof Error ? err.message : "Falha ao enviar reporte");
      setStep("error");
      show(error || "Falha ao enviar reporte", "error");
    }
  };

  // Auto-start on mount
  // Using a ref to track if we've already started
  const startedRef = useRef(false);
  if (!startedRef.current) {
    startedRef.current = true;
    runSubmit();
  }

  const CurrentIcon = steps.find(s => s.id === step)?.icon || Loader2;

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="p-4 border-b border-zinc-200 dark:border-zinc-700">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">5️⃣ Enviar</h2>
        <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">
          Enviando sua contribuição para a comunidade.
        </p>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center p-4 gap-6">
        {/* Progress steps */}
        <div className="w-full max-w-md flex items-center justify-between">
          {steps.map((s, i) => (
            <React.Fragment key={s.id}>
              <div className="relative flex flex-col items-center">
                <div
                  className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${
                    step === s.id || (step === "success" && s.id !== "success")
                      ? "bg-amber-500 text-white shadow-lg shadow-amber-500/30"
                      : step === "error"
                      ? "bg-red-500 text-white"
                      : "bg-zinc-200 dark:bg-zinc-700 text-zinc-400"
                  }`}
                >
                  <CurrentIcon className="w-6 h-6" />
                </div>
                <span className="mt-2 text-xs text-center text-zinc-600 dark:text-zinc-400 w-20">
                  {s.label}
                </span>
              </div>
              {i < steps.length - 1 && (
                <div
                  className={`absolute top-6 left-12 w-full h-1 -ml-12 transition-colors ${
                    step === "success" || step === s.id || step === "error"
                      ? "bg-amber-500"
                      : "bg-zinc-200 dark:bg-zinc-700"
                  }`}
                />
              )}
            </React.Fragment>
          ))}
        </div>

        {/* Status message */}
        <div className="text-center px-4">
          {step === "uploading" && <p className="text-zinc-600 dark:text-zinc-400">Enviando imagem comprimida...</p>}
          {step === "saving" && <p className="text-zinc-600 dark:text-zinc-400">Salvando no banco de dados...</p>}
          {step === "success" && (
            <div className="flex flex-col items-center gap-2">
              <CheckCircle className="w-16 h-16 text-green-500 animate-bounce" />
              <p className="text-lg font-semibold text-green-700 dark:text-green-300">Reporte enviado!</p>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">Obrigado por melhorar sua cidade.</p>
            </div>
          )}
          {step === "error" && (
            <div className="flex flex-col items-center gap-2">
              <AlertCircle className="w-16 h-16 text-red-500" />
              <p className="text-lg font-semibold text-red-700 dark:text-red-300">Erro ao enviar</p>
              <p className="text-sm text-zinc-600 dark:text-zinc-400 text-center max-w-xs">{error}</p>
            </div>
          )}
        </div>

        {/* Summary preview */}
        {(step === "uploading" || step === "saving") && (
          <div className="w-full max-w-md bg-zinc-50 dark:bg-zinc-800/50 rounded-xl p-4 border border-zinc-200 dark:border-zinc-700 space-y-3">
            <div className="flex items-center gap-3 text-sm">
              <MapPin className="w-4 h-4 text-zinc-400" />
              <span className="text-zinc-600 dark:text-zinc-300">
                {reportData.position.lat.toFixed(6)}, {reportData.position.lng.toFixed(6)}
              </span>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <Tag className="w-4 h-4 text-zinc-400" />
              <span className="text-zinc-600 dark:text-zinc-300 capitalize">{reportData.category}</span>
            </div>
            {reportData.description && (
              <div className="flex items-start gap-3 text-sm">
                <FileText className="w-4 h-4 text-zinc-400 mt-0.5" />
                <span className="text-zinc-600 dark:text-zinc-300">{reportData.description}</span>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="p-4 border-t border-zinc-200 dark:border-zinc-700 flex gap-3">
        {step === "error" ? (
          <>
            <button
              onClick={onBack}
              className="flex-1 py-3 rounded-xl border border-zinc-300 dark:border-zinc-600 text-zinc-700 dark:text-zinc-300 font-medium hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            >
              Voltar
            </button>
            <button
              onClick={runSubmit}
              className="flex-1 py-3 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-medium transition-colors shadow-sm flex items-center justify-center gap-2"
            >
              <Loader2 className="w-4 h-4" />
              Tentar novamente
            </button>
          </>
        ) : step === "success" ? (
          <button
            onClick={onCancel}
            className="w-full py-3 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-medium transition-colors shadow-sm"
          >
            Fechar
          </button>
        ) : (
          <button
            onClick={onCancel}
            className="w-full py-3 rounded-xl border border-zinc-300 dark:border-zinc-600 text-zinc-700 dark:text-zinc-300 font-medium hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          >
            Cancelar
          </button>
        )}
      </div>
    </div>
  );
}