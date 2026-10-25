"use client";

import { useEffect, useRef, useState } from "react";
import { MapPin, X } from "lucide-react";
import { MapContainer, TileLayer, Marker, useMapEvents } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import type { Map } from "leaflet";

interface ReportStepGPSProps {
  initialPosition?: { lat: number; lng: number } | null;
  onConfirm: (position: { lat: number; lng: number }) => void;
  onCancel: () => void;
}

export function ReportStepGPS({ initialPosition, onConfirm, onCancel }: ReportStepGPSProps) {
  const [position, setPosition] = useState<{ lat: number; lng: number } | null>(initialPosition ?? null);
  const [loading, setLoading] = useState(!initialPosition);
  const mapRef = useRef<L.Map | null>(null);

  // Fix leaflet default marker icons on client side only
  useEffect(() => {
    delete (L.Icon.Default.prototype as any)._getIconUrl;
    L.Icon.Default.mergeOptions({
      iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
      iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
      shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
    });
  }, []);

  // Auto-get GPS on mount
  useEffect(() => {
    if (initialPosition) return;
    if (!navigator.geolocation) {
      setLoading(false);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setPosition(coords);
        setLoading(false);
        // center map after render
        setTimeout(() => mapRef.current?.setView([coords.lat, coords.lng], 17), 100);
      },
      () => setLoading(false),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, [initialPosition]);

  const handleMapClick = (e: L.LeafletMouseEvent) => {
    setPosition({ lat: e.latlng.lat, lng: e.latlng.lng });
  };

  const handleDragEnd = (e: L.DragEndEvent) => {
    const { lat, lng } = e.target.getLatLng();
    setPosition({ lat, lng });
  };

  // Helper component to capture map instance
  function MapInstanceCapturer({ onMapReady }: { onMapReady: (map: L.Map) => void }) {
    const map = useMapEvents({});
    useEffect(() => {
      onMapReady(map);
    }, [map, onMapReady]);
    return null;
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="p-4 border-b border-zinc-200 dark:border-zinc-700">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">1️⃣ Localização</h2>
        <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">
          Arraste o marcador para ajustar o ponto exato do problema.
        </p>
      </div>

      {loading && (
        <div className="flex-1 flex items-center justify-center bg-zinc-100 dark:bg-zinc-800">
          <div className="w-10 h-10 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {position && !loading && (
        <div className="flex-1 relative min-h-0">
          <MapContainer
            center={[position.lat, position.lng]}
            zoom={17}
            scrollWheelZoom={false}
            className="w-full h-full"
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <Marker
              position={[position.lat, position.lng]}
              draggable
              eventHandlers={{ dragend: handleDragEnd }}
            />
            <MapClickHandler onClick={handleMapClick} />
            <MapInstanceCapturer onMapReady={(map) => { mapRef.current = map; }} />
          </MapContainer>

          {/* Current coords display */}
          <div className="absolute bottom-4 left-4 right-4 md:left-auto md:right-4 md:bottom-4 md:w-72">
            <div className="bg-white dark:bg-zinc-900 rounded-xl p-3 shadow-lg border border-zinc-200 dark:border-zinc-700 text-sm">
              <p className="text-zinc-600 dark:text-zinc-400">Lat: {position.lat.toFixed(6)}</p>
              <p className="text-zinc-600 dark:text-zinc-400">Lng: {position.lng.toFixed(6)}</p>
            </div>
          </div>
        </div>
      )}

      <div className="p-4 border-t border-zinc-200 dark:border-zinc-700 flex gap-3">
        <button
          onClick={onCancel}
          className="flex-1 py-3 rounded-xl border border-zinc-300 dark:border-zinc-600 text-zinc-700 dark:text-zinc-300 font-medium hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
        >
          Voltar
        </button>
        <button
          onClick={() => position && onConfirm(position)}
          disabled={!position || loading}
          className="flex-1 py-3 rounded-xl bg-amber-500 hover:bg-amber-600 disabled:bg-zinc-300 dark:disabled:bg-zinc-700 disabled:cursor-not-allowed text-white font-medium transition-colors shadow-sm"
        >
          Usar esta posição
        </button>
      </div>
    </div>
  );
}

// Helper component to capture map clicks
function MapClickHandler({ onClick }: { onClick: (e: L.LeafletMouseEvent) => void }) {
  const map = useMapEvents({
    click: onClick,
  });
  return null;
}