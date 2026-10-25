"use client";

import { useEffect, useState } from "react";
import { Download, X } from "lucide-react";
import { useToast } from "./Toast";

export function InstallBanner() {
  const [showBanner, setShowBanner] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const { show } = useToast();

  useEffect(() => {
    // Check if already installed (running in standalone mode)
    const isStandalone = window.matchMedia("(display-mode: standalone)").matches ||
                         (window.navigator as any).standalone === true;

    if (isStandalone) {
      return; // Don't show banner if already installed
    }

    // Check if we already dismissed the banner recently (24h)
    const dismissed = localStorage.getItem("civikoo-install-dismissed");
    if (dismissed) {
      const dismissedTime = parseInt(dismissed, 10);
      if (Date.now() - dismissedTime < 24 * 60 * 60 * 1000) {
        return; // Don't show if dismissed within 24 hours
      }
    }

    const handleBeforeInstallPrompt = (e: Event) => {
      // Prevent the mini-infobar from appearing on mobile
      e.preventDefault();
      // Stash the event so it can be triggered later
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      // Show the banner
      setShowBanner(true);
    };

    const handleAppInstalled = () => {
      // Hide the banner once installed
      setShowBanner(false);
      setDeferredPrompt(null);
      localStorage.setItem("civikoo-install-dismissed", Date.now().toString());
      show("Civikoo instalado com sucesso!", "success");
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, [show]);

  const handleInstall = async () => {
    if (!deferredPrompt) return;

    // Show the install prompt
    deferredPrompt.prompt();

    // Wait for the user to respond to the prompt
    const { outcome } = await deferredPrompt.userChoice;

    if (outcome === "accepted") {
      show("Instalando Civikoo...", "success");
    } else {
      show("Instalação cancelada", "info");
    }

    // Clear the deferred prompt since it can only be used once
    setDeferredPrompt(null);
    setShowBanner(false);
    localStorage.setItem("civikoo-install-dismissed", Date.now().toString());
  };

  const handleDismiss = () => {
    setShowBanner(false);
    localStorage.setItem("civikoo-install-dismissed", Date.now().toString());
  };

  if (!showBanner) return null;

  return (
    <div className="fixed bottom-20 left-4 right-4 md:left-auto md:right-4 md:bottom-24 md:w-[320px] z-50 animate-slide-up">
      <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-xl border border-zinc-200 dark:border-zinc-800 p-4 flex items-start gap-3">
        <div className="w-12 h-12 rounded-xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center flex-shrink-0">
          <Download className="w-6 h-6 text-amber-600 dark:text-amber-400" aria-hidden="true" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-zinc-900 dark:text-white text-sm">
            Instalar Civikoo
          </p>
          <p className="text-zinc-600 dark:text-zinc-400 text-sm mt-1">
            Adicione à tela inicial para acesso rápido e experiência de app nativo.
          </p>
        </div>
        <div className="flex items-center gap-2 ml-2">
          <button
            onClick={handleInstall}
            className="px-3 py-1.5 text-xs font-semibold text-white bg-amber-500 hover:bg-amber-600 rounded-xl transition-colors min-h-[44px] min-w-[44px]"
          >
            Instalar
          </button>
          <button
            onClick={handleDismiss}
            className="p-2 text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors min-h-[44px] min-w-[44px]"
            aria-label="Dispensar"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  );
}

// Type for beforeinstallprompt event
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}