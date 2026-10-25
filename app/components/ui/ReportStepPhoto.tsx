"use client";

import { useState, useRef, useCallback } from "react";
import { Camera, Image, X, Check, Loader2 } from "lucide-react";
import { resizeImageFile } from "@/lib/supabase/client";

interface ReportStepPhotoProps {
  onConfirm: (file: File, previewUrl: string, compressedBlob: Blob) => void;
  onCancel: () => void;
  onBack: () => void;
}

export function ReportStepPhoto({ onConfirm, onCancel, onBack }: ReportStepPhotoProps) {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [compressedBlob, setCompressedBlob] = useState<Blob | null>(null);
  const [compressing, setCompressing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = useCallback(async (selectedFile: File) => {
    if (!selectedFile.type.startsWith("image/")) {
      setError("Selecione um arquivo de imagem válido.");
      return;
    }
    if (selectedFile.size > 10 * 1024 * 1024) {
      setError("Arquivo muito grande (máx. 10MB antes da compressão).");
      return;
    }

    setError(null);
    setFile(selectedFile);
    setPreviewUrl(URL.createObjectURL(selectedFile));
    setCompressing(true);

    try {
      const blob = await resizeImageFile(selectedFile);
      setCompressedBlob(blob);
    } catch {
      setError("Falha ao comprimir a imagem. Tente outra.");
    } finally {
      setCompressing(false);
    }
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) handleFileSelect(e.target.files[0]);
  };

  const handleCameraClick = () => fileInputRef.current?.click();

  const handleRemove = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setFile(null);
    setPreviewUrl(null);
    setCompressedBlob(null);
    setError(null);
  };

  const handleConfirm = () => {
    if (file && previewUrl && compressedBlob) {
      onConfirm(file, previewUrl, compressedBlob);
    }
  };

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="p-4 border-b border-zinc-200 dark:border-zinc-700">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">2️⃣ Foto</h2>
        <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">
          Tire uma foto ou escolha da galeria. A imagem será comprimida (máx. 1280px, 5MB).
        </p>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center p-4">
        {previewUrl ? (
          <div className="w-full max-w-xs relative">
            <div className="aspect-[4/3] rounded-xl overflow-hidden bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700">
              <img
                src={previewUrl}
                alt="Pré-visualização"
                className="w-full h-full object-cover"
              />
              {compressing && (
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center rounded-xl">
                  <Loader2 className="w-8 h-8 text-white animate-spin" />
                  <span className="sr-only">Comprimindo...</span>
                </div>
              )}
            </div>
            <div className="flex gap-3 mt-3 justify-center">
              <button
                onClick={handleCameraClick}
                disabled={compressing}
                className="flex-1 py-3 rounded-xl border border-zinc-300 dark:border-zinc-600 text-zinc-700 dark:text-zinc-300 font-medium hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <Camera className="w-4 h-4" />
                Trocar foto
              </button>
              <button
                onClick={handleRemove}
                disabled={compressing}
                className="px-4 py-3 rounded-xl bg-red-500 hover:bg-red-600 text-white font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <X className="w-4 h-4" />
                Remover
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={handleCameraClick}
            disabled={compressing}
            className="w-full max-w-xs aspect-[4/3] rounded-xl border-2 border-dashed border-zinc-300 dark:border-zinc-600 bg-zinc-50 dark:bg-zinc-800 flex flex-col items-center justify-center gap-3 text-zinc-600 dark:text-zinc-400 hover:border-amber-500 hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-all disabled:opacity-50"
          >
            <Camera className="w-12 h-12" />
            <span className="text-lg font-medium">Toque para tirar foto ou escolher</span>
            <span className="text-sm">Câmera / Galeria</span>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleInputChange}
              className="hidden"
              disabled={compressing}
            />
          </button>
        )}

        {error && (
          <p className="mt-3 text-sm text-red-600 dark:text-red-400 text-center px-4">{error}</p>
        )}

        {compressedBlob && !compressing && (
          <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-500 text-center">
            Tamanho final: {(compressedBlob.size / 1024).toFixed(1)} KB
          </p>
        )}
      </div>

      <div className="p-4 border-t border-zinc-200 dark:border-zinc-700 flex gap-3">
        <button
          onClick={onBack}
          className="flex-1 py-3 rounded-xl border border-zinc-300 dark:border-zinc-600 text-zinc-700 dark:text-zinc-300 font-medium hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
        >
          Voltar
        </button>
        <button
          onClick={handleConfirm}
          disabled={!file || compressing}
          className="flex-1 py-3 rounded-xl bg-amber-500 hover:bg-amber-600 disabled:bg-zinc-300 dark:disabled:bg-zinc-700 disabled:cursor-not-allowed text-white font-medium transition-colors shadow-sm flex items-center justify-center gap-2"
        >
          {compressing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
          Próximo
        </button>
      </div>
    </div>
  );
}