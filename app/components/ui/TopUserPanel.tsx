"use client";

import { Trophy, Star, Flame } from "lucide-react";

interface TopUserPanelProps {
  level: number;
  totalScore: number;
  currentStreak: number;
}

export function TopUserPanel({ level, totalScore, currentStreak }: TopUserPanelProps) {
  return (
    <div className="fixed top-4 left-4 right-4 z-30 flex justify-center pointer-events-none">
      <div className="pointer-events-auto flex items-center gap-3 bg-white/90 dark:bg-zinc-900/90 backdrop-blur-sm rounded-2xl px-5 py-2.5 shadow-lg border border-zinc-200/50 dark:border-zinc-800/50">
        {/* Level & Score */}
        <div className="flex items-center gap-2">
          <div className="relative flex items-center justify-center w-8 h-8 rounded-full bg-amber-100 dark:bg-amber-900/30">
            <Trophy className="w-4 h-4 text-amber-600 dark:text-amber-400" aria-hidden="true" />
            <span className="absolute -top-1 -right-1 w-5 h-5 text-xs font-bold text-amber-600 dark:text-amber-400 bg-white dark:bg-zinc-900 rounded-full flex items-center justify-center">
              {level}
            </span>
          </div>
          <div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 font-medium">NÍVEL</p>
            <p className="text-lg font-bold text-zinc-900 dark:text-white">{totalScore.toLocaleString()} XP</p>
          </div>
        </div>

        <div className="hidden md:flex h-6 w-px bg-zinc-200 dark:bg-zinc-700" aria-hidden="true" />

        {/* Streak */}
        <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-amber-50 dark:bg-amber-900/20">
            <Flame className="w-4 h-4" aria-hidden="true" />
          </div>
          <div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 font-medium">SEQUÊNCIA</p>
            <p className="text-lg font-bold text-zinc-900 dark:text-white">{currentStreak} dias</p>
          </div>
        </div>
      </div>
    </div>
  );
}