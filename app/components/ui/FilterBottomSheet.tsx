"use client";

import { useState, useEffect, useCallback } from "react";
import { X, ChevronUp, ChevronDown, Filter, MapPin, Clock, User, CheckCircle, Eye, EyeOff } from "lucide-react";
import { ReportCategory, ReportStatus } from "@/app/components/map/types";
import { CATEGORY_CONFIG } from "@/app/components/map/types";

interface FilterState {
  categories: ReportCategory[];
  statuses: ReportStatus[];
  onlyMine: boolean;
  period: "7d" | "30d" | "all";
  nearMe: { enabled: boolean; radius: number } | null;
}

interface FilterBottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  filters: FilterState;
  onFiltersChange: (filters: FilterState) => void;
  userLocation: { lat: number; lng: number } | null;
  totalReports: number;
  filteredReports: number;
}

const ALL_CATEGORIES: ReportCategory[] = [
  "buraco_asfalto", "iluminacao", "lixo_entulho", "vazamento_agua",
  "sinalizacao", "acessibilidade", "vegetacao", "mobiliario_urbano", "outro"
];

const STATUS_OPTIONS: { value: ReportStatus; label: string; icon: string }[] = [
  { value: "ativo", label: "Ativo", icon: "🔵" },
  { value: "em_analise", label: "Em Análise", icon: "🟠" },
  { value: "em_andamento", label: "Em Andamento", icon: "🟣" },
  { value: "resolvido", label: "Resolvido", icon: "🟢" },
  { value: "recusado", label: "Recusado", icon: "⚫" },
];

const RADIUS_OPTIONS = [
  { value: 200, label: "200 m" },
  { value: 500, label: "500 m" },
  { value: 1000, label: "1 km" },
  { value: 5000, label: "5 km" },
];

export function FilterBottomSheet({
  isOpen,
  onClose,
  filters,
  onFiltersChange,
  userLocation,
  totalReports,
  filteredReports,
}: FilterBottomSheetProps) {
  const [localFilters, setLocalFilters] = useState<FilterState>(filters);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState(0);

  // Sync local filters with props
  useEffect(() => {
    setLocalFilters(filters);
  }, [filters]);

  const updateFilter = useCallback((key: keyof FilterState, value: any) => {
    const newFilters = { ...localFilters, [key]: value };
    setLocalFilters(newFilters);
    onFiltersChange(newFilters);
  }, [localFilters, onFiltersChange]);

  const toggleCategory = (category: ReportCategory) => {
    const newCategories = localFilters.categories.includes(category)
      ? localFilters.categories.filter(c => c !== category)
      : [...localFilters.categories, category];
    updateFilter("categories", newCategories);
  };

  const toggleStatus = (status: ReportStatus) => {
    const newStatuses = localFilters.statuses.includes(status)
      ? localFilters.statuses.filter(s => s !== status)
      : [...localFilters.statuses, status];
    updateFilter("statuses", newStatuses);
  };

  const handleDragStart = (e: React.TouchEvent | React.MouseEvent) => {
    const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;
    setDragStart(clientY);
    setIsDragging(true);
  };

  const handleDragMove = (e: React.TouchEvent | React.MouseEvent) => {
    if (!isDragging) return;
    const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;
    const diff = dragStart - clientY;
    // Close if dragged down more than 100px
    if (diff > 100) {
      onClose();
    }
  };

  const handleDragEnd = () => {
    setIsDragging(false);
  };

  const handleNearMeClick = () => {
    if (!userLocation) return;
    if (localFilters.nearMe) {
      updateFilter("nearMe", null);
    } else {
      updateFilter("nearMe", { enabled: true, radius: 500 });
    }
  };

  const clearAllFilters = () => {
    const defaults: FilterState = {
      categories: [],
      statuses: ["ativo", "em_analise"],
      onlyMine: false,
      period: "30d",
      nearMe: null,
    };
    setLocalFilters(defaults);
    onFiltersChange(defaults);
  };

  const hasActiveFilters = localFilters.categories.length > 0 ||
    localFilters.statuses.length !== 2 ||
    localFilters.onlyMine ||
    localFilters.period !== "30d" ||
    localFilters.nearMe !== null;

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Bottom Sheet */}
      <div
        className="fixed bottom-0 left-0 right-0 z-50 bg-white dark:bg-zinc-900 rounded-t-2xl shadow-xl max-h-[85vh] flex flex-col"
        onTouchStart={handleDragStart}
        onTouchMove={handleDragMove}
        onTouchEnd={handleDragEnd}
        onMouseDown={handleDragStart}
        onMouseMove={handleDragMove}
        onMouseUp={handleDragEnd}
        onMouseLeave={handleDragEnd}
        role="dialog"
        aria-modal="true"
        aria-label="Filtros do mapa"
      >
        {/* Drag Handle */}
        <div className="flex items-center justify-center py-3 border-b border-zinc-200 dark:border-zinc-700">
          <div className="w-10 h-1 rounded-full bg-zinc-300 dark:bg-zinc-600" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-200 dark:border-zinc-700">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-white flex items-center gap-2">
            <Filter className="w-5 h-5 text-amber-600" aria-hidden="true" />
            Filtros
          </h2>
          <div className="flex items-center gap-2">
            {hasActiveFilters && (
              <button
                onClick={clearAllFilters}
                className="text-sm text-amber-600 dark:text-amber-400 font-medium"
              >
                Limpar tudo
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
              aria-label="Fechar filtros"
            >
              <X className="w-5 h-5 text-zinc-600 dark:text-zinc-400" />
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="px-4 py-3 bg-zinc-50 dark:bg-zinc-800/50 border-b border-zinc-200 dark:border-zinc-700">
          <div className="flex items-center justify-between text-sm">
            <span className="text-zinc-600 dark:text-zinc-400">
              {filteredReports} de {totalReports} reportes
            </span>
            {localFilters.nearMe && userLocation && (
              <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400 font-medium">
                <MapPin className="w-3 h-3" />
                Perto de mim: {localFilters.nearMe.radius >= 1000
                  ? `${localFilters.nearMe.radius / 1000} km`
                  : `${localFilters.nearMe.radius} m`}
              </span>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {/* Categories */}
          <FilterSection title="Categorias" icon={<CheckCircle className="w-5 h-5" />}>
            <div className="grid grid-cols-3 gap-2">
              {ALL_CATEGORIES.map((cat) => {
                const config = CATEGORY_CONFIG[cat] || CATEGORY_CONFIG.outro;
                const isSelected = localFilters.categories.includes(cat);
                return (
                  <button
                    key={cat}
                    onClick={() => toggleCategory(cat)}
                    className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all ${
                      isSelected
                        ? `bg-${config.bgColor.split(" ")[0].replace("bg-", "")} border-${config.color.replace("text-", "")}`
                        : "bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700"
                    }`}
                  >
                    <span className="text-2xl">{config.icon}</span>
                    <span className={`text-xs font-medium ${isSelected ? config.color : "text-zinc-700 dark:text-zinc-300"}`}>
                      {config.label}
                    </span>
                  </button>
                );
              })}
            </div>
            {localFilters.categories.length === 0 && (
              <p className="text-xs text-zinc-500 dark:text-zinc-400 text-center mt-2">
                Todas as categorias selecionadas
              </p>
            )}
          </FilterSection>

          {/* Status */}
          <FilterSection title="Status" icon={<Eye className="w-5 h-5" />}>
            <div className="flex flex-wrap gap-2">
              {STATUS_OPTIONS.map((s) => {
                const isSelected = localFilters.statuses.includes(s.value);
                return (
                  <button
                    key={s.value}
                    onClick={() => toggleStatus(s.value)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl border-2 transition-all ${
                      isSelected
                        ? "bg-green-50 dark:bg-green-900/20 border-green-300 dark:border-green-700"
                        : "bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700"
                    }`}
                  >
                    <span className="text-lg">{s.icon}</span>
                    <span className={`text-sm font-medium ${isSelected ? "text-green-700 dark:text-green-300" : "text-zinc-700 dark:text-zinc-300"}`}>
                      {s.label}
                    </span>
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Resolvidos desligados por padrão
            </p>
          </FilterSection>

          {/* Period */}
          <FilterSection title="Período" icon={<Clock className="w-5 h-5" />}>
            <div className="flex gap-2">
              {[
                { value: "7d", label: "7 dias" },
                { value: "30d", label: "30 dias" },
                { value: "all", label: "Todos" },
              ].map((p) => (
                <button
                  key={p.value}
                  onClick={() => updateFilter("period", p.value as "7d" | "30d" | "all")}
                  className={`flex-1 py-2 rounded-xl border-2 text-sm font-medium transition-all ${
                    localFilters.period === p.value
                      ? "bg-amber-500 text-white border-amber-500"
                      : "bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300"
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </FilterSection>

          {/* My Reports Only */}
          <FilterSection title="Meus reportes" icon={<User className="w-5 h-5" />}>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={localFilters.onlyMine}
                onChange={(e) => updateFilter("onlyMine", e.target.checked)}
                className="w-5 h-5 rounded border-zinc-300 text-amber-600 focus:ring-amber-500"
              />
              <span className="text-zinc-700 dark:text-zinc-300">Mostrar apenas os meus reportes</span>
            </label>
          </FilterSection>

          {/* Near Me */}
          <FilterSection title="Perto de mim" icon={<MapPin className="w-5 h-5" />}>
            {userLocation ? (
              <>
                {!localFilters.nearMe ? (
                  <button
                    onClick={handleNearMeClick}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-medium transition-colors hover:border-amber-300 dark:hover:border-amber-700"
                  >
                    <MapPin className="w-5 h-5 text-amber-600" />
                    <span>Filtrar por raio</span>
                  </button>
                ) : (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-zinc-700 dark:text-zinc-300">Raio: {localFilters.nearMe.radius >= 1000 ? `${localFilters.nearMe.radius / 1000} km` : `${localFilters.nearMe.radius} m`}</span>
                      <button
                        onClick={() => updateFilter("nearMe", null)}
                        className="text-sm text-amber-600 dark:text-amber-400"
                      >
                        Remover
                      </button>
                    </div>
                    <div className="flex gap-2 overflow-x-auto pb-2">
                      {RADIUS_OPTIONS.map((r) => (
                        <button
                          key={r.value}
                          onClick={() => updateFilter("nearMe", { enabled: true, radius: r.value })}
                          className={`whitespace-nowrap px-4 py-2 rounded-xl border-2 text-sm font-medium transition-all ${
                            localFilters.nearMe?.radius === r.value
                              ? "bg-amber-500 text-white border-amber-500"
                              : "bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300"
                          }`}
                        >
                          {r.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <p className="text-zinc-500 dark:text-zinc-400 text-center py-4">
                Ative a localização para usar este filtro
              </p>
            )}
          </FilterSection>
        </div>

        {/* Apply Button */}
        <div className="px-4 py-4 border-t border-zinc-200 dark:border-zinc-700">
          <button
            onClick={onClose}
            className="w-full py-3 bg-amber-500 text-white rounded-xl font-medium text-base hover:bg-amber-600 transition-colors"
          >
            Aplicar filtros
          </button>
        </div>
      </div>
    </>
  );
}

function FilterSection({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg bg-amber-50 dark:bg-amber-900/20 flex items-center justify-center">
          {icon}
        </div>
        <h3 className="font-semibold text-zinc-900 dark:text-white">{title}</h3>
      </div>
      {children}
    </div>
  );
}