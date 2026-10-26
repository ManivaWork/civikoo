"use client";

import { useEffect, useState, useCallback } from "react";
import { Trophy, Target, Crown, Medal, TrendingUp, Map, X, ChevronRight, ChevronLeft, User as UserIcon } from "lucide-react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useSession } from "@/lib/auth";
import type { LeaderboardEntry } from "@/app/components/map/types";
import { MiniAvatar } from "@/app/components/avatar";

type LeaderboardType = "weekly" | "overall";

const LEVEL_TITLES = [
  { max: 2, title: "Observador" },
  { max: 5, title: "Fiscal de Calçada" },
  { max: 9, title: "Guardião do Bairro" },
  { max: 999, title: "Protetor da Cidade" },
];

function getLevelTitle(level: number): string {
  const found = LEVEL_TITLES.find(t => level <= t.max);
  return found?.title || "Protetor da Cidade";
}

interface RankingPanelProps {
  onClose: () => void;
}

export function RankingPanel({ onClose }: RankingPanelProps) {
  const { user, profile, loading: authLoading } = useSession();
  const [activeTab, setActiveTab] = useState<LeaderboardType>("weekly");
  const [weeklyData, setWeeklyData] = useState<LeaderboardEntry[]>([]);
  const [overallData, setOverallData] = useState<LeaderboardEntry[]>([]);
  const [userRank, setUserRank] = useState<{ weekly: number | null; overall: number | null }>({
    weekly: null,
    overall: null,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [gameProfile, setGameProfile] = useState<{ level: number; total_score: number; title?: string } | null>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    if (!authLoading) setIsReady(true);
  }, [authLoading]);

  const fetchLeaderboards = useCallback(async () => {
    const supabase = createClient();

    try {
      if (user) {
        const { data: profileData } = await supabase
          .from("profiles")
          .select("level, total_score")
          .eq("id", user.id)
          .single();
        if (profileData) {
          setGameProfile({ level: profileData.level, total_score: profileData.total_score, title: getLevelTitle(profileData.level) });
        }
      }

      const { data: weekly, error: weeklyError } = await supabase
        .from("weekly_leaderboard")
        .select("*, profiles!inner(equipped)")
        .order("weekly_xp", { ascending: false });

      if (!weeklyError && weekly) {
        setWeeklyData(weekly.map((entry: any, idx: number) => ({
          ...entry,
          xp: entry.weekly_xp,
          rank: idx + 1,
          equipped: entry.profiles?.equipped ?? {},
        })));
      }

      const { data: overall, error: overallError } = await supabase
        .from("leaderboard_overall")
        .select("*, profiles!inner(equipped)")
        .order("xp", { ascending: false });

      if (!overallError && overall) {
        setOverallData(overall.map((entry: any) => ({
          ...entry,
          equipped: entry.profiles?.equipped ?? {},
        })));
      }

      if (user) {
        const weeklyUser = weekly?.find((e: any) => e.id === user.id);
        const overallUser = overall?.find((e: any) => e.id === user.id);

        setUserRank({
          weekly: weeklyUser?.rank || null,
          overall: overallUser?.rank || null,
        });
      }
    } catch (err) {
      console.error("Failed to fetch leaderboards:", err);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (isReady) fetchLeaderboards();
  }, [fetchLeaderboards, isReady]);

  const currentData = activeTab === "weekly" ? weeklyData : overallData;
  const currentUserRank = userRank[activeTab];

  const top3 = currentData.slice(0, 3);
  const rest = currentData.slice(3);

  if (authLoading || !isReady || isLoading) {
    return (
      <div className="fixed inset-0 z-50 bg-zinc-950 animate-slide-up flex flex-col">
        <header className="fixed top-0 left-0 right-0 z-40 bg-zinc-950/95 backdrop-blur-xl border-b border-zinc-800 navbar-safe">
          <div className="max-w-[430px] mx-auto px-4 h-16 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center">
                <Trophy className="w-5 h-5 text-white" aria-hidden="true" />
              </div>
              <div className="hidden sm:block">
                <h1 className="text-lg font-bold text-white">Civikoo</h1>
                <p className="text-xs text-zinc-500">Ranking</p>
              </div>
            </div>
            <button onClick={onClose} className="p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors" aria-label="Fechar">
              <X className="w-5 h-5" />
            </button>
          </div>
        </header>
        <main className="flex-1 pt-20 pb-24 px-4 max-w-[430px] mx-auto w-full">
          <div className="max-w-3xl mx-auto space-y-6">
            <div className="animate-pulse space-y-6">
              <div className="h-24 bg-zinc-900 border border-zinc-800 rounded-2xl flex items-center justify-center">
                <div className="w-3/4 h-8 bg-zinc-800 rounded" />
              </div>
              <div className="h-12 bg-zinc-900 border border-zinc-800 rounded-xl" />
              <div className="grid grid-cols-3 gap-4">
                {[1,2,3].map(i => (
                  <div key={i} className="h-32 bg-zinc-900 border border-zinc-800 rounded-2xl" />
                ))}
              </div>
              <div className="space-y-3">
                {[1,2,3,4,5].map(i => (
                  <div key={i} className="h-16 bg-zinc-900 border border-zinc-800 rounded-xl" />
                ))}
              </div>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-zinc-950 animate-slide-up flex flex-col">
      {/* Top Bar */}
      <header className="fixed top-0 left-0 right-0 z-40 bg-zinc-950/95 backdrop-blur-xl border-b border-zinc-800 navbar-safe">
        <div className="max-w-[430px] mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center">
              <Trophy className="w-5 h-5 text-white" aria-hidden="true" />
            </div>
            <div className="hidden sm:block">
              <h1 className="text-lg font-bold text-white">Civikoo</h1>
              <p className="text-xs text-zinc-500">Ranking</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors" aria-label="Fechar">
            <X className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 pt-20 pb-24 px-4 max-w-[430px] mx-auto w-full">
        <div className="max-w-3xl mx-auto space-y-6">

          {/* Header */}
          <div className="text-center">
            <h1 className="text-3xl font-bold text-white flex items-center justify-center gap-2">
              <Trophy className="w-8 h-8 text-amber-500" aria-hidden="true" />
              Ranking
            </h1>
            <p className="text-zinc-400 mt-1">
              {activeTab === "weekly" ? "Top 20 da semana (XP ganho nos últimos 7 dias)" : "Ranking geral por XP total"}
            </p>
          </div>

          {/* Tabs */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-1 flex gap-1">
            <button
              onClick={() => setActiveTab("weekly")}
              className={`flex-1 py-3 px-4 rounded-lg text-sm font-medium transition-colors ${
                activeTab === "weekly"
                  ? "bg-amber-500 text-white shadow-sm"
                  : "text-zinc-400 hover:bg-zinc-800"
              }`}
            >
              <TrendingUp className="w-4 h-4 inline mr-1" aria-hidden="true" />
              Semanal
            </button>
            <button
              onClick={() => setActiveTab("overall")}
              className={`flex-1 py-3 px-4 rounded-lg text-sm font-medium transition-colors ${
                activeTab === "overall"
                  ? "bg-amber-500 text-white shadow-sm"
                  : "text-zinc-400 hover:bg-zinc-800"
              }`}
            >
              <Target className="w-4 h-4 inline mr-1" aria-hidden="true" />
              Geral
            </button>
          </div>

          {/* User Rank Card (if logged in) */}
          {user && currentUserRank && gameProfile && (
            <div className="bg-gradient-to-r from-amber-500 to-amber-600 rounded-2xl p-6 text-white shadow-lg">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center text-2xl font-bold">
                    #{currentUserRank}
                  </div>
                  <div>
                    <p className="text-amber-100 text-sm">Sua posição no ranking {activeTab === "weekly" ? "semanal" : "geral"}</p>
                    <p className="text-2xl font-bold">#{currentUserRank}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs text-amber-100">Nível {gameProfile.level} · {getLevelTitle(gameProfile.level)}</p>
                  <p className="text-lg font-bold">{gameProfile.total_score.toLocaleString("pt-BR")} XP</p>
                </div>
              </div>
            </div>
          )}

          {/* Podium (Top 3) */}
          {top3.length > 0 && (
            <div className="grid grid-cols-3 gap-4">
              {/* 2nd Place */}
              {top3[1] && (
                <div className="relative col-span-1">
                  <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 pt-8 text-center relative">
                    <Medal className="w-10 h-10 text-zinc-600 mx-auto mb-2" aria-hidden="true" />
                    <div className="absolute -top-6 left-1/2 -translate-x-1/2 w-12 h-12 rounded-full bg-zinc-700 flex items-center justify-center text-zinc-400 font-bold text-xl shadow-lg">
                      2
                    </div>
                    <MiniAvatar equipped={top3[1].equipped ?? null} size={56} className="mx-auto mb-2" />
                    <p className="font-bold text-white truncate">{top3[1].username}</p>
                    <p className="text-sm text-zinc-500">
                      Nível {top3[1].level} · {getLevelTitle(top3[1].level)}
                    </p>
                    <p className="text-lg font-bold text-amber-400 mt-1">
                      {activeTab === "weekly" ? top3[1].xp : top3[1].xp.toLocaleString("pt-BR")} XP
                    </p>
                    {user && top3[1].id === user.id && (
                      <span className="absolute -top-2 right-2 bg-amber-500 text-white text-xs px-2 py-0.5 rounded-full">Você</span>
                    )}
                  </div>
                </div>
              )}

              {/* 1st Place */}
              {top3[0] && (
                <div className="relative col-span-1">
                  <div className="bg-zinc-900 border border-amber-500/30 rounded-2xl p-4 pt-10 text-center relative shadow-xl">
                    <Crown className="w-12 h-12 text-amber-500 mx-auto mb-2 animate-bounce" aria-hidden="true" />
                    <div className="absolute -top-8 left-1/2 -translate-x-1/2 w-16 h-16 rounded-full bg-gradient-to-r from-amber-400 to-amber-600 flex items-center justify-center text-white font-bold text-2xl shadow-xl ring-4 ring-amber-500/20">
                      1
                    </div>
                    <MiniAvatar equipped={top3[0].equipped ?? null} size={72} className="mx-auto mb-2" />
                    <p className="font-bold text-white text-lg truncate">{top3[0].username}</p>
                    <p className="text-sm text-zinc-500">
                      Nível {top3[0].level} · {getLevelTitle(top3[0].level)}
                    </p>
                    <p className="text-xl font-bold text-amber-400 mt-1">
                      {activeTab === "weekly" ? top3[0].xp : top3[0].xp.toLocaleString("pt-BR")} XP
                    </p>
                    {user && top3[0].id === user.id && (
                      <span className="absolute -top-2 right-2 bg-amber-500 text-white text-xs px-2 py-0.5 rounded-full">Você</span>
                    )}
                  </div>
                </div>
              )}

              {/* 3rd Place */}
              {top3[2] && (
                <div className="relative col-span-1">
                  <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 pt-8 text-center relative">
                    <Medal className="w-10 h-10 text-amber-700 mx-auto mb-2" aria-hidden="true" />
                    <div className="absolute -top-6 left-1/2 -translate-x-1/2 w-12 h-12 rounded-full bg-amber-700 flex items-center justify-center text-white font-bold text-xl shadow-lg">
                      3
                    </div>
                    <MiniAvatar equipped={top3[2].equipped ?? null} size={56} className="mx-auto mb-2" />
                    <p className="font-bold text-white truncate">{top3[2].username}</p>
                    <p className="text-sm text-zinc-500">
                      Nível {top3[2].level} · {getLevelTitle(top3[2].level)}
                    </p>
                    <p className="text-lg font-bold text-amber-400 mt-1">
                      {activeTab === "weekly" ? top3[2].xp : top3[2].xp.toLocaleString("pt-BR")} XP
                    </p>
                    {user && top3[2].id === user.id && (
                      <span className="absolute -top-2 right-2 bg-amber-500 text-white text-xs px-2 py-0.5 rounded-full">Você</span>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Rest of Leaderboard */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
            {rest.length === 0 ? (
              <div className="p-12 text-center">
                <Trophy className="w-12 h-12 text-zinc-600 mx-auto mb-3" aria-hidden="true" />
                <p className="text-zinc-400">Nenhum outro jogador no ranking ainda</p>
              </div>
            ) : (
              <div className="divide-y divide-zinc-800">
                {rest.map((entry, idx) => {
                  const rank = idx + 4;
                  const isCurrentUser = user && entry.id === user.id;
                  return (
                    <div
                      key={entry.id}
                      className={`p-4 flex items-center gap-4 transition-colors ${
                        isCurrentUser ? "bg-amber-500/10" : "hover:bg-zinc-800/50"
                      }`}
                    >
                      <div className="w-10 text-center font-bold text-zinc-500">
                        #{rank}
                      </div>
                      <MiniAvatar equipped={entry.equipped ?? null} size={40} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className={`font-medium truncate ${isCurrentUser ? "text-amber-400" : "text-white"}`}>
                            {entry.username}
                            {isCurrentUser && <span className="text-xs bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded-full">Você</span>}
                          </p>
                        </div>
                        <p className="text-xs text-zinc-500">
                          Nível {entry.level} · {getLevelTitle(entry.level)}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className={`font-bold ${isCurrentUser ? "text-amber-400" : "text-white"}`}>
                          {activeTab === "weekly" ? entry.xp : entry.xp.toLocaleString("pt-BR")} XP
                        </p>
                        {activeTab === "weekly" && (
                          <p className="text-xs text-zinc-500">esta semana</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Legend */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 text-sm">
            <h3 className="font-semibold text-white mb-2">Como funciona</h3>
            <ul className="space-y-1 text-zinc-400">
              <li className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-amber-500" aria-hidden="true" />
                <span><strong>Semanal:</strong> XP ganho nos últimos 7 dias (recompensas liberadas)</span>
              </li>
              <li className="flex items-center gap-2">
                <Target className="w-4 h-4 text-amber-500" aria-hidden="true" />
                <span><strong>Geral:</strong> XP total acumulado desde o início</span>
              </li>
              <li className="flex items-center gap-2">
                <Trophy className="w-4 h-4 text-amber-500" aria-hidden="true" />
                <span>Ganhe XP reportando problemas, confirmando e resolvendo</span>
              </li>
              <li className="flex items-center gap-2">
                <Crown className="w-4 h-4 text-amber-500" aria-hidden="true" />
                <span>Suba de nível e desbloqueie títulos exclusivos</span>
              </li>
            </ul>
          </div>

        </div>
      </main>
    </div>
  );
}