"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Map, MapPin, Sun, Moon, Layers, X } from "lucide-react";

export type MapStyle = "light" | "dark" | "satellite" | "osm";

interface TileLayerConfig {
  id: MapStyle;
  name: string;
  url: string;
  attribution: string;
  subdomains?: string;
  iconName: "sun" | "moon" | "layers" | "map-pin";
  darkModeDefault?: boolean;
}

const TILE_LAYERS: TileLayerConfig[] = [
  {
    id: "light",
    name: "Claro",
    url: "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
    subdomains: "abcd",
    iconName: "sun",
    darkModeDefault: false,
  },
  {
    id: "dark",
    name: "Escuro",
    url: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
    subdomains: "abcd",
    iconName: "moon",
    darkModeDefault: true,
  },
  {
    id: "satellite",
    name: "Satélite",
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    attribution: "Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community",
    iconName: "layers",
  },
  {
    id: "osm",
    name: "OpenStreetMap",
    url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    subdomains: "abc",
    iconName: "map-pin",
  },
];

function getLayerIcon(iconName: TileLayerConfig["iconName"]): React.ReactNode {
  switch (iconName) {
    case "sun": return <Sun className="w-5 h-5" />;
    case "moon": return <Moon className="w-5 h-5" />;
    case "layers": return <Layers className="w-5 h-5" />;
    case "map-pin": return <MapPin className="w-5 h-5" />;
  }
}

const STORAGE_KEY = "civikoo_map_style";

function getInitialStyle(): MapStyle {
  if (typeof window === "undefined") return "light";

  const stored = localStorage.getItem(STORAGE_KEY) as MapStyle | null;
  if (stored && TILE_LAYERS.some(l => l.id === stored)) return stored;

  // Default based on system preference
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  return prefersDark ? "dark" : "light";
}

interface MapStyleToggleProps {
  currentStyle: MapStyle;
  onStyleChange: (style: MapStyle) => void;
  className?: string;
}

export function MapStyleToggle({ currentStyle, onStyleChange, className = "" }: MapStyleToggleProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleSelect = useCallback((style: MapStyle) => {
    onStyleChange(style);
    setIsOpen(false);
  }, [onStyleChange]);

  if (!mounted) {
    return (
      <div className={`absolute top-4 right-4 z-30 ${className}`}>
        <div className="w-10 h-10 bg-zinc-900/95 backdrop-blur-xl border border-zinc-800 rounded-xl animate-pulse" />
      </div>
    );
  }

  const currentLayer = TILE_LAYERS.find(l => l.id === currentStyle) || TILE_LAYERS[0];

  return (
    <div className={`absolute top-4 right-4 z-30 ${className}`}>
      <div className="relative">
        {/* Main button */}
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="w-10 h-10 bg-zinc-900/95 backdrop-blur-xl border border-zinc-800 rounded-xl flex items-center justify-center text-zinc-300 hover:text-white hover:border-zinc-700 transition-all duration-200 shadow-lg touch-target"
          aria-label={`Estilo do mapa: ${currentLayer.name}. Clique para alterar.`}
          aria-expanded={isOpen}
          aria-haspopup="listbox"
        >
          {getLayerIcon(currentLayer.iconName)}
        </button>

        {/* Dropdown panel */}
        {isOpen && (
          <>
            <div
              className="fixed inset-0 z-20"
              onClick={() => setIsOpen(false)}
              aria-hidden="true"
            />
            <div className="absolute right-0 top-full mt-2 z-30 bg-zinc-900/95 backdrop-blur-xl border border-zinc-800 rounded-2xl shadow-xl overflow-hidden min-w-[160px] animate-slide-down">
              <div className="p-2">
                <p className="px-3 py-2 text-xs font-medium text-zinc-500 uppercase tracking-wider">Estilo do Mapa</p>
                {TILE_LAYERS.map(layer => (
                  <button
                    key={layer.id}
                    onClick={() => handleSelect(layer.id)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                      layer.id === currentStyle
                        ? "bg-amber-500/10 text-amber-400"
                        : "text-zinc-300 hover:bg-zinc-800 hover:text-white"
                    }`}
                    role="option"
                    aria-selected={layer.id === currentStyle}
                  >
                    <span className="w-8 h-8 rounded-lg bg-zinc-800 flex items-center justify-center text-zinc-400">
                      {getLayerIcon(layer.iconName)}
                    </span>
                    <span className="flex-1 text-left">{layer.name}</span>
                    {layer.id === currentStyle && (
                      <span className="w-5 h-5 rounded-full bg-amber-500 flex items-center justify-center">
                        <X className="w-3 h-3 text-white" />
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export { TILE_LAYERS };
export type { TileLayerConfig };