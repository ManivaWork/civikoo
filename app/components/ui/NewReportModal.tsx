"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { X, Camera, Image, MapPin, Loader2, AlertCircle, CheckCircle } from "lucide-react";
import { CATEGORY_CONFIG, ReportCategory, getCategoryConfig } from "../map/types";

interface NewReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  userLocation: { lat: number; lng: number } | null;
  onReportCreated?: () => void;
}

export function NewReportModal({ isOpen, onClose, userLocation, onReportCreated }: NewReportModalProps) {
  const [selectedCategory, setSelectedCategory] = useState<ReportCategory>("outro");
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [description, setDescription] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  // Focus trap and escape key handling
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };

    document.addEventListener("keydown", handleKeyDown);
    document.body.style.overflow = "hidden";

    // Focus the first interactive element
    setTimeout(() => {
      const element = modalRef.current?.querySelector("button, [href], input, select, textarea, [tabindex]:not([tabindex='-1'])") as HTMLElement | null;
      element?.focus();
    }, 100);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [isOpen, onClose]);

  // Reset form when modal closes
  useEffect(() => {
    if (!isOpen) {
      setSelectedCategory("outro");
      setPhoto(null);
      setPhotoPreview(null);
      setDescription("");
      setError(null);
      setSuccess(false);
    }
  }, [isOpen]);

  const handlePhotoSelect = useCallback((file: File) => {
    // Validate file type
    if (!file.type.startsWith("image/")) {
      setError("Por favor, selecione uma imagem válida.");
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setError("A imagem deve ter no máximo 5MB.");
      return;
    }

    setPhoto(file);
    setError(null);

    // Create preview
    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result;
      if (typeof result === "string") {
        setPhotoPreview(result);
      }
    };
    reader.readAsDataURL(file);
  }, []);

  const handleCameraCapture = useCallback(() => {
    if (!fileInputRef.current) return;
    fileInputRef.current.accept = "image/*";
    fileInputRef.current.capture = "environment";
    fileInputRef.current.click();
  }, []);

  const handleGallerySelect = useCallback(() => {
    if (!fileInputRef.current) return;
    fileInputRef.current.accept = "image/*";
    fileInputRef.current.removeAttribute("capture");
    fileInputRef.current.click();
  }, []);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handlePhotoSelect(file);
    // Reset input to allow selecting same file again
    e.target.value = "";
  }, [handlePhotoSelect]);

  const removePhoto = useCallback(() => {
    setPhoto(null);
    setPhotoPreview(null);
  }, []);

  const uploadPhoto = async (file: File): Promise<string> => {
    // In a real app, upload to Supabase Storage
    // For now, convert to base64 data URL as placeholder
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result;
        if (typeof result === "string") {
          resolve(result);
        } else {
          reject(new Error("Failed to read file"));
        }
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const generateTitle = (category: ReportCategory): string => {
    const config = getCategoryConfig(category);
    return `Problema: ${config.label}`;
  };

  const handleSubmit = async () => {
    if (!photo) {
      setError("Por favor, tire uma foto ou escolha uma da galeria.");
      return;
    }

    if (!userLocation) {
      setError("Não foi possível obter sua localização. Tente novamente.");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      // Upload photo
      const photoUrl = await uploadPhoto(photo);

      // Call Supabase Edge Function
      const response = await fetch("/api/reports", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          latitude: userLocation.lat,
          longitude: userLocation.lng,
          category: selectedCategory,
          title: generateTitle(selectedCategory),
          description: description.trim() || undefined,
          photo_url: photoUrl,
          user_location: {
            latitude: userLocation.lat,
            longitude: userLocation.lng,
          },
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Erro ao criar reporte");
      }

      setSuccess(true);
      setTimeout(() => {
        onClose();
        onReportCreated?.();
      }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao enviar reporte. Tente novamente.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const categories: ReportCategory[] = [
    "buraco_asfalto",
    "vazamento_agua",
    "sinalizacao",
    "acessibilidade",
    "iluminacao",
    "lixo_entulho",
    "vegetacao",
    "mobiliario_urbano",
    "outro",
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-sm animate-fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      <div
        ref={modalRef}
        className="w-full max-w-sm bg-white dark:bg-zinc-900 rounded-t-3xl shadow-2xl animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Handle bar */}
        <div className="w-10 h-1.5 mx-auto mt-3 mb-4 bg-zinc-300 dark:bg-zinc-600 rounded-full" />

        {/* Header */}
        <div className="px-6 pb-4 flex items-center justify-between">
          <h2 id="modal-title" className="text-xl font-bold text-zinc-900 dark:text-white">
            Novo Reporte
          </h2>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            aria-label="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Category Selector */}
        <div className="px-6 pb-4">
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-3">
            Categoria
          </label>
          <div className="grid grid-cols-4 gap-3" role="radiogroup" aria-label="Selecione a categoria">
            {categories.map((cat) => {
              const config = getCategoryConfig(cat);
              const isSelected = selectedCategory === cat;
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setSelectedCategory(cat)}
                  role="radio"
                  aria-checked={isSelected}
                  className={`relative aspect-square rounded-2xl border-2 transition-all duration-200 flex flex-col items-center justify-center gap-2 ${
                    isSelected
                      ? `border-2 ${config.color.replace("text-", "border-")} ${config.bgColor} shadow-lg`
                      : "border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-600"
                  }`}
                >
                  <span className="text-3xl" aria-hidden="true">{config.icon}</span>
                  <span className={`text-xs font-medium ${isSelected ? config.color : "text-zinc-600 dark:text-zinc-400"}`}>
                    {config.label}
                  </span>
                  {isSelected && (
                    <CheckCircle className="absolute top-2 right-2 w-5 h-5 text-green-500" aria-hidden="true" />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Photo Section */}
        <div className="px-6 pb-4">
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-3">
            Foto do Problema <span className="text-zinc-400 font-normal">(obrigatória)</span>
          </label>

          {photoPreview ? (
            <div className="relative group">
              <div className="aspect-video rounded-2xl overflow-hidden bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700">
                <img
                  src={photoPreview}
                  alt="Prévia da foto do problema"
                  className="w-full h-full object-cover"
                />
              </div>
              <button
                type="button"
                onClick={removePhoto}
                className="absolute top-2 right-2 p-2 bg-red-500/90 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
                aria-label="Remover foto"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={handleCameraCapture}
                className="group aspect-video rounded-2xl border-2 border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 flex flex-col items-center justify-center gap-2 hover:border-amber-500 dark:hover:border-amber-500 transition-colors"
              >
                <div className="w-12 h-12 rounded-xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Camera className="w-6 h-6 text-amber-600 dark:text-amber-400" aria-hidden="true" />
                </div>
                <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Câmera</span>
              </button>
              <button
                type="button"
                onClick={handleGallerySelect}
                className="group aspect-video rounded-2xl border-2 border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 flex flex-col items-center justify-center gap-2 hover:border-amber-500 dark:hover:border-amber-500 transition-colors"
              >
                <div className="w-12 h-12 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Image className="w-6 h-6 text-blue-600 dark:text-blue-400" aria-hidden="true" />
                </div>
                <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Galeria</span>
              </button>
            </div>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            className="hidden"
            aria-hidden="true"
          />
        </div>

        {/* Description */}
        <div className="px-6 pb-4">
          <label htmlFor="description" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
            Descrição (opcional)
          </label>
          <textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Descreva brevemente o problema..."
            rows={3}
            maxLength={500}
            className="w-full px-4 py-3 rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent resize-none transition-all"
          />
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 text-right">
            {description.length}/500
          </p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="px-6 pb-4 flex items-center gap-2 text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-xl p-3 mx-6" role="alert">
            <AlertCircle className="w-5 h-5 flex-shrink-0" aria-hidden="true" />
            <p className="text-sm">{error}</p>
          </div>
        )}

        {/* Success Message */}
        {success && (
          <div className="px-6 pb-4 flex items-center gap-2 text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 rounded-xl p-3 mx-6" role="status">
            <CheckCircle className="w-5 h-5 flex-shrink-0" aria-hidden="true" />
            <p className="text-sm font-medium">Reporte enviado com sucesso!</p>
          </div>
        )}

        {/* Submit Button */}
        <div className="px-6 pb-6">
          <button
            onClick={handleSubmit}
            disabled={isSubmitting || success || !photo}
            className="w-full py-3.5 rounded-2xl bg-amber-500 hover:bg-amber-600 disabled:bg-zinc-300 dark:disabled:bg-zinc-700 disabled:cursor-not-allowed text-white font-semibold text-base flex items-center justify-center gap-2 transition-colors shadow-lg hover:shadow-xl active:scale-[0.98]"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" aria-hidden="true" />
                Enviando...
              </>
            ) : (
              "Enviar Reporte"
            )}
          </button>
        </div>

        {/* Location Info */}
        {userLocation && (
          <div className="mx-6 mb-4 p-3 bg-zinc-50 dark:bg-zinc-800/50 rounded-xl border border-zinc-200 dark:border-zinc-700">
            <div className="flex items-center gap-2 text-zinc-600 dark:text-zinc-400 text-sm">
              <MapPin className="w-4 h-4 text-amber-500" aria-hidden="true" />
              <span>Localização: {userLocation.lat.toFixed(6)}, {userLocation.lng.toFixed(6)}</span>
            </div>
          </div>
        )}
      </div>

      {/* Style for animations */}
      <style jsx global>{`
        @keyframes fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slide-up {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-fade-in {
          animation: fade-in 0.2s ease-out;
        }
        .animate-slide-up {
          animation: slide-up 0.3s cubic-bezier(0.16, 1, 0.3, 1);
        }
      `}</style>
    </div>
  );
}