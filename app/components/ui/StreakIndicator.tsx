'use client';

import { FC, memo, useState, useEffect } from 'react';
import { StreakInfo, STREAK_MILESTONES } from '@/app/components/map/types';

export type { StreakInfo } from '@/app/components/map/types';

interface StreakIndicatorProps {
  streak?: StreakInfo | null;
  size?: 'sm' | 'md' | 'lg';
  showNextMilestone?: boolean;
  className?: string;
  onClick?: () => void;
}

const SIZE_CONFIG = {
  sm: { iconSize: '1.25rem', fontSize: '0.75rem', gap: '0.25rem', padding: '0.25rem 0.5rem' },
  md: { iconSize: '1.5rem', fontSize: '0.875rem', gap: '0.375rem', padding: '0.375rem 0.75rem' },
  lg: { iconSize: '2rem', fontSize: '1rem', gap: '0.5rem', padding: '0.5rem 1rem' },
};

const MILESTONE_LABELS: Record<number, string> = {
  3: '3 dias 🌱',
  7: '7 dias 🌿',
  14: '14 dias 🌳',
  30: '30 dias 🏆',
};

export const StreakIndicator: FC<StreakIndicatorProps> = memo(function StreakIndicator({
  streak = null,
  size = 'md',
  showNextMilestone = true,
  className = '',
  onClick,
}) {
  const config = SIZE_CONFIG[size];
  const [animatedCount, setAnimatedCount] = useState(0);

  useEffect(() => {
    if (streak) {
      // Animate count up
      const target = streak.streak_count;
      let current = 0;
      const duration = 800;
      const steps = 20;
      const increment = target / steps;
      const interval = duration / steps;

      const timer = setInterval(() => {
        current += increment;
        if (current >= target) {
          setAnimatedCount(target);
          clearInterval(timer);
        } else {
          setAnimatedCount(Math.floor(current));
        }
      }, interval);

      return () => clearInterval(timer);
    }
  }, [streak?.streak_count]);

  if (!streak || streak.streak_count === 0) {
    return (
      <button
        onClick={onClick}
        className={`inline-flex items-center gap-1.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 transition-colors hover:bg-gray-200 dark:hover:bg-gray-700 ${className}`}
        style={{
          fontSize: config.fontSize,
          gap: config.gap,
          padding: config.padding,
        }}
        disabled={!onClick}
        aria-label="Sequência diária: 0 dias"
      >
        <span style={{ fontSize: config.iconSize }}>🔥</span>
        <span className="font-medium">0 dias</span>
      </button>
    );
  }

  const nextMilestone = streak.next_milestone;
  const daysToNext = streak.days_to_next_milestone;

  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-amber-100 to-orange-100 dark:from-amber-900/30 dark:to-orange-900/30 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-700 font-medium transition-all duration-200 hover:shadow-lg ${className}`}
      style={{
        fontSize: config.fontSize,
        gap: config.gap,
        padding: config.padding,
      }}
      disabled={!onClick}
      aria-label={`Sequência diária: ${animatedCount} dias${nextMilestone ? `, próximo marco em ${daysToNext} dia(s)` : ''}`}
    >
      <span style={{ fontSize: config.iconSize }} role="img" aria-label="fogo">🔥</span>
      <span className="font-bold">{animatedCount} dias</span>
      {showNextMilestone && nextMilestone && daysToNext !== null && daysToNext > 0 && (
        <span className="px-1.5 py-0.5 rounded-full bg-white/50 dark:bg-gray-800/50 text-xs font-semibold">
          → {MILESTONE_LABELS[nextMilestone] || `${nextMilestone} dias`} ({daysToNext} dia{daysToNext !== 1 ? 's' : ''})
        </span>
      )}
      {showNextMilestone && nextMilestone && daysToNext === 0 && (
        <span className="px-1.5 py-0.5 rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 text-xs font-semibold animate-pulse">
          ✓ Marco pronto!
        </span>
      )}
    </button>
  );
});

StreakIndicator.displayName = 'StreakIndicator';

// Compact version for navbar
export const StreakIndicatorCompact: FC<{ streak?: StreakInfo | null; onClick?: () => void }> = memo(function StreakIndicatorCompact({
  streak = null,
  onClick,
}) {
  if (!streak || streak.streak_count === 0) return null;

  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-gradient-to-r from-amber-100 to-orange-100 dark:from-amber-900/30 dark:to-orange-900/30 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-700 text-xs font-bold"
      aria-label={`Streak: ${streak.streak_count} dias`}
    >
      <span>🔥</span>
      <span>{streak.streak_count}</span>
    </button>
  );
});

StreakIndicatorCompact.displayName = 'StreakIndicatorCompact';