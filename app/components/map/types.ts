export type ReportCategory =
  | "buraco_asfalto"
  | "iluminacao"
  | "lixo_entulho"
  | "vazamento_agua"
  | "sinalizacao"
  | "acessibilidade"
  | "vegetacao"
  | "mobiliario_urbano"
  | "outro";

export type ReportStatus = "ativo" | "em_analise" | "em_andamento" | "resolvido" | "recusado";

export interface Report {
  id: string;
  creator_id: string;
  latitude: number;
  longitude: number;
  category: ReportCategory;
  title: string;
  description: string | null;
  photo_url: string;
  photo_thumbnail_url: string | null;
  status: ReportStatus;
  confirmations_count: number;
  denials_count: number;
  score_awarded: number;
  created_at: string;
  updated_at: string;
  // Joined fields
  creator_username?: string;
  creator_avatar?: string;
  creator_level?: number;
}

export interface UserProfile {
  id: string;
  username: string;
  full_name: string | null;
  avatar_url: string | null;
  level: number;
  total_score: number;
  current_streak: number;
  longest_streak: number;
}

export const CATEGORY_CONFIG: Record<ReportCategory, { label: string; icon: string; color: string; bgColor: string }> = {
  buraco_asfalto: {
    label: "Buraco no Asfalto",
    icon: "🕳️",
    color: "text-orange-600",
    bgColor: "bg-orange-100 dark:bg-orange-900/30",
  },
  iluminacao: {
    label: "Iluminação",
    icon: "💡",
    color: "text-yellow-600",
    bgColor: "bg-yellow-100 dark:bg-yellow-900/30",
  },
  lixo_entulho: {
    label: "Lixo / Entulho",
    icon: "🗑️",
    color: "text-green-600",
    bgColor: "bg-green-100 dark:bg-green-900/30",
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
  vegetacao: {
    label: "Vegetação",
    icon: "🌳",
    color: "text-emerald-600",
    bgColor: "bg-emerald-100 dark:bg-emerald-900/30",
  },
  mobiliario_urbano: {
    label: "Mobiliário Urbano",
    icon: "🪑",
    color: "text-indigo-600",
    bgColor: "bg-indigo-100 dark:bg-indigo-900/30",
  },
  outro: {
    label: "Outro",
    icon: "📍",
    color: "text-zinc-600",
    bgColor: "bg-zinc-100 dark:bg-zinc-900/30",
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