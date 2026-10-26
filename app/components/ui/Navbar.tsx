"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { LogOut, User as UserIcon, Trophy, Coins, ChevronDown, ChevronUp, Menu, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { AuthChangeEvent, Session, User } from "@supabase/supabase-js";
import { MiniAvatar } from "@/app/components/avatar";
import { StreakIndicatorCompact, StreakInfo } from "@/app/components/ui/StreakIndicator";
import { getStreakInfo } from "@/lib/supabase/client";

interface UserProfile {
  id: string;
  email?: string;
  user_metadata?: {
    full_name?: string;
    avatar_url?: string;
    username?: string;
  };
}

interface GameProfile {
  id: string;
  username: string;
  full_name: string | null;
  avatar_url: string | null;
  level: number;
  total_score: number;
  current_streak: number;
  longest_streak: number;
  title?: string;
  coins: number;
  equipped?: {
    cabeca?: string | null;
    corpo?: string | null;
    acessorio?: string | null;
    fundo?: string | null;
  };
}

export function Navbar() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [gameProfile, setGameProfile] = useState<GameProfile | null>(null);
  const [streak, setStreak] = useState<StreakInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  useEffect(() => {
    const supabase = createClient();

    // Obter sessão inicial
    supabase.auth.getSession().then(({ data: { session } }: { data: { session: Session | null } }) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchGameProfile(session.user.id);
        fetchStreak(session.user.id);
      } else {
        setIsLoading(false);
      }
    });

    // Escutar mudanças de auth
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event: AuthChangeEvent, session: Session | null) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchGameProfile(session.user.id);
        fetchStreak(session.user.id);
      } else {
        setGameProfile(null);
        setStreak(null);
        setIsLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchGameProfile = async (userId: string) => {
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .single();

      if (!error && data) {
        setGameProfile(data);
      }
    } catch (err) {
      console.warn("Failed to fetch game profile:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchStreak = async (userId: string) => {
    try {
      const streakData = await getStreakInfo(userId);
      setStreak(streakData);
    } catch (err) {
      console.warn("Failed to fetch streak:", err);
    }
  };

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
  };

  const getInitials = (name?: string | null, email?: string) => {
    if (name) return name.charAt(0).toUpperCase();
    if (email) return email.split("@")[0].charAt(0).toUpperCase();
    return "?";
  };

  const getDisplayName = (user: UserProfile | null, gameProfile: GameProfile | null) => {
  if (gameProfile?.username) return gameProfile.username;
  if (!user) return "Usuário";
  if (user.user_metadata?.full_name) return user.user_metadata.full_name;
  if (user.user_metadata?.username) return user.user_metadata.username;
  if (user.email) return user.email.split("@")[0];
  return "Usuário";
};

  if (isLoading) {
    return (
      <nav className="fixed top-0 left-0 right-0 z-40 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-md border-b border-zinc-200/50 dark:border-zinc-800/50">
        <div className="max-w-screen-xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-xl font-bold text-zinc-900 dark:text-white" aria-label="Civikoo - Início">
            <span className="text-amber-500">🏙️</span>
            Civikoo
          </Link>
          <div className="flex items-center gap-4">
            <div className="h-8 w-20 bg-zinc-200 dark:bg-zinc-800 rounded-lg animate-pulse" />
            <div className="h-8 w-24 bg-zinc-200 dark:bg-zinc-800 rounded-lg animate-pulse" />
          </div>
        </div>
      </nav>
    );
  }

  const displayName = getDisplayName(user, gameProfile);
  const initials = getInitials(gameProfile?.full_name || gameProfile?.username, user?.email);
  const level = gameProfile?.level || 1;
  const xp = gameProfile?.total_score || 0;
  const title = gameProfile?.title || "Observador";

  return (
    <nav className="fixed top-0 left-0 right-0 z-40 bg-white/90 dark:bg-zinc-950/90 backdrop-blur-md border-b border-zinc-200 dark:border-zinc-800">
      <div className="max-w-screen-xl mx-auto px-4 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 text-xl font-bold text-zinc-900 dark:text-white" aria-label="Civikoo - Início">
          <span className="text-amber-500">🏙️</span>
          Civikoo
        </Link>

        {/* Desktop Navigation */}
        <div className="hidden md:flex items-center gap-6">
          {user ? (
            // Logado - Dropdown do usuário
            <div className="relative" role="menu">
              <button
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                className="flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors focus:outline-none focus:ring-2 focus:ring-amber-500"
                aria-expanded={isDropdownOpen}
                aria-haspopup="true"
                aria-label={`Menu do usuário ${displayName}`}
              >
                {/* Avatar */}
                <MiniAvatar equipped={gameProfile?.equipped ?? null} size={32} />
                <span className="font-medium text-zinc-900 dark:text-white hidden sm:block">
                  {displayName}
                </span>
                <ChevronDown className={`w-4 h-4 text-zinc-500 transition-transform ${isDropdownOpen ? "rotate-180" : ""}`} aria-hidden="true" />
              </button>

              {/* Dropdown Menu */}
              {isDropdownOpen && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setIsDropdownOpen(false)}
                    aria-hidden="true"
                  />
                  <div className="absolute right-0 mt-2 w-72 bg-white dark:bg-zinc-900 rounded-2xl shadow-xl border border-zinc-200 dark:border-zinc-800 py-2 z-50 animate-pop-in">
                    {/* User Info */}
                    <div className="px-4 py-3 border-b border-zinc-200 dark:border-zinc-800">
                      <div className="flex items-center gap-3">
                        <MiniAvatar equipped={gameProfile?.equipped ?? null} size={40} />
                        <div>
                          <p className="font-medium text-zinc-900 dark:text-white text-sm">{displayName}</p>
                          <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate">{user?.email}</p>
                        </div>
                      </div>
                    </div>

                    {/* Level, Title, XP e Moedas */}
                    <div className="px-4 py-3 border-b border-zinc-200 dark:border-zinc-800 space-y-3">
                      <div className="flex items-center gap-3">
                        <span className="w-8 h-8 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center text-amber-600 dark:text-amber-400 font-bold text-sm">
                          {level}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-zinc-500 dark:text-zinc-400">Nível {level} · {title}</p>
                          <div className="w-full h-1.5 bg-zinc-200 dark:bg-zinc-700 rounded-full mt-1 overflow-hidden">
                            <div
                              className="h-full bg-amber-500 rounded-full transition-all duration-300"
                              style={{ width: `${(xp % 1000) / 10}%` }}
                            />
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-around gap-4">
                        <div className="flex items-center gap-2 text-zinc-600 dark:text-zinc-400 flex-1 justify-center">
                          <Trophy className="w-4 h-4 text-amber-500" aria-hidden="true" />
                          <span className="text-sm font-medium">XP: <span className="font-bold text-zinc-900 dark:text-white">{xp.toLocaleString("pt-BR")}</span></span>
                        </div>
                        <div className="flex items-center gap-2 text-zinc-600 dark:text-zinc-400 flex-1 justify-center">
                          <Coins className="w-4 h-4 text-amber-500" aria-hidden="true" />
                          <span className="text-sm font-medium">Moedas: <span className="font-bold text-zinc-900 dark:text-white">—</span></span>
                        </div>
                      </div>
                    </div>

                    {/* Streak */}
                    <div className="px-4 py-3 border-b border-zinc-200 dark:border-zinc-800">
                      <StreakIndicatorCompact streak={streak} />
                    </div>

                    {/* Links */}
                    <Link
                      href="/perfil"
                      className="block px-4 py-3 flex items-center gap-3 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-sm font-medium transition-colors"
                      onClick={() => setIsDropdownOpen(false)}
                      role="menuitem"
                    >
                      <UserIcon className="w-4 h-4" aria-hidden="true" />
                      Meu Perfil
                    </Link>
                    <Link
                      href="/ranking"
                      className="block px-4 py-3 flex items-center gap-3 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-sm font-medium transition-colors"
                      onClick={() => setIsDropdownOpen(false)}
                      role="menuitem"
                    >
                      <Trophy className="w-4 h-4" aria-hidden="true" />
                      Ranking
                    </Link>

                    {/* Sair */}
                    <button
                      onClick={handleSignOut}
                      className="w-full px-4 py-3 flex items-center justify-center gap-3 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 text-sm font-medium transition-colors border-t border-zinc-200 dark:border-zinc-800"
                      role="menuitem"
                    >
                      <LogOut className="w-4 h-4" aria-hidden="true" />
                      Sair
                    </button>
                  </div>
                </>
              )}
            </div>
          ) : (
            // Deslogado - Botões Entrar / Cadastrar
            <div className="flex items-center gap-3">
              <Link
                href="/login"
                className="px-4 py-2 text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:text-amber-600 dark:hover:text-amber-400 transition-colors"
              >
                Entrar
              </Link>
              <Link
                href="/cadastro"
                className="px-4 py-2 text-sm font-medium text-white bg-amber-500 hover:bg-amber-600 rounded-xl transition-colors shadow-sm hover:shadow-md"
              >
                Cadastrar
              </Link>
            </div>
          )}
        </div>

        {/* Mobile Menu Button */}
        <button
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="md:hidden p-2 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors text-zinc-700 dark:text-zinc-300"
          aria-expanded={isMobileMenuOpen}
          aria-controls="mobile-menu"
          aria-label={isMobileMenuOpen ? "Fechar menu" : "Abrir menu"}
        >
          {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {/* Mobile Menu */}
      {isMobileMenuOpen && (
        <div id="mobile-menu" className="md:hidden bg-white dark:bg-zinc-950 border-t border-zinc-200 dark:border-zinc-800 animate-slide-down px-4 py-4">
          <div className="flex flex-col gap-3">
            {user ? (
              <>
                {/* User Info Mobile */}
                <div className="flex items-center gap-3 px-2 py-2">
                  <MiniAvatar equipped={gameProfile?.equipped ?? null} size={40} />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-zinc-900 dark:text-white truncate">{displayName}</p>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate">{user?.email}</p>
                  </div>
                </div>

                {/* Level, Title, XP e Moedas Mobile */}
                <div className="px-2 py-3 bg-zinc-50 dark:bg-zinc-800/50 rounded-xl space-y-3">
                  <div className="flex items-center gap-3">
                    <span className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center text-amber-600 dark:text-amber-400 font-bold text-lg">
                      {level}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-zinc-500 dark:text-zinc-400">Nível {level} · {title}</p>
                      <div className="w-full h-2 bg-zinc-200 dark:bg-zinc-700 rounded-full mt-1 overflow-hidden">
                        <div
                          className="h-full bg-amber-500 rounded-full transition-all duration-300"
                          style={{ width: `${(xp % 1000) / 10}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-around gap-4 pt-2 border-t border-zinc-200 dark:border-zinc-700">
                    <div className="flex items-center gap-2 text-zinc-600 dark:text-zinc-400">
                      <Trophy className="w-4 h-4 text-amber-500" aria-hidden="true" />
                      <span className="text-sm font-medium">XP: <span className="font-bold text-zinc-900 dark:text-white">{xp.toLocaleString("pt-BR")}</span></span>
                    </div>
                    <div className="flex items-center gap-2 text-zinc-600 dark:text-zinc-400">
                      <Coins className="w-4 h-4 text-amber-500" aria-hidden="true" />
                      <span className="text-sm font-medium">Moedas: <span className="font-bold text-zinc-900 dark:text-white">—</span></span>
                    </div>
                  </div>
                </div>

                {/* Streak Mobile */}
                <div className="px-2 py-3">
                  <div className="flex justify-center">
                    <StreakIndicatorCompact streak={streak} />
                  </div>
                </div>

                {/* Links Mobile */}
                <Link
                  href="/perfil"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="px-4 py-3 flex items-center gap-3 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl text-sm font-medium transition-colors"
                >
                  <UserIcon className="w-5 h-5" aria-hidden="true" />
                  Meu Perfil
                </Link>
                <Link
                  href="/ranking"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="px-4 py-3 flex items-center gap-3 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl text-sm font-medium transition-colors"
                >
                  <Trophy className="w-5 h-5" aria-hidden="true" />
                  Ranking
                </Link>

                {/* Sair Mobile */}
                <button
                  onClick={handleSignOut}
                  className="w-full px-4 py-3 flex items-center justify-center gap-3 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl text-sm font-medium transition-colors border border-red-200 dark:border-red-900/30"
                >
                  <LogOut className="w-5 h-5" aria-hidden="true" />
                  Sair
                </button>
              </>
            ) : (
              <>
                <Link
                  href="/login"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="px-4 py-3 text-center text-base font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl transition-colors"
                >
                  Entrar
                </Link>
                <Link
                  href="/cadastro"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="px-4 py-3 text-center text-base font-medium text-white bg-amber-500 hover:bg-amber-600 rounded-xl transition-colors shadow-sm"
                >
                  Cadastrar
                </Link>
              </>
            )}
          </div>
        </div>
      )}

      {/* Estilos de animação */}
      <style jsx global>{`
        @keyframes pop-in {
          from {
            opacity: 0;
            transform: scale(0.95) translateY(-4px);
          }
          to {
            opacity: 1;
            transform: scale(1) translateY(0);
          }
        }
        @keyframes slide-down {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-pop-in {
          animation: pop-in 0.15s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .animate-slide-down {
          animation: slide-down 0.2s ease-out;
        }
      `}</style>
    </nav>
  );
}