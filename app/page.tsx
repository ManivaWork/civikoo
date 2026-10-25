"use client";

import { useEffect, useState, useCallback, Suspense } from "react";
import dynamic from "next/dynamic";
import { TopUserPanel } from "./components/ui/TopUserPanel";
import { NewReportFab } from "./components/ui/NewReportFab";
import { NewReportModal } from "./components/ui/NewReportModal";
import type { Report, UserProfile } from "./components/map/types";

const MapView = dynamic(() => import("./components/map/MapView").then((mod) => mod.MapView), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full bg-zinc-100 dark:bg-zinc-900 flex items-center justify-center">
      <div className="w-12 h-12 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
    </div>
  ),
});

// Mock data for demonstration
const mockReports: Report[] = [
  {
    id: "1",
    creator_id: "user-1",
    latitude: -23.5505,
    longitude: -46.6333,
    category: "buraco_asfalto",
    title: "Grande buraco na Avenida Paulista",
    description: "Buraco de aproximadamente 50cm de diâmetro causando risco a veículos e pedestres.",
    photo_url: "https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=800",
    photo_thumbnail_url: "https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=400",
    status: "ativo",
    confirmations_count: 3,
    denials_count: 0,
    score_awarded: 10,
    created_at: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
    updated_at: new Date().toISOString(),
    creator_username: "joaosilva",
    creator_avatar: undefined,
    creator_level: 5,
  },
  {
    id: "2",
    creator_id: "user-2",
    latitude: -23.5515,
    longitude: -46.6343,
    category: "lixo_entulho",
    title: "Acúmulo de lixo na calçada",
    description: "Muita lixeira transbordando e entulho de obra na calçada da Rua Augusta.",
    photo_url: "https://images.unsplash.com/photo-1532996122724-e3c354a0b15b?w=800",
    photo_thumbnail_url: "https://images.unsplash.com/photo-1532996122724-e3c354a0b15b?w=400",
    status: "em_analise",
    confirmations_count: 5,
    denials_count: 1,
    score_awarded: 10,
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
    updated_at: new Date().toISOString(),
    creator_username: "mariasouza",
    creator_avatar: undefined,
    creator_level: 3,
  },
  {
    id: "3",
    creator_id: "user-3",
    latitude: -23.5495,
    longitude: -46.6323,
    category: "iluminacao",
    title: "Poste apagado há 3 dias",
    description: "Poste de iluminação pública não acende há 3 noites, rua muito escura.",
    photo_url: "https://images.unsplash.com/photo-1519413026399-67d8a92c3d1b?w=800",
    photo_thumbnail_url: "https://images.unsplash.com/photo-1519413026399-67d8a92c3d1b?w=400",
    status: "resolvido",
    confirmations_count: 8,
    denials_count: 0,
    score_awarded: 10,
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 3).toISOString(),
    updated_at: new Date().toISOString(),
    creator_username: "carlosdev",
    creator_avatar: undefined,
    creator_level: 7,
  },
  {
    id: "4",
    creator_id: "user-4",
    latitude: -23.5525,
    longitude: -46.6353,
    category: "vazamento_agua",
    title: "Vazamento na tubulação principal",
    description: "Água jorrando do asfalto, possível rompimento de cano principal.",
    photo_url: "https://images.unsplash.com/photo-1558618047-3c8c76ca7d13?w=800",
    photo_thumbnail_url: "https://images.unsplash.com/photo-1558618047-3c8c76ca7d13?w=400",
    status: "em_andamento",
    confirmations_count: 12,
    denials_count: 0,
    score_awarded: 10,
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString(),
    updated_at: new Date().toISOString(),
    creator_username: "anapereira",
    creator_avatar: undefined,
    creator_level: 4,
  },
  {
    id: "5",
    creator_id: "user-5",
    latitude: -23.5485,
    longitude: -46.6313,
    category: "sinalizacao",
    title: "Placa de pare derrubada",
    description: "Placa de sinalização de pare foi derrubada, cruzamento perigoso.",
    photo_url: "https://images.unsplash.com/photo-1449824913935-59a10b8d2000?w=800",
    photo_thumbnail_url: "https://images.unsplash.com/photo-1449824913935-59a10b8d2000?w=400",
    status: "ativo",
    confirmations_count: 2,
    denials_count: 0,
    score_awarded: 10,
    created_at: new Date(Date.now() - 1000 * 60 * 60).toISOString(),
    updated_at: new Date().toISOString(),
    creator_username: "robertocosta",
    creator_avatar: undefined,
    creator_level: 2,
  },
];

const mockUser: UserProfile = {
  id: "current-user",
  username: "voce",
  full_name: "Você",
  avatar_url: null,
  level: 4,
  total_score: 1250,
  current_streak: 7,
  longest_streak: 15,
};

export default function Home() {
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [reports, setReports] = useState<Report[]>(mockReports);
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);

  // Get user location on mount
  useEffect(() => {
    if (!navigator.geolocation) return;

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setUserLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
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
      },
      (error) => console.warn("Watch position error:", error),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

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
    setIsLoading(true);
    // Simulate API call
    setTimeout(() => {
      setIsLoading(false);
    }, 1000);
  }, []);

  const handleVerify = useCallback(async (reportId: string, type: "confirmacao" | "negacao") => {
    setReports((prev) =>
      prev.map((r) =>
        r.id === reportId
          ? {
              ...r,
              confirmations_count: type === "confirmacao" ? r.confirmations_count + 1 : r.confirmations_count,
              denials_count: type === "negacao" ? r.denials_count + 1 : r.denials_count,
            }
          : r
      )
    );
    // TODO: Call Supabase API
  }, []);

  const handleNavigate = useCallback((report: Report) => {
    // Open in maps app or show detailed view
    const url = `https://www.google.com/maps/dir/?api=1&destination=${report.latitude},${report.longitude}`;
    window.open(url, "_blank");
  }, []);

  const handleOpenReport = useCallback(() => {
    setIsReportModalOpen(true);
  }, []);

  const handleReportCreated = useCallback(() => {
    // Refresh reports or show success feedback
    handleRefresh();
  }, [handleRefresh]);

  return (
    <div className="relative w-full h-screen bg-zinc-50 dark:bg-zinc-950 overflow-hidden">
      {/* Map */}
      <Suspense fallback={
        <div className="w-full h-full bg-zinc-100 dark:bg-zinc-900 flex items-center justify-center">
          <div className="w-12 h-12 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
        </div>
      }>
        <MapView
          reports={reports}
          userProfile={mockUser}
          userLocation={userLocation}
          onReportSelect={setSelectedReport}
          onVerify={handleVerify}
          onNavigate={handleNavigate}
          onLocateUser={handleLocateUser}
          onRefresh={handleRefresh}
        />
      </Suspense>

      {/* Top User Panel */}
      <TopUserPanel
        level={mockUser.level}
        totalScore={mockUser.total_score}
        currentStreak={mockUser.current_streak}
      />

      {/* FAB */}
      <NewReportFab onOpenReport={handleOpenReport} userLocation={userLocation} />

      {/* New Report Modal */}
      <NewReportModal
        isOpen={isReportModalOpen}
        onClose={() => setIsReportModalOpen(false)}
        userLocation={userLocation}
        onReportCreated={handleReportCreated}
      />

      {/* Loading overlay */}
      {isLoading && (
        <div className="fixed inset-0 bg-white/50 dark:bg-zinc-950/50 backdrop-blur-sm z-40 flex items-center justify-center">
          <div className="w-12 h-12 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
        </div>
      )}
    </div>
  );
}