'use client';

import { FC, memo, useState, useEffect } from 'react';
import { UserMissionWithTemplate } from '@/app/components/map/types';
import { getMissionTypeLabel, getMissionMetricLabel, MISSION_METRIC_LABELS } from '@/app/components/map/types';
import { useToast } from '@/app/components/ui/Toast';
import { claimMission } from '@/lib/supabase/client';

interface MissionCardProps {
  mission: UserMissionWithTemplate;
  onClaimed?: () => void;
  showTimeRemaining?: boolean;
}

function formatTimeRemaining(periodStart: string, type: 'diaria' | 'semanal'): string {
  const start = new Date(periodStart + 'T00:00:00-03:00'); // BRT
  const now = new Date();

  let end: Date;
  if (type === 'diaria') {
    end = new Date(start);
    end.setDate(end.getDate() + 1);
  } else {
    end = new Date(start);
    end.setDate(end.getDate() + 7);
  }

  const diffMs = end.getTime() - now.getTime();
  if (diffMs <= 0) return 'Expirado';

  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

  if (diffHours > 24) {
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ${diffHours % 24}h`;
  }
  if (diffHours > 0) {
    return `${diffHours}h ${diffMinutes}m`;
  }
  return `${diffMinutes}m`;
}

export const MissionCard: FC<MissionCardProps> = memo(function MissionCard({
  mission,
  onClaimed,
  showTimeRemaining = true,
}) {
  const { show } = useToast();
  const [claiming, setClaiming] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState('');
  const [progressPercent, setProgressPercent] = useState(0);

  const { template } = mission;
  const isCompleted = mission.progress >= template.target && mission.completed_at && !mission.claimed_at;
  const isClaimed = mission.claimed_at !== null;

  useEffect(() => {
    setProgressPercent(Math.min(100, (mission.progress / template.target) * 100));

    if (showTimeRemaining) {
      const updateTime = () => {
        setTimeRemaining(formatTimeRemaining(mission.period_start, template.type));
      };
      updateTime();
      const interval = setInterval(updateTime, 60000); // Update every minute
      return () => clearInterval(interval);
    }
  }, [mission, template, showTimeRemaining]);

  const handleClaim = async () => {
    if (claiming || !isCompleted) return;

    setClaiming(true);
    try {
      const result = await claimMission(mission.id);
      show(result.message, 'success');
      onClaimed?.();
    } catch (err: any) {
      show(err.message, 'error');
    } finally {
      setClaiming(false);
    }
  };

  const getTypeColor = (type: 'diaria' | 'semanal') => {
    return type === 'diaria'
      ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border-blue-300 dark:border-blue-700'
      : 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 border-purple-300 dark:border-purple-700';
  };

  const getMetricIcon = (metric: string) => {
    const icons: Record<string, string> = {
      reportes: '📝',
      confirmacoes: '✅',
      resolucoes: '🏆',
      reportes_categoria: '🎯',
    };
    return icons[metric] || '📋';
  };

  return (
    <div className={`relative bg-white dark:bg-gray-800 rounded-xl border-2 transition-all duration-300 ${
      isCompleted && !isClaimed
        ? 'border-amber-400 ring-2 ring-amber-400/50 animate-pulse'
        : 'border-gray-200 dark:border-gray-700'
    } ${isClaimed ? 'opacity-60' : ''}`}>
      {/* Completed/Claimed badge */}
      {(isCompleted && !isClaimed) && (
        <div className="absolute top-2 right-2 z-10">
          <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 animate-bounce">
            ✓ Pronto para resgatar
          </span>
        </div>
      )}
      {isClaimed && (
        <div className="absolute top-2 right-2 z-10">
          <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400">
            ✓ Resgatado
          </span>
        </div>
      )}

      <div className="p-4">
        {/* Header: Type + Metric */}
        <div className="flex items-center justify-between mb-3">
          <span className={`px-2 py-1 rounded-full text-xs font-semibold ${getTypeColor(template.type)}`}>
            {getMissionTypeLabel(template.type)}
          </span>
          <span className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
            {getMetricIcon(template.metric)}
            {getMissionMetricLabel(template.metric as keyof typeof MISSION_METRIC_LABELS)}
            {template.category && ` (${template.category})`}
          </span>
        </div>

        {/* Title */}
        <h3 className="font-semibold text-gray-900 dark:text-white text-base mb-1">
          {template.title}
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
          {template.description}
        </p>

        {/* Progress Bar */}
        <div className="mb-3">
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="text-gray-600 dark:text-gray-400">Progresso</span>
            <span className="font-bold text-gray-900 dark:text-white">
              {mission.progress} / {template.target}
            </span>
          </div>
          <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                isCompleted ? 'bg-gradient-to-r from-amber-400 to-amber-600' : 'bg-gradient-to-r from-blue-400 to-blue-600'
              }`}
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        {/* Rewards + Action */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 text-sm">
            <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400 font-semibold">
              🪙 {template.reward_coins}
            </span>
            <span className="flex items-center gap-1 text-purple-600 dark:text-purple-400 font-semibold">
              ⭐ {template.reward_xp}
            </span>
          </div>

          {isClaimed ? (
            <button className="w-full py-2 bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 rounded-lg text-sm font-medium" disabled>
              Resgatado
            </button>
          ) : isCompleted ? (
            <button
              onClick={handleClaim}
              disabled={claiming}
              className="w-full py-2 bg-gradient-to-r from-amber-500 to-amber-600 text-white rounded-lg text-sm font-medium hover:from-amber-600 hover:to-amber-700 active:from-amber-700 active:to-amber-800 transition-all disabled:opacity-75 disabled:cursor-wait flex items-center justify-center gap-2"
            >
              {claiming ? (
                <>
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Resgatando...
                </>
              ) : (
                <>
                  <span>🎁</span>
                  Resgatar
                </>
              )}
            </button>
          ) : (
            <button className="w-full py-2 bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 rounded-lg text-sm font-medium" disabled>
              Em progresso
            </button>
          )}

          {showTimeRemaining && timeRemaining && (
            <span className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap ml-2">
              ⏱ {timeRemaining}
            </span>
          )}
        </div>
      </div>
    </div>
  );
});

MissionCard.displayName = 'MissionCard';