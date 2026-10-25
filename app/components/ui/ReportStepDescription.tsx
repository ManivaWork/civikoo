"use client";

import { useState, useRef, useEffect } from "react";

interface ReportStepDescriptionProps {
  onConfirm: (description: string) => void;
  onBack: () => void;
  initialDescription?: string;
}

export function ReportStepDescription({ onConfirm, onBack, initialDescription = "" }: ReportStepDescriptionProps) {
  const [description, setDescription] = useState(initialDescription);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const charCount = description.length;

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="p-4 border-b border-zinc-200 dark:border-zinc-700">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">4️⃣ Descrição</h2>
        <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">
          Adicione detalhes opcionais (ex.: tamanho do buraco, horário do problema).
        </p>
      </div>

      <div className="flex-1 flex flex-col p-4">
        <textarea
          ref={textareaRef}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Descreva o problema com mais detalhes (opcional)..."
          className="flex-1 min-h-[120px] max-h-[200px] resize-y px-4 py-3 rounded-xl border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent font-medium"
          maxLength={500}
          rows={5}
        />
        <div className="flex justify-end mt-2">
          <span className={`text-xs ${charCount > 450 ? "text-amber-600" : "text-zinc-500 dark:text-zinc-400"}`}>
            {charCount}/500
          </span>
        </div>
      </div>

      <div className="p-4 border-t border-zinc-200 dark:border-zinc-700 flex gap-3">
        <button
          onClick={onBack}
          className="flex-1 py-3 rounded-xl border border-zinc-300 dark:border-zinc-600 text-zinc-700 dark:text-zinc-300 font-medium hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
        >
          Voltar
        </button>
        <button
          onClick={() => onConfirm(description.trim())}
          className="flex-1 py-3 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-medium transition-colors shadow-sm"
        >
          Próximo
        </button>
      </div>
    </div>
  );
}