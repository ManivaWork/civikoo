"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  User as UserIcon,
  Trophy,
  Coins,
  MapPin,
  CheckCircle,
  Award,
  Star,
  Lock,
  Edit2,
  X,
  ChevronDown,
  ChevronUp,
  Target,
  TrendingUp,
  Medal,
  Flag,
  Sparkles,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useSession } from "@/lib/auth";
import { useToast } from "@/app/components/ui/Toast";
import type { Badge, Report, UserProfile } from "@/app/components/map/types";
import { CATEGORY_CONFIG, REPORT_BASE_XP } from "@/app/components/map/types";
import { Avatar } from "@/app/components/avatar";

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

// Category order for display
const DISPLAY_CATEGORIES = [
  "buraco_asfalto",
  "lixo_entulho",
  "iluminacao",
  "sinalizacao",
  "acessibilidade",
  "vazamento_agua",
  "vegetacao",
  "mobiliario_urbano",
  "outro",
] as const;

interface PerfilPanelProps {
  onClose: () => void;
}

export function PerfilPanel({ onClose }: PerfilPanelProps) {
  const router = useRouter();
  const { user, profile: sessionProfile, loading: authLoading } = useSession();
  const { show: showToast } = useToast();

  const [gameProfile, setGameProfile] = useState<UserProfile | null>(null);
  const [myReports, setMyReports] = useState<Report[]>([]);
  const [allBadges, setAllBadges] = useState<Badge[]>([]);
  const [userBadges, setUserBadges] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditingUsername, setIsEditingUsername] = useState(false);
  const [editUsername, setEditUsername] = useState("");
  const [usernameError, setUsernameError] = useState("");
  const [pendingXP, setPendingXP] = useState(0);
  const [showBadgeDetail, setShowBadgeDetail] = useState<Badge | null>(null);
  const [isReady, setIsReady] = useState(false);

  // Category progress data
  const [categoryProgress, setCategoryProgress] = useState<Record<string, { count: number; resolved: number }>>({});

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

      // Fetch user's reports
      const { data: reports, error: reportsError } = await supabase
        .from("reports")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (!reportsError && reports) {
        setMyReports(reports);

        // Calculate category progress
        const progress: Record<string, { count: number; resolved: number }> = {};
        DISPLAY_CATEGORIES.forEach(cat => {
          progress[cat] = { count: 0, resolved: 0 };
        });

        reports.forEach((report: Report) => {
          if (progress[report.category]) {
            progress[report.category].count += 1;
            if (report.status === "resolvido") {
              progress[report.category].resolved += 1;
            }
          }
        });
        setCategoryProgress(progress);
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

      // Fetch pending XP from reports that don't have enough confirmations yet
      const { data: pendingReports, error: pendingError } = await supabase
        .from("reports")
        .select("id, category")
        .eq("user_id", user.id)
        .lt("confirmations_continua", 2);

      if (!pendingError && pendingReports) {
        const totalPending = pendingReports.length * 10;
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
    if (!authLoading) setIsReady(true);
  }, [authLoading]);

  useEffect(() => {
    if (isReady) fetchData();
  }, [fetchData, isReady]);

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
      if (error.code === "23505") {
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
    reporte: "Reportes",
    confirmacao: "Verificações",
    categoria: "Por Categoria",
    especial: "Especiais",
    social: "Social",
    streak: "Sequência",
    geral: "Gerais"
  };

  if (authLoading || !isReady || isLoading) {
    return (
      <div className="fixed inset-0 z-50 bg-zinc-950 animate-slide-up flex flex-col">
        <header className="fixed top-0 left-0 right-0 z-40 bg-zinc-950/95 backdrop-blur-xl border-b border-zinc-800 navbar-safe">
          <div className="max-w-[430px] mx-auto px-4 h-16 flex items-center justify-between">
            <Link href="/" className="flex items-center gap-3" aria-label="Civikoo - Início">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center">
                <MapPin className="w-5 h-5 text-white" aria-hidden="true" />
              </div>
            </Link>
            <button onClick={onClose} className="p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors" aria-label="Fechar">
              <X className="w-5 h-5" />
            </button>
          </div>
        </header>
        <main className="flex-1 pt-20 pb-24 px-4 max-w-[430px] mx-auto w-full">
          <div className="animate-pulse space-y-6">
            <div className="h-32 bg-zinc-900 border border-zinc-800 rounded-2xl" />
            <div className="grid grid-cols-3 gap-4">
              {[1,2,3].map(i => <div key={i} className="h-24 bg-zinc-900 border border-zinc-800 rounded-2xl" />)}
            </div>
            <div className="h-64 bg-zinc-900 border border-zinc-800 rounded-2xl" />
          </div>
        </main>
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

  const earnedBadgesCount = userBadges.length;
  const totalBadgesCount = allBadges.length;
  const reportsCount = myReports.length;

  return (
    <div className="fixed inset-0 z-50 bg-zinc-950 animate-slide-up flex flex-col">
      {/* Top Bar */}
      <header className="fixed top-0 left-0 right-0 z-40 bg-zinc-950/95 backdrop-blur-xl border-b border-zinc-800 navbar-safe">
        <div className="max-w-[430px] mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3" aria-label="Civikoo - Início">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center">
              <MapPin className="w-5 h-5 text-white" aria-hidden="true" />
            </div>
            <div className="hidden sm:block">
              <h1 className="text-lg font-bold text-white">Civikoo</h1>
              <p className="text-xs text-zinc-500">Meu Perfil</p>
            </div>
          </Link>
          <button onClick={onClose} className="p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors" aria-label="Fechar">
            <X className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 pt-20 pb-24 px-4 max-w-[430px] mx-auto w-full">
        {/* Profile Header Card */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden mb-6">
          <div className="bg-gradient-to-r from-amber-500 to-amber-600 p-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div className="flex items-center gap-4">
                <Avatar equipped={gameProfile?.equipped ?? null} size={80} showBackground={false} />
                <div>
                  <div className="flex items-center gap-2">
                    <h1 className="text-2xl font-bold text-white">
                      {isEditingUsername ? (
                        <input
                          type="text"
                          value={editUsername}
                          onChange={(e) => setEditUsername(e.target.value)}
                          className="bg-transparent text-white font-bold text-2xl focus:outline-none focus:ring-2 focus:ring-amber-300 rounded px-1 w-auto"
                          placeholder="Username"
                        />
                      ) : (
                        gameProfile?.username || "Usuário"
                      )}
                    </h1>
                    {!isEditingUsername && (
                      <button
                        onClick={() => setIsEditingUsername(true)}
                        className="p-1 rounded-lg hover:bg-white/20 transition-colors"
                        aria-label="Editar username"
                      >
                        <Edit2 className="w-4 h-4 text-amber-100" aria-hidden="true" />
                      </button>
                    )}
                  </div>
                  <p className="text-amber-100">{getLevelTitle(currentLevel)}</p>
                </div>
              </div>
              {isEditingUsername && (
                <div className="flex items-center gap-2">
                  <button onClick={handleSaveUsername} className="px-3 py-1.5 bg-white text-amber-600 rounded-xl text-sm font-medium hover:bg-amber-50 transition-colors">Salvar</button>
                  <button onClick={() => { setIsEditingUsername(false); setEditUsername(gameProfile?.username || ""); setUsernameError(""); }} className="px-3 py-1.5 text-amber-100 hover:text-white transition-colors">Cancelar</button>
                </div>
              )}
            </div>
          </div>

          <div className="p-6 space-y-6">
            {/* Username Editor (when editing) */}
            {isEditingUsername && usernameError && (
              <p className="text-red-400 text-sm">{usernameError}</p>
            )}

            {/* XP Progress Bar */}
            <div>
              <div className="flex items-center justify-between text-sm mb-2">
                <span className="text-zinc-400">Progresso para próximo nível</span>
                <span className="font-medium text-white">
                  {xpInCurrentLevel.toLocaleString("pt-BR")} / {xpNeededForLevel.toLocaleString("pt-BR")} XP
                </span>
              </div>
              <div className="w-full h-3 bg-zinc-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-amber-500 to-amber-400 rounded-full transition-all duration-500"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              <p className="text-xs text-zinc-500 mt-1">
                Faltam {xpForNextLevel.toLocaleString("pt-BR")} XP para o nível {currentLevel + 1}
              </p>
            </div>

            {/* Pending XP */}
            {pendingXP > 0 && (
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 flex items-center gap-3">
                <TrendingUp className="w-5 h-5 text-amber-500" aria-hidden="true" />
                <div>
                  <p className="font-medium text-amber-400">XP Pendente</p>
                  <p className="text-sm text-amber-500">{pendingXP} XP aguardando confirmação da comunidade</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Stat Cards */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          {/* Pontos (Total XP) */}
          <button onClick={onClose} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 transition-all hover:border-zinc-700">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-amber-500/10 flex items-center justify-center">
                <Trophy className="w-6 h-6 text-amber-500" aria-hidden="true" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-zinc-500 uppercase tracking-wider">Pontos</p>
                <p className="text-xl font-bold text-white truncate">
                  {currentXP.toLocaleString("pt-BR")} XP
                </p>
              </div>
            </div>
            <p className="text-xs text-zinc-500 mt-2 flex items-center gap-1">
              <Target className="w-3 h-3" aria-hidden="true" />
              Ranking geral
            </p>
          </button>

          {/* Conquistas (Badges Earned) */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-purple-500/10 flex items-center justify-center">
                <Award className="w-6 h-6 text-purple-500" aria-hidden="true" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-zinc-500 uppercase tracking-wider">Conquistas</p>
                <p className="text-xl font-bold text-white truncate">
                  {earnedBadgesCount} / {totalBadgesCount}
                </p>
              </div>
            </div>
            <p className="text-xs text-zinc-500 mt-2 flex items-center gap-1">
              <Sparkles className="w-3 h-3" aria-hidden="true" />
              Medalhas desbloqueadas
            </p>
          </div>

          {/* Ocorrências (Reports Sent) */}
          <button onClick={onClose} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 transition-all hover:border-zinc-700">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-green-500/10 flex items-center justify-center">
                <Flag className="w-6 h-6 text-green-500" aria-hidden="true" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-zinc-500 uppercase tracking-wider">Ocorrências</p>
                <p className="text-xl font-bold text-white truncate">
                  {reportsCount}
                </p>
              </div>
            </div>
            <p className="text-xs text-zinc-500 mt-2 flex items-center gap-1">
              <MapPin className="w-3 h-3" aria-hidden="true" />
              Reportes enviados
            </p>
          </button>
        </div>

        {/* Category Progress Section */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 mb-6">
          <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <Target className="w-5 h-5 text-amber-500" aria-hidden="true" />
            Progresso por Categoria
          </h2>
          <div className="space-y-4">
            {DISPLAY_CATEGORIES.map((categoryKey) => {
              const catConfig = CATEGORY_CONFIG[categoryKey];
              const progress = categoryProgress[categoryKey] || { count: 0, resolved: 0 };
              const total = progress.count;
              const resolved = progress.resolved;
              const percent = total > 0 ? Math.round((resolved / total) * 100) : 0;

              return (
                <div key={categoryKey} className="group">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl" aria-hidden="true">{catConfig.icon}</span>
                      <div>
                        <p className="font-medium text-white">{catConfig.label}</p>
                        <p className="text-xs text-zinc-500">
                          {total} reporte{total !== 1 ? "s" : ""} • {resolved} resolvido{resolved !== 1 ? "s" : ""}
                        </p>
                      </div>
                    </div>
                    <span className="text-sm font-bold text-amber-400">{percent}%</span>
                  </div>
                  <div className="w-full h-2 bg-zinc-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-amber-500 to-amber-400 rounded-full transition-all duration-500"
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Badges Section */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
          <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <Award className="w-5 h-5 text-amber-500" aria-hidden="true" />
            Medalhas
          </h2>

          {Object.entries(badgesByCategory).map(([category, badges]) => (
            <div key={category} className="mb-6 last:mb-0">
              <h3 className="text-sm font-semibold text-zinc-500 uppercase tracking-wider mb-3">
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
                          ? "bg-amber-500/10 border border-amber-500/20"
                          : "bg-zinc-800 border border-zinc-700 opacity-60 grayscale"
                      }`}
                      disabled={!isEarned}
                    >
                      <span className="text-3xl block mb-2">{badge.icon}</span>
                      <span className={`text-sm font-medium ${isEarned ? "text-white" : "text-zinc-500"}`}>
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
      </main>

      {/* Badge Detail Modal */}
      {showBadgeDetail && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl shadow-xl max-w-md w-full p-6 animate-pop-in relative">
            <button
              onClick={() => setShowBadgeDetail(null)}
              className="absolute top-3 right-3 p-1 rounded-lg hover:bg-zinc-800 transition-colors"
              aria-label="Fechar"
            >
              <X className="w-5 h-5 text-zinc-400" />
            </button>

            <div className="text-center">
              <span className="text-6xl mb-3 block">{showBadgeDetail.icon}</span>
              <h3 className="text-xl font-bold text-white mb-1">{showBadgeDetail.name}</h3>
              <p className="text-zinc-400 mb-4">{showBadgeDetail.description}</p>

              {userBadges.includes(showBadgeDetail.code) ? (
                <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-4 text-green-400">
                  <CheckCircle className="w-5 h-5 mx-auto mb-2" aria-hidden="true" />
                  <p className="font-medium">Conquistada!</p>
                  <p className="text-sm">+{showBadgeDetail.xp_reward} XP</p>
                </div>
              ) : (
                <div className="bg-zinc-800 border border-zinc-700 rounded-xl p-4 text-zinc-400">
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