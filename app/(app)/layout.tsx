"use client";

import { useState, useCallback, Suspense, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import dynamic from "next/dynamic";
import { MapPin, MessageSquare, Trophy, User, Bell, Store, Shirt, Target, RotateCcw, Map, X, ChevronDown, ChevronUp } from "lucide-react";
import { useSession } from "@/lib/auth";
import { ReportBottomSheet } from "@/app/components/ui/ReportBottomSheet";
import { ToastContainer } from "@/app/components/ui/Toast";
import { FirstReportWarning } from "@/app/components/ui/FirstReportWarning";
import { BottomNavigation } from "@/app/components/ui/BottomNavigation";
import type { Report, UserProfile, ReportCategory, ReportStatus } from "@/app/components/map/types";
import { createClient } from "@/lib/supabase/client";
import { fetchReportsInBounds } from "@/lib/supabase/client";
import { REPORT_BASE_XP, CATEGORY_DISPLAY_POINTS } from "@/app/components/map/types";

const MapView = dynamic(() => import("@/app/components/map/MapView").then((mod) => mod.MapView), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full bg-zinc-100 dark:bg-zinc-900 flex items-center justify-center">
      <div className="w-12 h-12 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
    </div>
  ),
});

// Panel components - loaded dynamically
const FeedPanel = dynamic(() => import("@/app/(app)/panels/FeedPanel").then((mod) => mod.FeedPanel), {
  ssr: false,
  loading: () => <div className="h-full flex items-center justify-center"><div className="w-10 h-10 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" /></div>,
});

const RankingPanel = dynamic(() => import("@/app/(app)/panels/RankingPanel").then((mod) => mod.RankingPanel), {
  ssr: false,
  loading: () => <div className="h-full flex items-center justify-center"><div className="w-10 h-10 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" /></div>,
});

const PerfilPanel = dynamic(() => import("@/app/(app)/panels/PerfilPanel").then((mod) => mod.PerfilPanel), {
  ssr: false,
  loading: () => <div className="h-full flex items-center justify-center"><div className="w-10 h-10 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" /></div>,
});

const NotificacoesPanel = dynamic(() => import("@/app/(app)/panels/NotificacoesPanel").then((mod) => mod.NotificacoesPanel), {
  ssr: false,
  loading: () => <div className="h-full flex items-center justify-center"><div className="w-10 h-10 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" /></div>,
});

const LojaPanel = dynamic(() => import("@/app/(app)/panels/LojaPanel").then((mod) => mod.LojaPanel), {
  ssr: false,
  loading: () => <div className="h-full flex items-center justify-center"><div className="w-10 h-10 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" /></div>,
});

const ArmarioPanel = dynamic(() => import("@/app/(app)/panels/ArmarioPanel").then((mod) => mod.ArmarioPanel), {
  ssr: false,
  loading: () => <div className="h-full flex items-center justify-center"><div className="w-10 h-10 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" /></div>,
});

const MissoesPanel = dynamic(() => import("@/app/(app)/panels/MissoesPanel").then((mod) => mod.MissoesPanel), {
  ssr: false,
  loading: () => <div className="h-full flex items-center justify-center"><div className="w-10 h-10 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" /></div>,
});

// Mock data for demonstration (fallback when Supabase not configured)
const mockReports: Report[] = [
  {
    id: "1",
    user_id: "user-1",
    latitude: -23.5505,
    longitude: -46.6333,
    category: "buraco_asfalto",
    title: "Grande buraco na Avenida Paulista",
    description: "Buraco de aproximadamente 50cm de diâmetro causando risco a veículos e pedestres.",
    photo_url: "https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=800",
    photo_thumbnail_url: "https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=400",
    image_url: "https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=800",
    status: "ativo",
    confirmations_continua: 2,
    confirmations_resolvido: 0,
    created_at: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
    updated_at: new Date().toISOString(),
    creator_username: "joaosilva",
    creator_avatar: undefined,
    creator_level: 5,
    distance_m: 150,
  },
  {
    id: "2",
    user_id: "user-2",
    latitude: -23.5515,
    longitude: -46.6343,
    category: "vazamento_agua",
    title: "Vazamento na tubulação principal",
    description: "Água jorrando do asfalto, possível rompimento de cano principal.",
    photo_url: "https://images.unsplash.com/photo-1558618047-3c8c76ca7d13?w=800",
    photo_thumbnail_url: "https://images.unsplash.com/photo-1558618047-3c8c76ca7d13?w=400",
    image_url: "https://images.unsplash.com/photo-1558618047-3c8c76ca7d13?w=800",
    status: "em_analise",
    confirmations_continua: 4,
    confirmations_resolvido: 0,
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
    updated_at: new Date().toISOString(),
    creator_username: "mariasouza",
    creator_avatar: undefined,
    creator_level: 3,
    distance_m: 200,
  },
  {
    id: "3",
    user_id: "user-3",
    latitude: -23.5495,
    longitude: -46.6323,
    category: "sinalizacao",
    title: "Placa de pare derrubada",
    description: "Placa de sinalização de pare foi derrubada, cruzamento perigoso.",
    photo_url: "https://images.unsplash.com/photo-1449824913935-59a10b8d2000?w=800",
    photo_thumbnail_url: "https://images.unsplash.com/photo-1449824913935-59a10b8d2000?w=400",
    image_url: "https://images.unsplash.com/photo-1449824913935-59a10b8d2000?w=800",
    status: "resolvido",
    confirmations_continua: 3,
    confirmations_resolvido: 2,
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 3).toISOString(),
    updated_at: new Date().toISOString(),
    creator_username: "carlosdev",
    creator_avatar: undefined,
    creator_level: 7,
    distance_m: 100,
    resolved_at: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
  },
  {
    id: "4",
    user_id: "user-4",
    latitude: -23.5525,
    longitude: -46.6353,
    category: "acessibilidade",
    title: "Rampa de acessibilidade quebrada",
    description: "Rampa para cadeirantes danificada, impossibilita acesso.",
    photo_url: "https://images.unsplash.com/photo-1519413026399-67d8a92c3d1b?w=800",
    photo_thumbnail_url: "https://images.unsplash.com/photo-1519413026399-67d8a92c3d1b?w=400",
    image_url: "https://images.unsplash.com/photo-1519413026399-67d8a92c3d1b?w=800",
    status: "em_analise",
    confirmations_continua: 8,
    confirmations_resolvido: 1,
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString(),
    updated_at: new Date().toISOString(),
    creator_username: "anapereira",
    creator_avatar: undefined,
    creator_level: 4,
    distance_m: 300,
  },
  {
    id: "5",
    user_id: "user-5",
    latitude: -23.5485,
    longitude: -46.6313,
    category: "buraco_asfalto",
    title: "Buraco perigoso na faixa de pedestres",
    description: "Buraco na faixa de pedestres, risco de queda.",
    photo_url: "https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=800",
    photo_thumbnail_url: "https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=400",
    image_url: "https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=800",
    status: "ativo",
    confirmations_continua: 1,
    confirmations_resolvido: 0,
    created_at: new Date(Date.now() - 1000 * 60 * 60).toISOString(),
    updated_at: new Date().toISOString(),
    creator_username: "robertocosta",
    creator_avatar: undefined,
    creator_level: 2,
    distance_m: 50,
  },
];

const mockUser: UserProfile = {
  id: "current-user",
  username: "voce",
  full_name: "Você",
  avatar_url: null,
  level: 4,
  xp: 1250,
  coins: 50,
  total_score: 1250,
  streak_count: 7,
  best_streak: 15,
  last_active_date: null,
  title: "Cidadão Ativo",
  equipped: {},
};

// UUID validation regex
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isValidUuid(id: string): boolean {
  return UUID_REGEX.test(id);
}

const DEFAULT_FILTERS = {
  categories: [] as ReportCategory[],
  statuses: ["ativo", "em_analise"] as ReportStatus[],
  onlyMine: false,
  period: "30d" as "7d" | "30d" | "all",
  nearMe: null as { enabled: boolean; radius: number } | null,
};

// Category display names mapping
const CATEGORY_LABELS: Record<ReportCategory, string> = {
  buraco_asfalto: "Buraco no asfalto",
  lixo_entulho: "Lixo e entulho",
  iluminacao: "Iluminação",
  sinalizacao: "Sinalização",
  acessibilidade: "Acessibilidade",
  vazamento_agua: "Vazamento de água",
  vegetacao: "Vegetação",
  mobiliario_urbano: "Mobiliário urbano",
  outro: "Outro",
};

function getXpForNextLevel(level: number): number {
  return level * level * 100;
}

// Convert GameProfile (from auth) to UserProfile (for MapView)
function toUserProfile(profile: any): UserProfile | null {
  if (!profile) return null;
  return {
    id: profile.id,
    username: profile.username,
    full_name: profile.full_name,
    avatar_url: profile.avatar_url,
    level: profile.level,
    xp: profile.xp ?? profile.total_score,
    coins: profile.coins,
    total_score: profile.total_score,
    streak_count: profile.current_streak ?? profile.streak_count ?? 0,
    best_streak: profile.longest_streak ?? profile.best_streak ?? 0,
    last_active_date: profile.last_active_date ?? null,
    title: profile.title,
    equipped: profile.equipped,
    created_at: profile.created_at,
  };
}

function TopBar({ profile, userLocation }: { profile: UserProfile | null; userLocation: { lat: number; lng: number } | null }) {
  // Always render top bar, show placeholder if no profile
  const xpForNextLevel = profile ? getXpForNextLevel(profile.level) : 100;
  const xpProgress = profile ? (profile.total_score % xpForNextLevel) / xpForNextLevel : 0;

  return (
    <header className="absolute top-0 left-0 right-0 z-40 bg-zinc-950/95 backdrop-blur-xl border-b border-zinc-800 navbar-safe">
      <div className="max-w-[430px] mx-auto px-4 h-16 flex items-center justify-between w-full">
        {/* Left: Logo + Location */}
        <Link href="/" className="flex items-center gap-3" aria-label="Civikoo - Início">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center">
            <Map className="w-5 h-5 text-white" aria-hidden="true" />
          </div>
          <div className="hidden sm:block">
            <h1 className="text-lg font-bold text-white">Civikoo</h1>
            <p className="text-xs text-zinc-500 truncate max-w-[160px]">
              {userLocation
                ? `${userLocation.lat.toFixed(4)}, ${userLocation.lng.toFixed(4)}`
                : "Carregando localização..."}
            </p>
          </div>
        </Link>

        {/* Right: Level/XP/Coins + Avatar */}
        <div className="flex items-center gap-3">
          {profile ? (
            <>
              {/* XP Bar + Level + Coins */}
              <div className="hidden md:flex items-center gap-4 pr-2">
                {/* Level */}
                <div className="flex items-center gap-2 bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-1.5">
                  <div className="relative flex items-center justify-center w-7 h-7 rounded-full bg-amber-500/20">
                    <span className="text-xs font-bold text-amber-400">{profile.level}</span>
                  </div>
                </div>
                {/* XP Progress */}
                <div className="relative w-32 h-2 bg-zinc-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-amber-500 to-amber-400 rounded-full transition-all duration-500"
                    style={{ width: `${xpProgress * 100}%` }}
                  />
                </div>
                {/* Coins */}
                <div className="flex items-center gap-1.5 bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-1.5">
                  <span className="text-amber-400 text-sm font-bold">{profile.coins}</span>
                  <span className="text-zinc-500 text-xs">moedas</span>
                </div>
              </div>

              {/* Avatar Button */}
              <Link
                href="/perfil"
                className="relative w-10 h-10 rounded-xl bg-zinc-900 border border-zinc-800 overflow-hidden flex items-center justify-center hover:border-zinc-700 transition-colors"
                aria-label="Meu perfil"
              >
                {profile.avatar_url ? (
                  <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-amber-500 to-amber-600">
                    <span className="text-white font-bold text-lg">
                      {profile.username?.charAt(0).toUpperCase() || "?"}
                    </span>
                  </div>
                )}
                {/* Level badge on avatar */}
                <span className="absolute -bottom-1 -right-1 w-5 h-5 bg-amber-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-zinc-950">
                  {profile.level}
                </span>
              </Link>
            </>
          ) : (
            // Placeholder when profile not loaded yet
            <div className="flex items-center gap-3">
              <div className="hidden md:flex items-center gap-4 pr-2 text-zinc-600 dark:text-zinc-400">
                <div className="flex items-center gap-2 bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-1.5">
                  <div className="relative flex items-center justify-center w-7 h-7 rounded-full bg-zinc-800">
                    <span className="text-xs font-bold text-zinc-500">–</span>
                  </div>
                </div>
                <div className="relative w-32 h-2 bg-zinc-800 rounded-full overflow-hidden">
                  <div className="h-full bg-zinc-700 rounded-full animate-pulse" style={{ width: '50%' }} />
                </div>
                <div className="flex items-center gap-1.5 bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-1.5">
                  <span className="text-zinc-500 text-sm font-bold">–</span>
                  <span className="text-zinc-500 text-xs">moedas</span>
                </div>
              </div>
              <div className="relative w-10 h-10 rounded-xl bg-zinc-900 border border-zinc-800 overflow-hidden flex items-center justify-center animate-pulse">
                <div className="w-full h-full flex items-center justify-center bg-zinc-800">
                  <span className="text-zinc-500 font-bold text-lg">?</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

// Tab configuration
const TABS = [
  { href: "/", icon: MapPin, label: "Mapa", activeIcon: MapPin },
  { href: "/feed", icon: MessageSquare, label: "Feed", activeIcon: MessageSquare },
  { href: "/ranking", icon: Trophy, label: "Ranking", activeIcon: Trophy },
  { href: "/loja", icon: Store, label: "Loja", activeIcon: Store },
  { href: "/perfil", icon: User, label: "Perfil", activeIcon: User },
] as const;

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, profile, loading: authLoading } = useSession();
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [userAccuracy, setUserAccuracy] = useState<number | null>(null);
  const [reports, setReports] = useState<Report[]>(mockReports);
  const [isReportSheetOpen, setIsReportSheetOpen] = useState(false);
  const [isFetchingReports, setIsFetchingReports] = useState(false);
  const [totalReports, setTotalReports] = useState(0);
  const [filteredReportsCount, setFilteredReportsCount] = useState(0);
  const [mapBounds, setMapBounds] = useState<{ minLat: number; minLng: number; maxLat: number; maxLng: number } | null>(null);
  const [viewportReports, setViewportReports] = useState<Report[]>([]);
  const [hasLoadedViewport, setHasLoadedViewport] = useState(false);
  const [activePanel, setActivePanel] = useState<string | null>(null);

  // Stable filters reference
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const filtersRef = { current: filters };
  filtersRef.current = filters;

  // Determine active panel based on pathname
  const getActivePanel = useCallback((path: string) => {
    if (path === "/" || path === "") return null; // Map view - no panel
    const panelMap: Record<string, string> = {
      "/feed": "feed",
      "/ranking": "ranking",
      "/perfil": "perfil",
      "/notificacoes": "notificacoes",
      "/loja": "loja",
      "/armario": "armario",
      "/missoes": "missoes",
    };
    return panelMap[path] || null;
  }, []);

  // Update active panel when pathname changes
  useEffect(() => {
    setActivePanel(getActivePanel(pathname));
  }, [pathname, getActivePanel]);

  // Get user location on mount
  useEffect(() => {
    if (!navigator.geolocation) return;

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setUserLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
        setUserAccuracy(position.coords.accuracy);
      },
      (error) => {
        console.warn("Geolocation denied or unavailable:", error);
        // Default to São Paulo center
        setUserLocation({ lat: -23.5505, lng: -46.6333 });
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 300000 }
    );

    // Watch position for updates
    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        setUserLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
        setUserAccuracy(position.coords.accuracy);
      },
      (error) => console.warn("Watch position error:", error),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

  // Fetch reports from Supabase when user location is available - ONLY for new report flow
  const fetchInitialReports = useCallback(async () => {
    if (!userLocation) return;

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      console.log("Supabase not configured, using mock data");
      return;
    }

    setIsFetchingReports(true);
    try {
      const supabase = createClient();

      const { data, error } = await supabase.rpc("reports_nearby", {
        p_latitude: userLocation.lat,
        p_longitude: userLocation.lng,
        p_radius_meters: 2000, // 2km radius
      });

      if (error) {
        console.error("Error fetching reports:", error);
        return;
      }

      if (data && data.length > 0) {
        const formattedReports: Report[] = data.map((r: any) => ({
          id: r.id,
          user_id: r.user_id,
          latitude: r.latitude,
          longitude: r.longitude,
          category: r.category,
          title: r.title,
          description: r.description,
          photo_url: r.image_url || "",
          photo_thumbnail_url: r.image_url,
          image_url: r.image_url,
          status: r.status,
          confirmations_continua: r.confirmations_continua || 0,
          confirmations_resolvido: r.confirmations_resolvido || 0,
          created_at: r.created_at,
          updated_at: r.created_at,
          creator_username: r.creator_username,
          creator_avatar: r.creator_avatar,
          creator_level: r.creator_level,
          distance_m: r.distance_m,
          resolved_at: r.resolved_at,
          user_has_confirmed_continua: false,
          user_has_confirmed_resolvido: false,
        }));
        setReports(formattedReports);
        setTotalReports(formattedReports.length);
      }
    } catch (err) {
      console.error("Failed to fetch reports:", err);
    } finally {
      setIsFetchingReports(false);
    }
  }, [userLocation]);

  // Handle map bounds change - MapView handles fetching, we just update bounds
  const handleMapBoundsChange = useCallback((bounds: { minLat: number; minLng: number; maxLat: number; maxLng: number } | null) => {
    if (!bounds) return;
    setMapBounds(bounds);
  }, []);

  // Fetch user's confirmations for each report
  const fetchUserConfirmations = useCallback(async (reportIds: string[]) => {
    if (!user || reportIds.length === 0) return;

    const validReportIds = reportIds.filter(isValidUuid);
    if (validReportIds.length === 0) return;

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) return;

    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("report_confirmations")
        .select("report_id, type")
        .in("report_id", validReportIds)
        .eq("user_id", user.id);

      if (error) {
        console.error("Error fetching user confirmations:", error);
        return;
      }

      if (data) {
        const updateConfirmations = (prevReports: Report[]) =>
          prevReports.map((report) => {
            const userConfirmations = data.filter((c: any) => c.report_id === report.id);
            return {
              ...report,
              user_has_confirmed_continua: userConfirmations.some((c: any) => c.type === "continua"),
              user_has_confirmed_resolvido: userConfirmations.some((c: any) => c.type === "resolvido"),
            };
          });

        setReports(updateConfirmations);
        setViewportReports(updateConfirmations);
      }
    } catch (err) {
      console.error("Failed to fetch user confirmations:", err);
    }
  }, [user]);

  // Fetch user confirmations when reports or user changes
  useEffect(() => {
    const currentReports = hasLoadedViewport ? viewportReports : reports;
    if (user && currentReports.length > 0) {
      fetchUserConfirmations(currentReports.map((r) => r.id));
    }
  }, [user, reports, viewportReports, hasLoadedViewport, fetchUserConfirmations]);

  // Determine which reports to display
  const displayReports = hasLoadedViewport ? viewportReports : reports;
  const filteredReports = filters.statuses.includes("resolvido") ? displayReports : displayReports.filter((r) => r.status !== "resolvido");

  const handleLocateUser = useCallback(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setUserLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
      },
      (error) => console.warn("Locate error:", error),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, []);

  const handleRefresh = useCallback(() => {
    if (userLocation) {
      fetchInitialReports();
      if (mapBounds) {
        handleMapBoundsChange(mapBounds);
      }
    }
  }, [fetchInitialReports, userLocation, mapBounds, handleMapBoundsChange]);

  const handleVerify = useCallback(async (reportId: string, type: "continua" | "resolvido") => {
    setReports((prev: Report[]) =>
      prev.map((r): Report => {
        if (r.id !== reportId) return r;

        const updatedReport: Report = { ...r };

        if (type === "continua") {
          updatedReport.confirmations_continua = (r.confirmations_continua || 0) + 1;
          if (r.status === "ativo") {
            updatedReport.status = "em_analise";
          }
        } else if (type === "resolvido") {
          updatedReport.confirmations_resolvido = (r.confirmations_resolvido || 0) + 1;
          if (r.confirmations_resolvido + 1 >= 2) {
            updatedReport.status = "resolvido";
            updatedReport.resolved_at = new Date().toISOString();
          }
        }

        return updatedReport;
      })
    );
    setViewportReports((prev: Report[]) =>
      prev.map((r): Report => {
        if (r.id !== reportId) return r;
        const updatedReport: Report = { ...r };
        if (type === "continua") {
          updatedReport.confirmations_continua = (r.confirmations_continua || 0) + 1;
          if (r.status === "ativo") updatedReport.status = "em_analise";
        } else if (type === "resolvido") {
          updatedReport.confirmations_resolvido = (r.confirmations_resolvido || 0) + 1;
          if (r.confirmations_resolvido + 1 >= 2) {
            updatedReport.status = "resolvido";
            updatedReport.resolved_at = new Date().toISOString();
          }
        }
        return updatedReport;
      })
    );
  }, []);

  const handleNavigate = useCallback((report: Report) => {
    const url = `https://www.google.com/maps/dir/?api=1&destination=${report.latitude},${report.longitude}`;
    window.open(url, "_blank");
  }, []);

  const handleOpenReport = useCallback(() => {
    if (!user) return;
    fetchInitialReports();
    setIsReportSheetOpen(true);
  }, [user, fetchInitialReports]);

  const handleCloseReportSheet = useCallback(() => {
    setIsReportSheetOpen(false);
  }, []);

  const isLoggedIn = !!user;

  // Show loading while auth is loading - but still render shell with top/bottom bars
  if (authLoading) {
    return (
      <div className="relative flex flex-col w-full h-[100dvh] max-w-[430px] mx-auto transform-gpu bg-zinc-950" style={{ backgroundColor: '#0B0B10' }}>
        {/* Map area - flex:1, shows spinner */}
        <div className="flex-1 min-h-0 relative overflow-hidden">
          <div className="absolute inset-0 bg-zinc-950 flex items-center justify-center z-10">
            <div className="w-12 h-12 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
          </div>
        </div>
        {/* Bottom Navigation - always visible */}
        <BottomNavigation />
      </div>
    );
  }

  if (!isLoggedIn) {
    // Show login screen but keep bottom nav for consistency
    return (
      <div className="relative flex flex-col w-full h-[100dvh] max-w-[430px] mx-auto transform-gpu bg-zinc-950" style={{ backgroundColor: '#0B0B10' }}>
        {/* Map area - flex:1, shows login */}
        <div className="flex-1 min-h-0 relative overflow-hidden">
          <div className="absolute inset-0 flex items-center justify-center bg-zinc-950">
            <div className="text-center px-6">
              <MapPin className="w-20 h-20 text-zinc-700 mx-auto mb-6" aria-hidden="true" />
              <h1 className="text-2xl font-bold text-white mb-3">Faça login para continuar</h1>
              <p className="text-zinc-400 mb-8 max-w-md mx-auto">
                Você precisa estar logado para usar o Civikoo.
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
          </div>
        </div>
        {/* Bottom Navigation - always visible */}
        <BottomNavigation />
      </div>
    );
  }

  const userProfile = toUserProfile(profile) || mockUser;

  return (
    <div className="relative flex flex-col w-full h-[100dvh] max-w-[430px] mx-auto transform-gpu bg-zinc-950" style={{ backgroundColor: '#0B0B10' }}>
      {/* Map Area - takes remaining space, contains map + absolute overlays */}
      <div className="flex-1 min-h-0 relative overflow-hidden">
        {/* Persistent Map View - always mounted, fills the container */}
        <Suspense fallback={
          <div className="absolute inset-0 w-full h-full bg-zinc-950 flex items-center justify-center">
            <div className="w-12 h-12 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
          </div>
        }>
          <MapView
            reports={filteredReports}
            userProfile={userProfile}
            userLocation={userLocation}
            userAccuracy={userAccuracy}
            onVerify={handleVerify}
            onNavigate={handleNavigate}
            onLocateUser={handleLocateUser}
            onRefresh={handleRefresh}
            onNewReport={handleOpenReport}
            filters={filters}
            onBoundsChange={handleMapBoundsChange}
            totalReports={totalReports}
          />
        </Suspense>

        {/* Top Bar - always rendered for logged in users */}
        <TopBar profile={userProfile} userLocation={userLocation} />

        {/* First report warning - absolute positioned near top */}
        <FirstReportWarning onDismiss={() => {}} />

        {/* Loading overlay */}
        {isFetchingReports && (
          <div className="absolute inset-0 bg-white/50 dark:bg-zinc-950/50 backdrop-blur-sm z-40 flex items-center justify-center">
            <div className="w-12 h-12 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
          </div>
        )}
      </div>

      {/* Bottom Navigation - fixed height, always at bottom */}
      <BottomNavigation />

      {/* Overlay Panels - render on top of everything (fixed position via portal or high z-index) */}
      {activePanel === "feed" && <FeedPanel onClose={() => {}} />}
      {activePanel === "ranking" && <RankingPanel onClose={() => {}} />}
      {activePanel === "perfil" && <PerfilPanel onClose={() => {}} />}
      {activePanel === "notificacoes" && <NotificacoesPanel onClose={() => {}} />}
      {activePanel === "loja" && <LojaPanel onClose={() => {}} />}
      {activePanel === "armario" && <ArmarioPanel onClose={() => {}} />}
      {activePanel === "missoes" && <MissoesPanel onClose={() => {}} />}

      {/* Report Bottom Sheet - modal overlay */}
      <ReportBottomSheet
        isOpen={isReportSheetOpen}
        onClose={handleCloseReportSheet}
        initialPosition={userLocation}
      />

      {/* Toast notifications - top layer */}
      <ToastContainer />
    </div>
  );
}