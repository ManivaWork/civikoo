"use client";

import Link from "next/link";
import { Bell, RotateCcw, Trophy, CheckCircle } from "lucide-react";
import { BottomNavigation } from "@/app/components/ui/BottomNavigation";
import { useSession } from "@/lib/auth";

export default function NotificacoesPage() {
  const { user, loading: authLoading } = useSession();

  if (authLoading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center px-4 pt-20 pb-24">
        <div className="text-center max-w-md">
          <Bell className="w-20 h-20 text-zinc-700 mx-auto mb-6" aria-hidden="true" />
          <h1 className="text-2xl font-bold text-white mb-3">Notificações</h1>
          <p className="text-zinc-400 mb-8">
            Veja suas notificações: confirmações de reportes, novas conquistas, missões completadas e mais.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 w-full max-w-xs mx-auto">
            <Link
              href="/login"
              className="flex-1 px-6 py-3 text-center text-sm font-medium text-white bg-amber-500 hover:bg-amber-600 rounded-xl transition-colors flex items-center justify-center gap-2"
            >
              Entrar
            </Link>
            <Link
              href="/cadastro"
              className="flex-1 px-6 py-3 text-center text-sm font-medium text-amber-600 bg-amber-50 hover:bg-amber-100 rounded-xl transition-colors border border-amber-200 flex items-center justify-center gap-2"
            >
              Cadastrar
            </Link>
          </div>
        </div>
        <BottomNavigation />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col">
      {/* Top Bar */}
      <header className="fixed top-0 left-0 right-0 z-40 bg-zinc-950/95 backdrop-blur-xl border-b border-zinc-800 navbar-safe">
        <div className="max-w-screen-xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center">
              <Bell className="w-5 h-5 text-white" aria-hidden="true" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white">Notificações</h1>
              <p className="text-xs text-zinc-500">Suas atualizações</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/perfil"
              className="relative w-10 h-10 rounded-xl bg-zinc-900 border border-zinc-800 overflow-hidden flex items-center justify-center hover:border-zinc-700 transition-colors"
              aria-label="Meu perfil"
            >
              <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-amber-500 to-amber-600">
                <span className="text-white font-bold text-lg">?</span>
              </div>
              <span className="absolute -bottom-1 -right-1 w-5 h-5 bg-amber-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-zinc-950">
                1
              </span>
            </Link>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 pt-20 pb-24 px-4 max-w-screen-xl mx-auto w-full">
        {/* Placeholder "Em breve" */}
        <div className="text-center py-16">
          <div className="relative inline-flex items-center justify-center mb-6">
            <div className="absolute inset-0 bg-amber-500/10 rounded-full blur-xl animate-pulse" />
            <div className="relative w-24 h-24 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center">
              <Bell className="w-10 h-10 text-zinc-600" aria-hidden="true" />
            </div>
          </div>

          <h2 className="text-2xl font-bold text-white mb-3">Notificações</h2>
          <p className="text-zinc-400 mb-8 max-w-md mx-auto">
            Em breve! Aqui você verá todas as suas notificações: confirmações dos seus reportes,
            conquistas desbloqueadas, missões completadas e atualizações da comunidade.
          </p>

          {/* Coming soon features preview */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-2xl mx-auto mb-10">
            {[
              { icon: CheckCircle, label: "Confirmações", desc: "Quando confirmam seus reportes" },
              { icon: Trophy, label: "Conquistas", desc: "Medalhas desbloqueadas" },
              { icon: Bell, label: "Sistema", desc: "Atualizações importantes" },
            ].map((feature, i) => (
              <div key={i} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 text-left hover:border-zinc-700 transition-colors">
                <div className="w-10 h-10 rounded-xl bg-zinc-800 flex items-center justify-center mb-4">
                  <feature.icon className="w-5 h-5 text-zinc-500" aria-hidden="true" />
                </div>
                <h3 className="font-semibold text-white mb-1">{feature.label}</h3>
                <p className="text-zinc-500 text-sm">{feature.desc}</p>
              </div>
            ))}
          </div>

          {/* CTA to map */}
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-6 py-3 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-medium transition-colors shadow-lg shadow-amber-500/25"
          >
            <RotateCcw className="w-4 h-4" aria-hidden="true" />
            Voltar ao Mapa
          </Link>
        </div>
      </main>

      <BottomNavigation />
    </div>
  );
}