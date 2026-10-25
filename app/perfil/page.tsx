"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  User as UserIcon,
  Trophy,
  Coins,
  Clock,
  MapPin,
  CheckCircle,
  AlertCircle,
  Hourglass,
  Lock,
  Edit2,
  Save,
  X,
  ChevronDown,
  ChevronUp,
  Award,
  Star,
  Target,
  TrendingUp
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useSession } from "@/lib/auth";
import { useToast } from "@/app/components/ui/Toast";
import type { Badge, Report, LeaderboardEntry, UserProfile, StreakInfo } from "@/app/components/map/types";
import { Avatar } from "@/app/components/avatar";
import { StreakIndicator } from "@/app/components/ui/StreakIndicator";
import { getStreakInfo } from "@/lib/supabase/client";

const BADGE_ORDER = [
  'primeiro_reporte',
  'cinco_reportes_confirmados',
  'dez_confirmacoes',
  'primeiro_resolvido',
  'cacador_de_buracos',
  'guardiao_da_luz',
  'cidade_limpa'
];

function getNextLevelXP(currentXP: number): number {
  // Level formula: level = floor(sqrt(xp / 50)) + 1
  // So for level L: xp >= (L-1)^2 * 50
  const currentLevel = Math.floor(Math.sqrt(currentXP / 50)) + 1;
  const nextLevelXP = Math.pow(currentLevel, 2) * 50;
  return nextLevelXP;
}

function getLevelTitle(level: number): string {
  if (level <= 2) return "Observador";
  if (level <= 5) return "Fiscal de Calçada";
  if (level <= 9) return "Guardião do Bairro";
  return "Protetor da Cidade";
}

function getStatusConfig(status: string) {
  const configs: Record<string, { label: string; color: string; bgColor: string; icon: any }> = {
    aberto: { label: "Aberto", color: "text-blue-600", bgColor: "bg-blue-100 dark:bg-blue-900/30", icon: Hourglass },
    confirmado: { label: "Confirmado", color: "text-amber-600", bgColor: "bg-amber-100 dark:bg-amber-900/30", icon: CheckCircle },
    resolvido: { label: "Resolvido", color: "text-green-600", bgColor: "bg-green-100 dark:bg-green-900/30", icon: CheckCircle },
    recusado: { label: "Recusado", color: "text-red-600", bgColor: "bg-red-100 dark:bg-red-900/30", icon: AlertCircle },
  };
  return configs[status] || configs.aberto;
}

export default function PerfilPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useSession();
  const { show: showToast } = useToast();

  const [gameProfile, setGameProfile] = useState<UserProfile | null>(null);
  const [myReports, setMyReports] = useState<Report[]>([]);
  const [allBadges, setAllBadges] = useState<Badge[]>([]);
  const [userBadges, setUserBadges] = useState<string[]>([]); // badge codes
  const [isLoading, setIsLoading] = useState(true);
  const [isEditingUsername, setIsEditingUsername] = useState(false);
  const [editUsername, setEditUsername] = useState("");
  const [usernameError, setUsernameError] = useState("");
  const [pendingXP, setPendingXP] = useState(0);
  const [showBadgeDetail, setShowBadgeDetail] = useState<Badge | null>(null);
  const [streak, setStreak] = useState<StreakInfo | null>(null);

  // Fetch all data
  const fetchData = useCallback(async () => {
    if (!user) return;

    const supabase = createClient();

    try {
      // Fetch game profile
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      if (!profileError && profile) {
        setGameProfile(profile);
        setEditUsername(profile.username);
      }

      // Fetch streak info
      try {
        const streakData = await getStreakInfo(user.id);
        setStreak(streakData);
      } catch (err) {
        console.warn("Failed to fetch streak:", err);
      }

      // Fetch user's reports
      const { data: reports, error: reportsError } = await supabase
        .from("reports")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (!reportsError && reports) {
        setMyReports(reports);
      }

      // Fetch all badges
      const { data: badges, error: badgesError } = await supabase
        .from("badges")
        .select("*")
        .order("category", { ascending: true });

      if (!badgesError && badges) {
        setAllBadges(badges);
      }

      // Fetch user's earned badges
      const { data: earnedBadges, error: earnedError } = await supabase
        .from("user_badges")
        .select("badge_id, earned_at, badges(code)")
        .eq("user_id", user.id);

      if (!earnedError && earnedBadges) {
        const codes = earnedBadges.map((b: any) => b.badges?.code).filter(Boolean);
        setUserBadges(codes);
      }

      // Fetch pending XP from reward_events
      const { data: pendingEvents, error: pendingError } = await supabase
        .from("reward_events")
        .select("xp")
        .eq("user_id", user.id)
        .eq("state", "pendente");

      if (!pendingError && pendingEvents) {
        const totalPending = pendingEvents.reduce((sum: number, e: { xp: number | null }) => sum + (e.xp || 0), 0);
        setPendingXP(totalPending);
      }

    } catch (err) {
      console.error("Failed to fetch profile data:", err);
      showToast("Erro ao carregar perfil", "error");
    } finally {
      setIsLoading(false);
    }
  }, [user, showToast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Handle username edit
  const handleSaveUsername = async () => {
    if (!user || !editUsername.trim()) return;

    const username = editUsername.trim().toLowerCase();

    // Validate
    if (username.length < 3 || username.length > 20) {
      setUsernameError("Username deve ter entre 3 e 20 caracteres");
      return;
    }
    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      setUsernameError("Apenas letras, números e underscore");
      return;
    }

    const supabase = createClient();
    const { error } = await supabase
      .from("profiles")
      .update({ username })
      .eq("id", user.id);

    if (error) {
      if (error.code === "23505") { // unique violation
        setUsernameError("Este username já está em uso");
      } else {
        setUsernameError("Erro ao salvar username");
      }
      return;
    }

    setGameProfile(prev => prev ? { ...prev, username } : null);
    setIsEditingUsername(false);
    setUsernameError("");
    showToast("Username atualizado!", "success");
  };

  // Sort badges by predefined order
  const sortedBadges = allBadges.sort((a, b) => {
    const idxA = BADGE_ORDER.indexOf(a.code);
    const idxB = BADGE_ORDER.indexOf(b.code);
    return (idxA === -1 ? 999 : idxA) - (idxB === -1 ? 999 : idxB);
  });

  // Group badges by category
  const badgesByCategory = sortedBadges.reduce((acc, badge) => {
    const cat = badge.category || "geral";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(badge);
    return acc;
  }, {} as Record<string, Badge[]>);

  const categoryLabels: Record<string, string> = {
    reporte: "📝 Reportes",
    confirmacao: "🔍 Verificações",
    categoria: "🏷️ Por Categoria",
    geral: "⭐ Gerais"
  };

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 pt-16 pb-20 px-4">
        <div className="max-w-3xl mx-auto space-y-6">
          <div className="animate-pulse space-y-6">
            <div className="h-32 bg-zinc-200 dark:bg-zinc-800 rounded-2xl" />
            <div className="h-48 bg-zinc-200 dark:bg-zinc-800 rounded-2xl" />
            <div className="h-64 bg-zinc-200 dark:bg-zinc-800 rounded-2xl" />
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    router.push("/login");
    return null;
  }

  const currentXP = gameProfile?.total_score || 0;
  const currentLevel = gameProfile?.level || 1;
  const nextLevelXP = getNextLevelXP(currentXP);
  const xpForNextLevel = nextLevelXP - currentXP;
  const xpInCurrentLevel = currentXP - Math.pow(currentLevel - 1, 2) * 50;
  const xpNeededForLevel = nextLevelXP - Math.pow(currentLevel - 1, 2) * 50;
  const progressPercent = Math.min(100, (xpInCurrentLevel / xpNeededForLevel) * 100);

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 pt-16 pb-20 px-4">
      <div className="max-w-3xl mx-auto space-y-6">

        {/* Profile Header */}
        <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-lg border border-zinc-200 dark:border-zinc-800 overflow-hidden">
          <div className="bg-gradient-to-r from-amber-500 to-amber-600 p-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div className="flex items-center gap-4">
                <Avatar equipped={gameProfile?.equipped ?? null} size={80} showBackground={false} />
                <div>
                  <h1 className="text-2xl font-bold text-white">{gameProfile?.username || "Usuário"}</h1>
                  <p className="text-amber-100">{getLevelTitle(currentLevel)}</p>
                </div>
              </div>
              <div className="flex items-center gap-6 text-white text-sm">
                <div className="flex items-center gap-2">
                  <Trophy className="w-5 h-5" aria-hidden="true" />
                  <span>{currentXP.toLocaleString("pt-BR")} XP</span>
                </div>
                <div className="flex items-center gap-2">
                  <Coins className="w-5 h-5" aria-hidden="true" />
                  <span>{gameProfile?.coins ?? 0} moedas</span>
                </div>
              </div>
            </div>
          </div>

          {/* Streak Display */}
          {streak && streak.streak_count > 0 && (
            <div className="px-6 py-4 bg-amber-50 dark:bg-amber-900/20 border-b border-amber-200 dark:border-amber-800/30">
              <StreakIndicator streak={streak} size="lg" showNextMilestone={true} className="w-full justify-center" />
            </div>
          )}

          <div className="p-6 space-y-6">
            {/* Username Editor */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <UserIcon className="w-5 h-5 text-zinc-500" aria-hidden="true" />
                {isEditingUsername ? (
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={editUsername}
                      onChange={(e) => setEditUsername(e.target.value)}
                      className="px-3 py-2 bg-zinc-100 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-600 rounded-xl text-zinc-900 dark:text-white font-medium focus:outline-none focus:ring-2 focus:ring-amber-500 w-48"
                      placeholder="Novo username"
                    />
                    <button onClick={handleSaveUsername} className="px-3 py-2 bg-amber-500 text-white rounded-xl text-sm font-medium hover:bg-amber-600 transition-colors">Salvar</button>
                    <button onClick={() => { setIsEditingUsername(false); setEditUsername(gameProfile?.username || ""); setUsernameError(""); }} className="px-3 py-2 text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300">Cancelar</button>
                  </div>
                ) : (
                  <>
                    <span className="font-medium text-zinc-900 dark:text-white text-lg">@{gameProfile?.username || "usuario"}</span>
                    <button onClick={() => setIsEditingUsername(true)} className="p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors" aria-label="Editar username">
                      <Edit2 className="w-4 h-4" aria-hidden="true" />
                    </button>
                  </>
                )}
              </div>
              {usernameError && <span className="text-red-500 text-sm ml-4">{usernameError}</span>}
            </div>

            {/* XP Progress */}
            <div>
              <div className="flex items-center justify-between text-sm mb-2">
                <span className="text-zinc-600 dark:text-zinc-400">Progresso para próximo nível</span>
                <span className="font-medium text-zinc-900 dark:text-white">
                  {xpInCurrentLevel.toLocaleString("pt-BR")} / {xpNeededForLevel.toLocaleString("pt-BR")} XP
                </span>
              </div>
              <div className="w-full h-3 bg-zinc-200 dark:bg-zinc-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-amber-400 to-amber-600 rounded-full transition-all duration-500"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                Faltam {xpForNextLevel.toLocaleString("pt-BR")} XP para o nível {currentLevel + 1}
              </p>
            </div>

            {/* Pending XP */}
            {pendingXP > 0 && (
              <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4 flex items-center gap-3">
                <TrendingUp className="w-5 h-5 text-amber-600 dark:text-amber-400" aria-hidden="true" />
                <div>
                  <p className="font-medium text-amber-800 dark:text-amber-200">XP Pendente</p>
                  <p className="text-sm text-amber-700 dark:text-amber-300">{pendingXP} XP aguardando confirmação da comunidade</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Badges Section */}
        <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-lg border border-zinc-200 dark:border-zinc-800 p-6">
          <h2 className="text-xl font-bold text-zinc-900 dark:text-white mb-4 flex items-center gap-2">
            <Award className="w-5 h-5 text-amber-500" aria-hidden="true" />
            Medalhas
          </h2>

          {Object.entries(badgesByCategory).map(([category, badges]) => (
            <div key={category} className="mb-6 last:mb-0">
              <h3 className="text-sm font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-3">
                {categoryLabels[category] || category}
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                {badges.map((badge) => {
                  const isEarned = userBadges.includes(badge.code);
                  return (
                    <button
                      key={badge.id}
                      onClick={() => setShowBadgeDetail(badge)}
                      className={`relative p-4 rounded-xl text-center transition-all ${
                        isEarned
                          ? "bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800"
                          : "bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 opacity-60 grayscale"
                      }`}
                      disabled={!isEarned}
                    >
                      <span className="text-3xl block mb-2">{badge.icon}</span>
                      <span className={`text-sm font-medium ${isEarned ? "text-zinc-900 dark:text-white" : "text-zinc-500 dark:text-zinc-400"}`}>
                        {badge.name}
                      </span>
                      {isEarned && (
                        <Star className="absolute top-1 right-1 w-4 h-4 fill-amber-400 text-amber-400" aria-hidden="true" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* My Reports Section */}
        <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-lg border border-zinc-200 dark:border-zinc-800 overflow-hidden">
          <div className="p-6 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
            <h2 className="text-xl font-bold text-zinc-900 dark:text-white flex items-center gap-2">
              <MapPin className="w-5 h-5 text-amber-500" aria-hidden="true" />
              Meus Reportes ({myReports.length})
            </h2>
            <Link
              href="/"
              className="text-sm text-amber-600 dark:text-amber-400 hover:underline font-medium"
            >
              Ver no mapa →
            </Link>
          </div>

          {myReports.length === 0 ? (
            <div className="p-12 text-center">
              <MapPin className="w-12 h-12 text-zinc-300 dark:text-zinc-600 mx-auto mb-3" aria-hidden="true" />
              <p className="text-zinc-600 dark:text-zinc-400">Você ainda não enviou nenhum reporte</p>
              <Link href="/" className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-amber-500 text-white rounded-xl font-medium hover:bg-amber-600 transition-colors">
                <MapPin className="w-4 h-4" aria-hidden="true" />
                Fazer primeiro reporte
              </Link>
            </div>
          ) : (
            <div className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {myReports.map((report) => {
                const statusConfig = getStatusConfig(report.status);
                const StatusIcon = statusConfig.icon;
                return (
                  <Link
                    key={report.id}
                    href={`/#report-${report.id}`}
                    className="p-4 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors flex items-start gap-4"
                  >
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${statusConfig.bgColor} flex-shrink-0`}>
                      <StatusIcon className={`w-5 h-5 ${statusConfig.color}`} aria-hidden="true" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-medium text-zinc-900 dark:text-white truncate">{report.title}</h3>
                        <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${statusConfig.bgColor} ${statusConfig.color}`}>
                          {statusConfig.label}
                        </span>
                      </div>
                      <p className="text-sm text-zinc-600 dark:text-zinc-400 truncate">{report.description}</p>
                      <div className="flex items-center gap-4 mt-2 text-xs text-zinc-500 dark:text-zinc-400">
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3 h-3" aria-hidden="true" />
                          {report.category}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" aria-hidden="true" />
                          {new Date(report.created_at).toLocaleDateString("pt-BR")}
                        </span>
                        {report.confirmations_continua && report.confirmations_continua > 0 && (
                          <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
                            <CheckCircle className="w-3 h-3" aria-hidden="true" />
                            {report.confirmations_continua} confirmações
                          </span>
                        )}
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>

      </div>

      {/* Badge Detail Modal */}
      {showBadgeDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-xl max-w-md w-full p-6 animate-pop-in relative">
            <button
              onClick={() => setShowBadgeDetail(null)}
              className="absolute top-3 right-3 p-1 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
              aria-label="Fechar"
            >
              <X className="w-5 h-5 text-zinc-500" />
            </button>

            <div className="text-center">
              <span className="text-6xl mb-3 block">{showBadgeDetail.icon}</span>
              <h3 className="text-xl font-bold text-zinc-900 dark:text-white mb-1">{showBadgeDetail.name}</h3>
              <p className="text-zinc-600 dark:text-zinc-400 mb-4">{showBadgeDetail.description}</p>

              {userBadges.includes(showBadgeDetail.code) ? (
                <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl p-4 text-green-800 dark:text-green-200">
                  <CheckCircle className="w-5 h-5 mx-auto mb-2" aria-hidden="true" />
                  <p className="font-medium">Conquistada!</p>
                  <p className="text-sm">+{showBadgeDetail.xp_reward} XP</p>
                </div>
              ) : (
                <div className="bg-zinc-50 dark:bg-zinc-800 rounded-xl p-4 text-zinc-600 dark:text-zinc-400">
                  <Lock className="w-5 h-5 mx-auto mb-2" aria-hidden="true" />
                  <p className="font-medium">Bloqueada</p>
                  <p className="text-sm">
                    {showBadgeDetail.requirement_type === "category_count"
                      ? `Reporte ${showBadgeDetail.requirement_value.count} problemas de ${showBadgeDetail.requirement_value.category}`
                      : showBadgeDetail.requirement_type === "first"
                        ? "Primeira vez realizando esta ação"
                        : `Complete ${showBadgeDetail.requirement_value.count} ${showBadgeDetail.requirement_type === "confirmacao" ? "confirmações" : "reportes"}`
                    }
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}