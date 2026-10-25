"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { MapContainer, TileLayer, useMapEvents, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { CustomMarker, ClusterMarker } from "./CustomMarker";
import { ReportPopup } from "./ReportPopup";
import { Locate, Layers, RefreshCw } from "lucide-react";
import type { Report, UserProfile } from "./types";

// Fix for Leaflet default marker images
import L from "leaflet";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

// Default location (São Paulo)
const DEFAULT_CENTER: [number, number] = [-23.5505, -46.6333];
const DEFAULT_ZOOM = 15;

interface MapViewProps {
  reports: Report[];
  userProfile: UserProfile | null;
  userLocation: { lat: number; lng: number } | null;
  onReportSelect: (report: Report | null) => void;
  onVerify: (reportId: string, type: "confirmacao" | "negacao") => void;
  onNavigate: (report: Report) => void;
  onLocateUser: () => void;
  onRefresh: () => void;
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

function Legend() {
  const categories = [
    "buraco_asfalto",
    "iluminacao",
    "lixo_entulho",
    "vazamento_agua",
    "sinalizacao",
    "acessibilidade",
  ] as const;

  return (
    <div className="fixed bottom-6 left-6 z-20 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-sm rounded-xl p-3 shadow-lg border border-zinc-200/50 dark:border-zinc-800/50 max-h-[60vh] overflow-y-auto">
      <p className="text-xs font-semibold text-zinc-900 dark:text-white mb-2 uppercase tracking-wider">Legenda</p>
      <div className="flex flex-col gap-2">
        {categories.map((cat) => {
          const config = {
            buraco_asfalto: { label: "Buraco", icon: "🕳️", color: "text-orange-600", bg: "bg-orange-100 dark:bg-orange-900/30" },
            iluminacao: { label: "Iluminação", icon: "💡", color: "text-yellow-600", bg: "bg-yellow-100 dark:bg-yellow-900/30" },
            lixo_entulho: { label: "Lixo", icon: "🗑️", color: "text-green-600", bg: "bg-green-100 dark:bg-green-900/30" },
            vazamento_agua: { label: "Vazamento", icon: "💧", color: "text-blue-600", bg: "bg-blue-100 dark:bg-blue-900/30" },
            sinalizacao: { label: "Sinalização", icon: "🚦", color: "text-red-600", bg: "bg-red-100 dark:bg-red-900/30" },
            acessibilidade: { label: "Acessibilidade", icon: "♿", color: "text-purple-600", bg: "bg-purple-100 dark:bg-purple-900/30" },
          }[cat];
          return (
            <div key={cat} className="flex items-center gap-2">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${config.bg}`}>
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

// Simple clustering logic
function clusterReports(reports: Report[], zoom: number): (Report | { cluster: true; count: number; position: [number, number]; reports: Report[] })[] {
  if (zoom >= 16) return reports;

  const gridSize = zoom >= 14 ? 0.005 : zoom >= 12 ? 0.01 : 0.02;
  const clusters = new Map<string, Report[]>();

  reports.forEach((report) => {
    const gridX = Math.floor(report.longitude / gridSize);
    const gridY = Math.floor(report.latitude / gridSize);
    const key = `${gridX},${gridY}`;

    if (!clusters.has(key)) clusters.set(key, []);
    clusters.get(key)!.push(report);
  });

  return Array.from(clusters.entries()).map(([_, reports]) => {
    if (reports.length === 1) return reports[0];

    const avgLat = reports.reduce((sum, r) => sum + r.latitude, 0) / reports.length;
    const avgLng = reports.reduce((sum, r) => sum + r.longitude, 0) / reports.length;

    return {
      cluster: true,
      count: reports.length,
      position: [avgLat, avgLng] as [number, number],
      reports,
    };
  });
}

export function MapView({
  reports,
  userProfile,
  userLocation,
  onReportSelect,
  onVerify,
  onNavigate,
  onLocateUser,
  onRefresh,
}: MapViewProps) {
  const [mapZoom, setMapZoom] = useState(DEFAULT_ZOOM);
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);

  const handleReportClick = useCallback((report: Report) => {
    setSelectedReport(report);
    onReportSelect(report);
  }, [onReportSelect]);

  const handleMapClick = useCallback(() => {
    setSelectedReport(null);
    onReportSelect(null);
  }, [onReportSelect]);

  const clusteredData = clusterReports(reports, mapZoom);

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
          // Could add layer control to toggle
        />

        <MapEvents userLocation={userLocation} onLocateUser={onLocateUser} />

        {clusteredData.map((item, index) => {
          if ("cluster" in item) {
            return (
              <ClusterMarker
                key={`cluster-${index}`}
                count={item.count}
                position={item.position}
                onClick={() => {
                  // Could zoom in or show cluster popup
                }}
              />
            );
          }
          return (
            <CustomMarker
              key={item.id}
              report={item}
              isSelected={selectedReport?.id === item.id}
              onClick={handleReportClick}
            />
          );
        })}

        {selectedReport && (
          <ReportPopup
            report={selectedReport}
            onClose={() => {
              setSelectedReport(null);
              onReportSelect(null);
            }}
            onVerify={onVerify}
            onNavigate={onNavigate}
            userLocation={userLocation}
          />
        )}
      </MapContainer>

      <LocateButton onLocate={onLocateUser} userLocation={userLocation} />
      <LayerToggle onRefresh={onRefresh} />
      <Legend />
    </div>
  );
}