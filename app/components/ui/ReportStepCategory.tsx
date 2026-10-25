"use client";

import { useState } from "react";
import {
  Truck,
  Zap,
  TreePine,
  Wrench,
  Trash2,
  Lightbulb,
  AlertTriangle,
  CheckCircle2
} from "lucide-react";

type Category =
  | "buraco"
  | "iluminacao"
  | "lixo"
  | "vegetacao"
  | "sinalizacao"
  | "outro";

const categories: { id: Category; label: string; icon: React.ReactNode; color: string }[] = [
  { id: "buraco", label: "Buraco", icon: <AlertTriangle className="w-6 h-6" />, color: "bg-orange-500" },
  { id: "iluminacao", label: "Iluminação", icon: <Lightbulb className="w-6 h-6" />, color: "bg-amber-400" },
  { id: "lixo", label: "Lixo", icon: <Trash2 className="w-6 h-6" />, color: "bg-green-600" },
  { id: "vegetacao", label: "Vegetação", icon: <TreePine className="w-6 h-6" />, color: "bg-emerald-500" },
  { id: "sinalizacao", label: "Sinalização", icon: <Wrench className="w-6 h-6" />, color: "bg-blue-500" },
  { id: "outro", label: "Outro", icon: <Truck className="w-6 h-6" />, color: "bg-zinc-500" },
];

interface ReportStepCategoryProps {
  onConfirm: (category: Category) => void;
  onBack: () => void;
  initialCategory?: Category;
}

export function ReportStepCategory({ onConfirm, onBack, initialCategory }: ReportStepCategoryProps) {
  const [selected, setSelected] = useState<Category | null>(initialCategory || null);

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="p-4 border-b border-zinc-200 dark:border-zinc-700">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">3️⃣ Categoria</h2>
        <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">
          Selecione o tipo de problema para ajudar na priorização.
        </p>
      </div>

      <div className="flex-1 overflow-y-auto p-4 grid grid-cols-3 gap-3">
        {categories.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setSelected(cat.id)}
            className={`relative aspect-square rounded-2xl border-2 transition-all ${
              selected === cat.id
                ? `border-2 ${cat.color} bg-gradient-to-br from-${cat.color.replace("bg-", "")}/20 to-${cat.color.replace("bg-", "")}/5`
                : "border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 hover:border-amber-500 hover:bg-amber-50 dark:hover:bg-amber-900/20"
            } flex flex-col items-center justify-center gap-2`}
          >
            <div
              className={`rounded-xl p-3 flex items-center justify-center ${cat.color} text-white shadow-sm ${
                selected === cat.id ? "ring-2 ring-white" : ""
              }`}
            >
              {cat.icon}
            </div>
            <span className="text-sm font-medium text-zinc-900 dark:text-white text-center px-1">
              {cat.label}
            </span>
            {selected === cat.id && (
              <CheckCircle2 className="absolute -top-2 -right-2 w-5 h-5 text-amber-500 bg-white dark:bg-zinc-900 rounded-full border-2 border-white dark:border-zinc-900" />
            )}
          </button>
        ))}
      </div>

      <div className="p-4 border-t border-zinc-200 dark:border-zinc-700 flex gap-3">
        <button
          onClick={onBack}
          className="flex-1 py-3 rounded-xl border border-zinc-300 dark:border-zinc-600 text-zinc-700 dark:text-zinc-300 font-medium hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
        >
          Voltar
        </button>
        <button
          onClick={() => selected && onConfirm(selected)}
          disabled={!selected}
          className="flex-1 py-3 rounded-xl bg-amber-500 hover:bg-amber-600 disabled:bg-zinc-300 dark:disabled:bg-zinc-700 disabled:cursor-not-allowed text-white font-medium transition-colors shadow-sm"
        >
          Próximo
        </button>
      </div>
    </div>
  );
}