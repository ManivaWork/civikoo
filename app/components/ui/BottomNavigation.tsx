"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { MapPin, Bell, Trophy, User, Plus, Home, MessageSquare, Award } from "lucide-react";
import { useSession } from "@/lib/auth";

const navigationItems = [
  { href: "/", label: "Mapa", icon: MapPin, iconActive: MapPin, isCenter: false },
  { href: "/feed", label: "Feed", icon: MessageSquare, iconActive: MessageSquare, isCenter: false },
  { href: "/registrar", label: "Registrar", icon: Plus, iconActive: Plus, isCenter: true },
  { href: "/ranking", label: "Ranking", icon: Trophy, iconActive: Trophy, isCenter: false },
  { href: "/perfil", label: "Perfil", icon: User, iconActive: User, isCenter: false },
] as const;

export function BottomNavigation() {
  const pathname = usePathname();
  const { user } = useSession();

  const getActiveItem = () => {
    if (pathname === "/") return "mapa";
    if (pathname.startsWith("/feed")) return "feed";
    if (pathname.startsWith("/registrar")) return "registrar";
    if (pathname.startsWith("/ranking")) return "ranking";
    if (pathname.startsWith("/perfil")) return "perfil";
    if (pathname.startsWith("/loja")) return "loja";
    if (pathname.startsWith("/armario")) return "armario";
    if (pathname.startsWith("/missoes")) return "missoes";
    return "mapa";
  };

  const activeItem = getActiveItem();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-zinc-950/95 backdrop-blur-xl border-t border-zinc-800 bottom-sheet-safe" role="navigation" aria-label="Navegação principal">
      <div className="flex items-center justify-between h-16 px-2 max-w-screen-xl mx-auto">
        {navigationItems.map((item) => {
          const isActive = activeItem === item.label.toLowerCase();
          const isCenter = item.isCenter;

          if (isCenter) {
            return (
              <Link
                key={item.href}
                href={item.href}
                className="relative z-10 flex flex-col items-center justify-center gap-1 px-4 py-2"
                aria-current={isActive ? "page" : undefined}
                aria-label={item.label}
              >
                <div className={`relative w-14 h-14 rounded-2xl flex items-center justify-center transition-all duration-200 ${
                  isActive
                    ? "bg-amber-500 shadow-lg shadow-amber-500/40 ring-4 ring-amber-500/20"
                    : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200"
                }`}>
                  <item.iconActive className={`w-7 h-7 ${isActive ? "text-white" : "text-zinc-400"}`} aria-hidden="true" />
                  {/* Pulse animation for center button when not active */}
                  {!isActive && (
                    <span className="absolute -inset-1 rounded-2xl bg-amber-500/20 animate-ping opacity-50" aria-hidden="true" />
                  )}
                </div>
                <span className={`text-[10px] font-medium transition-colors ${isActive ? "text-amber-400" : "text-zinc-500"}`}>
                  {item.label}
                </span>
              </Link>
            );
          }

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex-1 flex flex-col items-center justify-center gap-1 px-3 py-2 transition-colors min-w-0 ${
                isActive
                  ? "text-amber-400"
                  : "text-zinc-500 hover:text-zinc-200"
              }`}
              aria-current={isActive ? "page" : undefined}
              aria-label={item.label}
            >
              <div className="relative w-10 h-10 rounded-xl flex items-center justify-center transition-colors">
                <item.iconActive className={`w-5 h-5 ${isActive ? "text-amber-400" : "text-zinc-500"}`} aria-hidden="true" />
                {isActive && (
                  <span className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-amber-400" aria-hidden="true" />
                )}
              </div>
              <span className={`text-[10px] font-medium ${isActive ? "text-amber-400" : "text-zinc-500"}`}>
                {item.label}
              </span>
            </Link>
          );
        })}

        {/* Notification Bell - only for logged in users */}
        {user && (
          <Link
            href="/notificacoes"
            className="relative flex items-center justify-center w-10 h-10 rounded-xl bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200 transition-colors ml-2"
            aria-label="Notificações"
          >
            <Bell className="w-5 h-5" aria-hidden="true" />
            <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
              3
            </span>
          </Link>
        )}
      </div>
    </nav>
  );
}