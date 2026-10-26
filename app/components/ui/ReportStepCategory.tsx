"use client";

import { useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { CATEGORY_CONFIG, ReportCategory } from "@/app/components/map/types";

type Category = ReportCategory;

const categories: { id: Category; label: string; icon: string; color: string; bgColor: string }[] = [
  { id: "buraco_asfalto", label: "Buraco", icon: "🕳️", color: "bg-orange-500", bgColor: "bg-orange-100" },
  { id: "iluminacao", label: "Iluminação", icon: "💡", color: "bg-amber-500", bgColor: "bg-amber-100" },
  { id: "lixo_entulho", label: "Lixo", icon: "🗑️", color: "bg-green-500", bgColor: "bg-green-100" },
  { id: "vegetacao", label: "Vegetação", icon: "🌳", color: "bg-emerald-500", bgColor: "bg-emerald-100" },
  { id: "sinalizacao", label: "Sinalização", icon: "🚦", color: "bg-blue-500", bgColor: "bg-blue-100" },
  { id: "acessibilidade", label: "Acessibilidade", icon: "♿", color: "bg-purple-500", bgColor: "bg-purple-100" },
  { id: "mobiliario_urbano", label: "Mobiliário", icon: "🪑", color: "bg-zinc-500", bgColor: "bg-zinc-100" },
  { id: "vazamento_agua", label: "Vazamento", icon: "💧", color: "bg-blue-600", bgColor: "bg-blue-100" },
  { id: "outro", label: "Outro", icon: "📦", color: "bg-gray-500", bgColor: "bg-gray-100" },
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
        {categories.map((cat) => {
          const config = CATEGORY_CONFIG[cat.id];
          return (
            <button
              key={cat.id}
              onClick={() => setSelected(cat.id)}
              className={`relative aspect-square rounded-2xl border-2 transition-all ${
                selected === cat.id
                  ? `border-2 ${config.color.replace("text-", "border-")} ${config.bgColor} dark:bg-opacity-30`
                  : "border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 hover:border-amber-500 hover:bg-amber-50 dark:hover:bg-amber-900/20"
              } flex flex-col items-center justify-center gap-2`}
            >
              <div
                className={`rounded-xl p-3 flex items-center justify-center ${config.color} text-white shadow-sm ${
                  selected === cat.id ? "ring-2 ring-white" : ""
                }`}
              >
                <span className="text-2xl">{config.icon}</span>
              </div>
              <span className="text-sm font-medium text-zinc-900 dark:text-white text-center px-1">
                {config.label}
              </span>
              {selected === cat.id && (
                <CheckCircle2 className="absolute -top-2 -right-2 w-5 h-5 text-amber-500 bg-white dark:bg-zinc-900 rounded-full border-2 border-white dark:border-zinc-900" />
              )}
            </button>
          );
        })}
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