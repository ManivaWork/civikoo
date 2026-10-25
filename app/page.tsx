"use client";

import { useEffect, useState, useCallback, Suspense } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { MapPin, LogIn, UserPlus, Filter } from "lucide-react";
import { TopUserPanel } from "./components/ui/TopUserPanel";
import { ToastContainer } from "./components/ui/Toast";
import { FirstReportWarning } from "./components/ui/FirstReportWarning";
import { ReportBottomSheet } from "./components/ui/ReportBottomSheet";
import { FilterBottomSheet } from "./components/ui/FilterBottomSheet";
import { SessionProvider, useSession } from "@/lib/auth";
import type { Report, UserProfile, ReportCategory, ReportStatus } from "./components/map/types";
import { REPORT_BASE_XP, CATEGORY_DISPLAY_POINTS } from "./components/map/types";
import { createClient } from "@/lib/supabase/client";
import { fetchReportsInBounds } from "@/lib/supabase/client";

const MapView = dynamic(() => import("./components/map/MapView").then((mod) => mod.MapView), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full bg-zinc-100 dark:bg-zinc-900 flex items-center justify-center">
      <div className="w-12 h-12 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
    </div>
  ),
});

// Mock data for demonstration (fallback when Supabase not configured) - NEW SCHEMA
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

const DEFAULT_FILTERS = {
  categories: [] as ReportCategory[],
  statuses: ["ativo", "em_analise"] as ReportStatus[],
  onlyMine: false,
  period: "30d" as "7d" | "30d" | "all",
  nearMe: null as { enabled: boolean; radius: number } | null,
};

function HomeContent() {
  const { user, loading: authLoading } = useSession();
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [userAccuracy, setUserAccuracy] = useState<number | null>(null);
  const [reports, setReports] = useState<Report[]>(mockReports);
  const [isReportSheetOpen, setIsReportSheetOpen] = useState(false);
  const [isFilterSheetOpen, setIsFilterSheetOpen] = useState(false);
  const [isFetchingReports, setIsFetchingReports] = useState(false);
  const [totalReports, setTotalReports] = useState(0);
  const [filteredReportsCount, setFilteredReportsCount] = useState(0);
  const [mapBounds, setMapBounds] = useState<{ minLat: number; minLng: number; maxLat: number; maxLng: number } | null>(null);
  const [viewportReports, setViewportReports] = useState<Report[]>([]);
  const [hasLoadedViewport, setHasLoadedViewport] = useState(false);
  const [filters, setFilters] = useState(DEFAULT_FILTERS);

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

  // Fetch reports from Supabase when user location is available (initial load)
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

  // Fetch reports when location changes (initial load only)
  useEffect(() => {
    if (userLocation) {
      fetchInitialReports();
    }
  }, [fetchInitialReports]);

  // Handle map bounds change - trigger viewport-based loading
  const handleMapBoundsChange = useCallback(async (bounds: { minLat: number; minLng: number; maxLat: number; maxLng: number } | null) => {
    if (!bounds || !userLocation) return;

    setMapBounds(bounds);

    // Don't fetch if using mock data
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!supabaseUrl || !supabaseAnonKey) return;

    try {
      // Convert period to days
      let sinceDays: number | undefined;
      if (filters.period === "7d") sinceDays = 7;
      else if (filters.period === "30d") sinceDays = 30;
      else if (filters.period === "all") sinceDays = undefined;

      // Build categories array (empty means all)
      const categories = filters.categories.length > 0 ? filters.categories : undefined;
      const statuses = filters.statuses.length > 0 ? filters.statuses : undefined;

      // Handle nearMe filter - adjust bounds if enabled
      let fetchBounds = bounds;
      if (filters.nearMe?.enabled) {
        const radiusDeg = filters.nearMe.radius / 111000; // approximate degrees
        fetchBounds = {
          minLat: userLocation.lat - radiusDeg,
          minLng: userLocation.lng - radiusDeg,
          maxLat: userLocation.lat + radiusDeg,
          maxLng: userLocation.lng + radiusDeg,
        };
      }

      const data = await fetchReportsInBounds({
        minLat: fetchBounds.minLat,
        minLng: fetchBounds.minLng,
        maxLat: fetchBounds.maxLat,
        maxLng: fetchBounds.maxLng,
        categories,
        statuses,
        userId: filters.onlyMine ? user?.id : undefined,
        onlyMine: filters.onlyMine,
        sinceDays,
        limit: 500,
      });

      // Transform data to Report type
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
        updated_at: r.updated_at,
        creator_username: r.creator_username,
        creator_avatar: r.creator_avatar,
        creator_level: r.creator_level,
        resolved_at: r.resolved_at,
        user_has_confirmed_continua: false,
        user_has_confirmed_resolvido: false,
      }));

      setViewportReports(formattedReports);
      setFilteredReportsCount(formattedReports.length);
      setHasLoadedViewport(true);
    } catch (err) {
      console.error("Failed to fetch viewport reports:", err);
    }
  }, [userLocation, filters, user]);

  // Fetch user's confirmations for each report (to disable buttons)
  const fetchUserConfirmations = useCallback(async (reportIds: string[]) => {
    if (!user || reportIds.length === 0) return;

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) return;

    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("report_confirmations")
        .select("report_id, type")
        .in("report_id", reportIds)
        .eq("user_id", user.id);

      if (error) {
        console.error("Error fetching user confirmations:", error);
        return;
      }

      if (data) {
        // Update both reports arrays
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
      // Also trigger viewport refresh
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
    setIsReportSheetOpen(true);
  }, [user]);

  const handleCloseReportSheet = useCallback(() => {
    setIsReportSheetOpen(false);
  }, []);

  const handleOpenFilterSheet = useCallback(() => {
    setIsFilterSheetOpen(true);
  }, []);

  const handleCloseFilterSheet = useCallback(() => {
    setIsFilterSheetOpen(false);
  }, []);

  const handleFiltersChange = useCallback((newFilters: typeof filters) => {
    setFilters(newFilters);
    // Trigger immediate viewport refresh with new filters
    if (mapBounds) {
      handleMapBoundsChange(mapBounds);
    }
  }, [mapBounds, handleMapBoundsChange]);

  const isLoggedIn = !!user;
  const hasActiveFilters = filters.categories.length > 0 ||
    filters.statuses.length !== 2 ||
    filters.onlyMine ||
    filters.period !== "30d" ||
    filters.nearMe !== null;

  // Show loading while auth is loading
  if (authLoading) {
    return (
      <div className="relative w-full h-screen bg-zinc-50 dark:bg-zinc-950 overflow-hidden">
        <Suspense fallback={
          <div className="w-full h-full bg-zinc-100 dark:bg-zinc-900 flex items-center justify-center">
            <div className="w-12 h-12 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
          </div>
        }>
          <MapView
            reports={filteredReports}
            userProfile={mockUser}
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
        <div className="fixed inset-0 bg-white/50 dark:bg-zinc-950/50 backdrop-blur-sm z-40 flex items-center justify-center">
          <div className="w-12 h-12 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-screen bg-zinc-50 dark:bg-zinc-950 overflow-hidden">
      {/* Map */}
      <Suspense fallback={
        <div className="w-full h-full bg-zinc-100 dark:bg-zinc-900 flex items-center justify-center">
          <div className="w-12 h-12 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
        </div>
      }>
        <MapView
          reports={filteredReports}
          userProfile={mockUser}
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

      {/* Top User Panel - only for logged in users */}
      {isLoggedIn && (
        <TopUserPanel
          level={mockUser.level}
          totalScore={mockUser.total_score}
          currentStreak={mockUser.streak_count}
        />
      )}

      {/* Filter Button */}
      {isLoggedIn && (
        <button
          onClick={handleOpenFilterSheet}
          className={`fixed top-4 right-4 z-20 px-3 py-2 rounded-xl text-sm font-medium transition-colors flex items-center gap-2 shadow-lg ${
            hasActiveFilters
              ? "bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800"
              : "bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700"
          }`}
          aria-label="Abrir filtros"
        >
          <Filter className="w-4 h-4" />
          <span>Filtros</span>
          {hasActiveFilters && (
            <span className="w-4 h-4 bg-amber-500 text-white text-xs rounded-full flex items-center justify-center">
              ●
            </span>
          )}
        </button>
      )}

      {/* FAB for new report - only for logged in users */}
      {isLoggedIn ? (
        null
      ) : (
        // Prompt for visitors
        <div className="fixed bottom-6 right-6 left-6 md:left-auto md:right-6 md:w-96 z-30">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-xl border border-zinc-200 dark:border-zinc-800 p-5">
            <div className="flex items-start gap-3">
              <div className="shrink-0 w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                <MapPin className="w-5 h-5 text-amber-600 dark:text-amber-400" aria-hidden="true" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-zinc-900 dark:text-white text-sm">
                  Quer reportar um problema?
                </h3>
                <p className="text-zinc-600 dark:text-zinc-400 text-sm mt-1">
                  Faça login ou cadastre-se para enviar reportes e ganhar recompensas.
                </p>
                <div className="flex flex-col sm:flex-row gap-2 mt-4">
                  <Link
                    href="/login"
                    className="flex-1 px-4 py-2.5 text-center text-sm font-medium text-white bg-amber-500 hover:bg-amber-600 rounded-xl transition-colors flex items-center justify-center gap-2"
                  >
                    <LogIn className="w-4 h-4" aria-hidden="true" />
                    Entrar
                  </Link>
                  <Link
                    href="/cadastro"
                    className="flex-1 px-4 py-2.5 text-center text-sm font-medium text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 hover:bg-amber-100 dark:hover:bg-amber-900/30 rounded-xl transition-colors border border-amber-200 dark:border-amber-800 flex items-center justify-center gap-2"
                  >
                    <UserPlus className="w-4 h-4" aria-hidden="true" />
                    Cadastrar
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Report Bottom Sheet */}
      <ReportBottomSheet
        isOpen={isReportSheetOpen}
        onClose={handleCloseReportSheet}
        initialPosition={userLocation}
      />

      {/* Filter Bottom Sheet */}
      <FilterBottomSheet
        isOpen={isFilterSheetOpen}
        onClose={handleCloseFilterSheet}
        filters={filters}
        onFiltersChange={handleFiltersChange}
        userLocation={userLocation}
        totalReports={totalReports}
        filteredReports={filteredReportsCount || filteredReports.length}
      />

      {/* Toast notifications */}
      <ToastContainer />

      {/* First report warning */}
      <FirstReportWarning onDismiss={() => {}} />

      {/* Loading overlay */}
      {isFetchingReports && (
        <div className="fixed inset-0 bg-white/50 dark:bg-zinc-950/50 backdrop-blur-sm z-40 flex items-center justify-center">
          <div className="w-12 h-12 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
        </div>
      )}
    </div>
  );
}

export default function Home() {
  return (
    <SessionProvider>
      <HomeContent />
    </SessionProvider>
  );
}