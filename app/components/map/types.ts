export type ReportCategory =
  | "buraco_asfalto"
  | "vazamento_agua"
  | "sinalizacao"
  | "acessibilidade"
  | "iluminacao"
  | "lixo_entulho"
  | "vegetacao"
  | "mobiliario_urbano"
  | "outro";

export type ReportStatus = "ativo" | "em_analise" | "em_andamento" | "resolvido" | "recusado";

export interface Report {
  id: string;
  user_id: string;  // NEW: user_id instead of creator_id
  latitude: number;
  longitude: number;
  category: ReportCategory;
  title: string;
  description: string | null;
  photo_url: string;
  photo_thumbnail_url: string | null;
  image_url: string | null;  // alias for photo_url
  status: ReportStatus;
  confirmations_continua: number;  // NEW: replaces confirmations_count
  confirmations_resolvido: number; // NEW: replaces denials_count
  // points removed - use REPORT_BASE_XP constant or CATEGORY_DISPLAY_POINTS[category] for display
  created_at: string;
  updated_at: string;
  resolved_at?: string | null;
  // Anti-fraude
  hidden?: boolean;
  // Joined fields
  creator_username?: string;
  creator_avatar?: string;
  creator_level?: number;
  // Community validation fields
  distance_m?: number;
  user_has_confirmed_continua?: boolean;
  user_has_confirmed_resolvido?: boolean;
}

export interface ReportFlag {
  id: string;
  report_id: string;
  user_id: string;
  reason: 'falso' | 'duplicado' | 'ofensivo' | 'outro';
  created_at: string;
}

export interface UserProfile {
  id: string;
  username: string;
  full_name: string | null;
  avatar_url: string | null;
  level: number;
  xp: number;          // NEW: xp (never spent)
  coins: number;       // NEW: coins (spent on items)
  total_score: number; // NEW: total XP earned (for ranking)
  streak_count: number;  // NEW: streak_count
  best_streak: number;   // NEW: best_streak
  last_active_date?: string | null;
  title?: string;
  equipped?: {
    cabeca?: string | null;
    corpo?: string | null;
    acessorio?: string | null;
    fundo?: string | null;
  };
  created_at?: string;
}

export interface Badge {
  id: string;
  code: string;
  name: string;
  description: string;
  icon: string;
  category: string;
  requirement_type: string;
  requirement_value: Record<string, any>;
  xp_reward: number;
  created_at: string;
  earned_at?: string | null; // null if not earned
}

export interface LeaderboardEntry {
  id: string;
  username: string;
  avatar_url: string | null;
  level: number;
  xp: number;
  total_score: number;
  rank: number;
  streak_count?: number;
  best_streak?: number;
  equipped?: {
    cabeca?: string | null;
    corpo?: string | null;
    acessorio?: string | null;
    fundo?: string | null;
  };
}

export const CATEGORY_CONFIG: Record<ReportCategory, { label: string; icon: string; color: string; bgColor: string }> = {
  buraco_asfalto: {
    label: "Buraco no Asfalto",
    icon: "🕳️",
    color: "text-orange-600",
    bgColor: "bg-orange-100 dark:bg-orange-900/30",
  },
  vazamento_agua: {
    label: "Vazamento de Água",
    icon: "💧",
    color: "text-blue-600",
    bgColor: "bg-blue-100 dark:bg-blue-900/30",
  },
  sinalizacao: {
    label: "Sinalização",
    icon: "🚦",
    color: "text-red-600",
    bgColor: "bg-red-100 dark:bg-red-900/30",
  },
  acessibilidade: {
    label: "Acessibilidade",
    icon: "♿",
    color: "text-purple-600",
    bgColor: "bg-purple-100 dark:bg-purple-900/30",
  },
  iluminacao: {
    label: "Iluminação",
    icon: "💡",
    color: "text-amber-600",
    bgColor: "bg-amber-100 dark:bg-amber-900/30",
  },
  lixo_entulho: {
    label: "Lixo e Entulho",
    icon: "🗑️",
    color: "text-green-600",
    bgColor: "bg-green-100 dark:bg-green-900/30",
  },
  vegetacao: {
    label: "Vegetação",
    icon: "🌳",
    color: "text-emerald-600",
    bgColor: "bg-emerald-100 dark:bg-emerald-900/30",
  },
  mobiliario_urbano: {
    label: "Mobiliário Urbano",
    icon: "🪑",
    color: "text-zinc-600",
    bgColor: "bg-zinc-100 dark:bg-zinc-900/30",
  },
  outro: {
    label: "Outro",
    icon: "📦",
    color: "text-gray-600",
    bgColor: "bg-gray-100 dark:bg-gray-900/30",
  },
};

export const STATUS_CONFIG: Record<ReportStatus, { label: string; color: string; bgColor: string }> = {
  ativo: { label: "Ativo", color: "text-blue-600", bgColor: "bg-blue-100 dark:bg-blue-900/30" },
  em_analise: { label: "Em Análise", color: "text-amber-600", bgColor: "bg-amber-100 dark:bg-amber-900/30" },
  em_andamento: { label: "Em Andamento", color: "text-indigo-600", bgColor: "bg-indigo-100 dark:bg-indigo-900/30" },
  resolvido: { label: "Resolvido", color: "text-green-600", bgColor: "bg-green-100 dark:bg-green-900/30" },
  recusado: { label: "Recusado", color: "text-red-600", bgColor: "bg-red-100 dark:bg-red-900/30" },
};

export function getCategoryConfig(category: ReportCategory) {
  return CATEGORY_CONFIG[category] || CATEGORY_CONFIG.outro;
}

export function getStatusConfig(status: ReportStatus) {
  return STATUS_CONFIG[status] || STATUS_CONFIG.ativo;
}

// Base XP reward for creating a report (matches award_reward in 005_reward_events)
export const REPORT_BASE_XP = 50;
export const REPORT_BASE_COINS = 10;

// Category display points (for UI display only, not actual rewards)
export const CATEGORY_DISPLAY_POINTS: Record<ReportCategory, number> = {
  buraco_asfalto: 10,
  vazamento_agua: 15,
  sinalizacao: 8,
  acessibilidade: 12,
  iluminacao: 10,
  lixo_entulho: 8,
  vegetacao: 8,
  mobiliario_urbano: 8,
  outro: 5,
};

// ========================
// Items & Avatar
// ========================

export type ItemSlot = 'cabeca' | 'corpo' | 'acessorio' | 'fundo';
export type ItemRarity = 'comum' | 'raro' | 'epico';

export interface Item {
  id: string;
  code: string;
  name: string;
  slot: ItemSlot;
  rarity: ItemRarity;
  price_coins: number;
  min_level: number;
  asset: string; // SVG key
  active: boolean;
  created_at?: string;
}

export interface UserItem {
  user_id: string;
  item_id: string;
  item?: Item; // joined
  acquired_at: string;
}

export interface EquippedItems {
  cabeca?: string | null; // item code
  corpo?: string | null;
  acessorio?: string | null;
  fundo?: string | null;
}

export interface UserProfileWithItems extends UserProfile {
  equipped?: EquippedItems;
}

export const ITEM_SLOT_LABELS: Record<ItemSlot, string> = {
  cabeca: 'Cabeça',
  corpo: 'Corpo',
  acessorio: 'Acessório',
  fundo: 'Fundo',
};

export const ITEM_RARITY_CONFIG: Record<ItemRarity, { label: string; color: string; bgColor: string; borderColor: string }> = {
  comum: { label: 'Comum', color: 'text-zinc-600', bgColor: 'bg-zinc-100 dark:bg-zinc-800', borderColor: 'border-zinc-300 dark:border-zinc-600' },
  raro: { label: 'Raro', color: 'text-blue-600', bgColor: 'bg-blue-100 dark:bg-blue-900/30', borderColor: 'border-blue-300 dark:border-blue-700' },
  epico: { label: 'Épico', color: 'text-purple-600', bgColor: 'bg-purple-100 dark:bg-purple-900/30', borderColor: 'border-purple-300 dark:border-purple-700' },
};

export function getItemRarityConfig(rarity: ItemRarity) {
  return ITEM_RARITY_CONFIG[rarity] || ITEM_RARITY_CONFIG.comum;
}

export function getSlotLabel(slot: ItemSlot) {
  return ITEM_SLOT_LABELS[slot] || slot;
}

// ========================
// Missions & Streak
// ========================

export type MissionType = 'diaria' | 'semanal';
export type MissionMetric = 'reportes' | 'confirmacoes' | 'resolucoes' | 'reportes_categoria';

export interface MissionTemplate {
  id: string;
  code: string;
  title: string;
  description: string;
  type: MissionType;
  metric: MissionMetric;
  category: string | null;
  target: number;
  reward_xp: number;
  reward_coins: number;
  active: boolean;
  created_at: string;
}

export interface UserMission {
  id: string;
  user_id: string;
  template_id: string;
  period_start: string; // date as string
  progress: number;
  completed_at: string | null;
  claimed_at: string | null;
  created_at: string;
  template?: MissionTemplate; // joined
}

export interface UserMissionWithTemplate extends UserMission {
  template: MissionTemplate;
  is_completed: boolean;
  is_claimed: boolean;
  can_claim: boolean;
}

export interface StreakInfo {
  streak_count: number;
  best_streak: number;
  last_active_date: string | null;
  next_milestone: number | null; // dias do próximo marco (3, 7, 14, 30)
  days_to_next_milestone: number | null;
  milestones_earned: number[]; // [3, 7, ...]
}

export const MISSION_TYPE_LABELS: Record<MissionType, string> = {
  diaria: 'Diária',
  semanal: 'Semanal',
};

export const MISSION_METRIC_LABELS: Record<MissionMetric, string> = {
  reportes: 'Reportes',
  confirmacoes: 'Confirmações "Continua"',
  resolucoes: 'Confirmações "Resolvido"',
  reportes_categoria: 'Reportes por Categoria',
};

export function getMissionTypeLabel(type: MissionType) {
  return MISSION_TYPE_LABELS[type] || type;
}

export function getMissionMetricLabel(metric: MissionMetric) {
  return MISSION_METRIC_LABELS[metric] || metric;
}

// Streak milestones
export const STREAK_MILESTONES = [3, 7, 14, 30] as const;
export type StreakMilestone = typeof STREAK_MILESTONES[number];