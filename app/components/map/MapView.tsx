"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import dynamic from "next/dynamic";
import { MapContainer, TileLayer, useMapEvents, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { CustomMarker } from "./CustomMarker";
import { ReportPopup } from "./ReportPopup";
import { Locate, RefreshCw, Plus, Target, X, Map } from "lucide-react";
import type { Report, UserProfile } from "./types";
import { CATEGORY_CONFIG, REPORT_BASE_XP } from "./types";
import { fetchReportsInBounds } from "@/lib/supabase/client";

// Fix for Leaflet default marker images
import L from "leaflet";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";

// Dynamic import for react-leaflet-cluster (includes Leaflet.markercluster CSS)
const MarkerClusterGroup = dynamic(
  () => import("react-leaflet-cluster").then((mod) => mod.default),
  {
    ssr: false,
    loading: () => null,
  }
);

const DEFAULT_CENTER: [number, number] = [-23.5505, -46.6333];
const DEFAULT_ZOOM = 15;

interface Bounds {
  minLat: number;
  minLng: number;
  maxLat: number;
  maxLng: number;
}

interface MapViewProps {
  reports: Report[];
  userProfile: UserProfile | null;
  userLocation: { lat: number; lng: number } | null;
  userAccuracy: number | null;
  onReportSelect?: (report: Report | null) => void;
  onVerify: (reportId: string, type: "confirmacao" | "negacao" | "continua" | "resolvido") => void;
  onNavigate: (report: Report) => void;
  onLocateUser: () => void;
  onRefresh: () => void;
  onNewReport: () => void;
  // New props for viewport-based loading
  filters?: {
    categories: string[];
    statuses: string[];
    onlyMine: boolean;
    period: "7d" | "30d" | "all";
    nearMe: { enabled: boolean; radius: number } | null;
  };
  onBoundsChange?: (bounds: Bounds | null) => void;
  totalReports?: number;
}

function MapEvents({
  userLocation,
  onLocateUser,
}: {
  userLocation: { lat: number; lng: number } | null;
  onLocateUser: () => void;
}) {
  const map = useMap();

  useMapEvents({
    moveend() {
      // Map moved - could trigger bounds-based report fetching
    },
    click() {
      // Click on map - close any open popup
    },
  });

  // Auto-center on user location when it changes
  useEffect(() => {
    if (userLocation) {
      map.setView([userLocation.lat, userLocation.lng], map.getZoom(), { animate: true });
    }
  }, [userLocation, map]);

  return null;
}

function MapClickHandler({ onClick }: { onClick: () => void }) {
  useMapEvents({
    click: onClick,
  });
  return null;
}

function ZoomTracker({ onZoomChange }: { onZoomChange: (zoom: number) => void }) {
  const map = useMap();
  useEffect(() => {
    const handler = () => onZoomChange(map.getZoom());
    map.on("zoomend", handler);
    return () => {
      map.off("zoomend", handler);
    };
  }, [map, onZoomChange]);
  return null;
}

function BoundsTracker({ onBoundsChange }: { onBoundsChange: (bounds: Bounds) => void }) {
  const map = useMap();
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const handler = () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => {
        const bounds = map.getBounds();
        onBoundsChange({
          minLat: bounds.getSouth(),
          minLng: bounds.getWest(),
          maxLat: bounds.getNorth(),
          maxLng: bounds.getEast(),
        });
      }, 400); // 400ms debounce
    };
    map.on("moveend", handler);
    // Also trigger on initial load
    handler();
    return () => {
      map.off("moveend", handler);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [map, onBoundsChange]);
  return null;
}

function LocateButton({ onLocate, userLocation }: { onLocate: () => void; userLocation: { lat: number; lng: number } | null }) {
  return (
    <button
      onClick={onLocate}
      className={`fixed bottom-24 right-6 z-20 w-12 h-12 rounded-xl bg-white dark:bg-zinc-800 flex items-center justify-center shadow-lg border border-zinc-200 dark:border-zinc-700 transition-all hover:shadow-xl ${
        userLocation ? "bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400" : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-700"
      }`}
      aria-label={userLocation ? "Sua localização" : "Localizar-me"}
    >
      <Locate className="w-5 h-5" aria-hidden="true" />
    </button>
  );
}

function LayerToggle({ onRefresh }: { onRefresh: () => void }) {
  return (
    <button
      onClick={onRefresh}
      className="fixed bottom-24 left-6 z-20 w-12 h-12 rounded-xl bg-white dark:bg-zinc-800 flex items-center justify-center shadow-lg border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-700 hover:shadow-xl transition-all"
      aria-label="Atualizar reportes"
    >
      <RefreshCw className="w-5 h-5" aria-hidden="true" />
    </button>
  );
}

function ReportButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="fixed bottom-6 right-6 z-20 w-14 h-14 rounded-full bg-amber-500 flex items-center justify-center shadow-lg border-4 border-white dark:border-zinc-900 transition-all hover:bg-amber-600 hover:shadow-xl hover:scale-105 active:scale-95"
      aria-label="Novo reporte"
    >
      <Plus className="w-7 h-7 text-white" aria-hidden="true" />
    </button>
  );
}

function Legend() {
  const categories = [
    "buraco_asfalto",
    "iluminacao",
    "lixo_entulho",
    "vazamento_agua",
    "sinalizacao",
    "acessibilidade",
    "vegetacao",
    "mobiliario_urbano",
    "outro",
  ] as const;

  return (
    <div className="fixed bottom-6 left-6 z-20 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-sm rounded-xl p-3 shadow-lg border border-zinc-200/50 dark:border-zinc-800/50 max-h-[60vh] overflow-y-auto">
      <p className="text-xs font-semibold text-zinc-900 dark:text-white mb-2 uppercase tracking-wider">Legenda</p>
      <div className="flex flex-col gap-2">
        {categories.map((cat) => {
          const config = CATEGORY_CONFIG[cat];
          return (
            <div key={cat} className="flex items-center gap-2">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${config.bgColor}`}>
                <span className="text-lg">{config.icon}</span>
              </div>
              <span className="text-sm text-zinc-700 dark:text-zinc-300">{config.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Near Me Button with radius selector and maps app integration
function NearMeButton({
  userLocation,
  nearMeFilter,
  onNearMeToggle,
  onRadiusChange,
}: {
  userLocation: { lat: number; lng: number } | null;
  nearMeFilter: { enabled: boolean; radius: number } | null;
  onNearMeToggle: () => void;
  onRadiusChange: (radius: number) => void;
}) {
  const [showRadiusSelector, setShowRadiusSelector] = useState(false);

  const RADIUS_OPTIONS = [
    { value: 200, label: "200 m" },
    { value: 500, label: "500 m" },
    { value: 1000, label: "1 km" },
    { value: 5000, label: "5 km" },
  ];

  const openInMapsApp = (lat: number, lng: number) => {
    // Try to open in native maps app
    const url = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
    window.open(url, "_blank");
  };

  if (!userLocation) return null;

  return (
    <div className="fixed bottom-80 right-6 z-20">
      {/* Radius selector dropdown */}
      {showRadiusSelector && nearMeFilter && (
        <div className="mb-2 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-sm rounded-xl p-2 shadow-lg border border-zinc-200/50 dark:border-zinc-800/50">
          <div className="flex items-center justify-between px-2 py-1 mb-1">
            <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300">Raio do filtro</span>
            <button
              onClick={() => setShowRadiusSelector(false)}
              className="p-1 text-zinc-500 hover:text-zinc-700"
              aria-label="Fechar seletor"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="flex flex-wrap gap-1">
            {RADIUS_OPTIONS.map((r) => (
              <button
                key={r.value}
                onClick={() => {
                  onRadiusChange(r.value);
                  setShowRadiusSelector(false);
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  nearMeFilter.radius === r.value
                    ? "bg-amber-500 text-white"
                    : "bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700"
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Main Near Me button */}
      <button
        onClick={nearMeFilter ? () => setShowRadiusSelector(true) : onNearMeToggle}
        className={`w-12 h-12 rounded-xl flex items-center justify-center shadow-lg border transition-all hover:shadow-xl ${
          nearMeFilter
            ? "bg-blue-500 text-white border-blue-500"
            : "bg-white dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-700"
        }`}
        aria-label={nearMeFilter ? `Filtro ativo: ${nearMeFilter.radius >= 1000 ? `${nearMeFilter.radius / 1000} km` : `${nearMeFilter.radius} m`}` : "Filtrar por proximidade"}
      >
        <Target className="w-5 h-5" aria-hidden="true" />
      </button>

      {/* Open in maps app button */}
      <button
        onClick={() => openInMapsApp(userLocation.lat, userLocation.lng)}
        className="mt-2 w-12 h-12 rounded-xl bg-white dark:bg-zinc-800 flex items-center justify-center shadow-lg border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-700 hover:shadow-xl transition-all"
        aria-label="Abrir no app de mapas"
      >
        <Map className="w-5 h-5" aria-hidden="true" />
      </button>
    </div>
  );
}

// Loading state overlay
function LoadingOverlay({ message = "Carregando reportes..." }: { message?: string }) {
  return (
    <div className="fixed inset-0 bg-white/70 dark:bg-zinc-950/70 backdrop-blur-sm z-30 flex items-center justify-center">
      <div className="bg-white dark:bg-zinc-900 rounded-2xl p-6 shadow-xl border border-zinc-200 dark:border-zinc-800 flex flex-col items-center gap-4 max-w-sm mx-4">
        <div className="w-12 h-12 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-zinc-700 dark:text-zinc-300 text-center">{message}</p>
      </div>
    </div>
  );
}

// Empty state
function EmptyState({ onRefresh, onNewReport }: { onRefresh: () => void; onNewReport: () => void }) {
  return (
    <div className="fixed inset-0 z-20 flex items-center justify-center p-4">
      <div className="bg-white/95 dark:bg-zinc-900/95 backdrop-blur-sm rounded-2xl p-8 shadow-xl border border-zinc-200/50 dark:border-zinc-800/50 max-w-sm text-center mx-4">
        <div className="text-5xl mb-4">🔍</div>
        <h3 className="text-lg font-semibold text-zinc-900 dark:text-white mb-2">Nenhum reporte encontrado</h3>
        <p className="text-zinc-600 dark:text-zinc-400 mb-6">
          Não há reportes na área visível com os filtros atuais.
        </p>
        <div className="flex flex-col gap-2">
          <button
            onClick={onRefresh}
            className="px-4 py-2.5 bg-amber-500 text-white rounded-xl font-medium hover:bg-amber-600 transition-colors"
          >
            Atualizar
          </button>
          <button
            onClick={onNewReport}
            className="px-4 py-2.5 bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 rounded-xl font-medium border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors"
          >
            Criar primeiro reporte
          </button>
        </div>
      </div>
    </div>
  );
}

// Cluster count badge for showing number of reports in cluster
export function MapView({
  reports: initialReports,
  userProfile,
  userLocation,
  userAccuracy,
  onReportSelect,
  onVerify,
  onNavigate,
  onLocateUser,
  onRefresh,
  onNewReport,
  filters,
  onBoundsChange,
  totalReports,
}: MapViewProps) {
  const [mapZoom, setMapZoom] = useState(DEFAULT_ZOOM);
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
  const [viewportReports, setViewportReports] = useState<Report[]>(initialReports);
  const [isLoadingViewport, setIsLoadingViewport] = useState(false);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);

  // Determine which reports to display: initial reports or viewport-loaded reports
  const displayReports = hasLoadedOnce ? viewportReports : initialReports;

  // Load leaflet.markercluster CSS dynamically to avoid SSR issues
  useEffect(() => {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.Default.css";
    document.head.appendChild(link);
    return () => {
      document.head.removeChild(link);
    };
  }, []);

  // Fix leaflet default marker icons on client side only
  useEffect(() => {
    delete (L.Icon.Default.prototype as any)._getIconUrl;
    L.Icon.Default.mergeOptions({
      iconRetinaUrl: markerIcon2x,
      iconUrl: markerIcon,
      shadowUrl: markerShadow,
    });
  }, []);

  const handleReportClick = useCallback((report: Report) => {
    setSelectedReport(report);
    onReportSelect?.(report);
  }, [onReportSelect]);

  const handleMapClick = useCallback(() => {
    setSelectedReport(null);
    onReportSelect?.(null);
  }, [onReportSelect]);

  const handleBoundsChange = useCallback(async (bounds: Bounds) => {
    if (!filters) return;

    setIsLoadingViewport(true);
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
      if (filters.nearMe?.enabled && userLocation) {
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
        userId: filters.onlyMine ? userProfile?.id : undefined,
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
      }));

      setViewportReports(formattedReports);
      setHasLoadedOnce(true);
      onBoundsChange?.(bounds);
    } catch (err) {
      console.error("Failed to fetch viewport reports:", err);
    } finally {
      setIsLoadingViewport(false);
    }
  }, [filters, userLocation, userProfile, onBoundsChange]);

  const handleRefresh = useCallback(() => {
    setHasLoadedOnce(false);
    setViewportReports(initialReports);
    onRefresh();
  }, [initialReports, onRefresh]);

  const handleNearMeToggle = useCallback(() => {
    // This will be handled by parent component via filters
    onRefresh();
  }, [onRefresh]);

  const handleRadiusChange = useCallback((radius: number) => {
    // This will be handled by parent component via filters
    onRefresh();
  }, [onRefresh]);

  return (
    <div className="relative w-full h-full">
      <MapContainer
        center={userLocation ? [userLocation.lat, userLocation.lng] : DEFAULT_CENTER}
        zoom={DEFAULT_ZOOM}
        zoomControl={false}
        scrollWheelZoom={true}
        className="w-full h-full"
      >
        <ZoomTracker onZoomChange={setMapZoom} />
        <BoundsTracker onBoundsChange={handleBoundsChange} />
        <MapClickHandler onClick={handleMapClick} />
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          maxZoom={19}
        />
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png"
          maxZoom={17}
        />

        <MapEvents userLocation={userLocation} onLocateUser={onLocateUser} />

        {/* Marker Clustering with react-leaflet-cluster */}
        <MarkerClusterGroup
          options={{
            maxClusterRadius: 50,
            disableClusteringAtZoom: 16,
            spiderfyOnMaxZoom: true,
            showCoverageOnHover: false,
            zoomToBoundsOnClick: true,
            singleMarkerMode: false,
          }}
        >
          {displayReports.map((report) => (
            <CustomMarker
              key={report.id}
              report={report}
              isSelected={selectedReport?.id === report.id}
              onClick={handleReportClick}
            />
          ))}
        </MarkerClusterGroup>

        {selectedReport && (
          <ReportPopup
            report={selectedReport}
            onClose={() => {
              setSelectedReport(null);
              onReportSelect?.(null);
            }}
            onVerify={onVerify}
            onNavigate={onNavigate}
            userLocation={userLocation}
            userAccuracy={userAccuracy}
            currentUserId={userProfile?.id || null}
          />
        )}
      </MapContainer>

      <LocateButton onLocate={onLocateUser} userLocation={userLocation} />
      <LayerToggle onRefresh={handleRefresh} />
      <ReportButton onClick={onNewReport} />
      <Legend />
      <NearMeButton
        userLocation={userLocation}
        nearMeFilter={filters?.nearMe ?? null}
        onNearMeToggle={handleNearMeToggle}
        onRadiusChange={handleRadiusChange}
      />

      {isLoadingViewport && <LoadingOverlay message="Atualizando reportes na área visível..." />}
      {!isLoadingViewport && hasLoadedOnce && displayReports.length === 0 && (
        <EmptyState onRefresh={handleRefresh} onNewReport={onNewReport} />
      )}
    </div>
  );
}