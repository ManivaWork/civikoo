'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useSession } from '@/lib/auth';
import { UserMissionWithTemplate } from '@/app/components/map/types';
import { MissionCard } from '@/app/components/ui/MissionCard';
import { StreakIndicator, type StreakInfo } from '@/app/components/ui/StreakIndicator';
import { getMyMissions, getStreakInfo } from '@/lib/supabase/client';
import { useToast } from '@/app/components/ui/Toast';

export default function MissoesPage() {
  const { user, profile } = useSession();
  const { show } = useToast();
  const [missions, setMissions] = useState<UserMissionWithTemplate[]>([]);
  const [streak, setStreak] = useState<StreakInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'diaria' | 'semanal'>('diaria');
  const [hasUnclaimedReward, setHasUnclaimedReward] = useState(false);

  const loadData = useCallback(async () => {
    if (!user) return;
    try {
      setLoading(true);
      const [missionsData, streakData] = await Promise.all([
        getMyMissions(),
        getStreakInfo(user.id),
      ]);
      setMissions(missionsData);
      setStreak(streakData);

      // Check for unclaimed rewards
      const unclaimed = missionsData.some(m => m.can_claim);
      setHasUnclaimedReward(unclaimed);
    } catch (err) {
      console.error('Erro ao carregar missões:', err);
      show('Erro ao carregar missões', 'error');
    } finally {
      setLoading(false);
    }
  }, [user, show]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleMissionClaimed = useCallback(() => {
    loadData();
  }, [loadData]);

  const dailyMissions = missions.filter(m => m.template.type === 'diaria');
  const weeklyMissions = missions.filter(m => m.template.type === 'semanal');
  const activeMissions = activeTab === 'diaria' ? dailyMissions : weeklyMissions;

  const completedCount = activeMissions.filter(m => m.is_completed && !m.is_claimed).length;
  const totalCount = activeMissions.length;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Navbar */}
      <nav className="navbar-safe fixed top-0 left-0 right-0 z-40 bg-white/90 dark:bg-gray-900/90 backdrop-blur-md border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-screen-xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/" className="text-xl font-bold text-amber-600 dark:text-amber-400">
            Civikoo
          </Link>
          <div className="flex items-center gap-4">
            <Link href="/perfil" className="flex items-center gap-2 px-3 py-2 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 text-sm font-medium">
              <span className="text-lg">👤</span>
              <span>{profile?.username}</span>
              <span className="px-2 py-0.5 bg-amber-600 text-white text-xs rounded-full font-bold">
                Nv.{profile?.level ?? 1}
              </span>
            </Link>
            <StreakIndicatorCompact streak={streak} onClick={() => {}} />
          </div>
        </div>
      </nav>

      <main className="pt-20 pb-24 px-4 max-w-screen-xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Missões</h1>
              <p className="text-gray-600 dark:text-gray-400 text-sm mt-1">
                Complete missões diárias e semanais para ganhar XP e moedas
              </p>
            </div>
            {/* Streak display */}
            <div className="hidden md:block">
              <StreakIndicator streak={streak} size="md" onClick={() => {}} />
            </div>
          </div>
        </div>

        {/* Streak Banner (mobile) */}
        <div className="md:hidden mb-4">
          <StreakIndicator streak={streak} size="md" className="w-full justify-center" onClick={() => {}} />
        </div>

        {/* Tab Navigation */}
        <div className="mb-4 flex gap-2 overflow-x-auto pb-2 -mx-4 px-4">
          <button
            onClick={() => setActiveTab('diaria')}
            className={`whitespace-nowrap px-4 py-2 rounded-full text-sm font-medium transition-colors flex items-center gap-2 ${
              activeTab === 'diaria'
                ? 'bg-blue-600 text-white shadow-lg'
                : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700'
            }`}
          >
            <span>📅</span>
            <span>Diárias</span>
            {dailyMissions.some(m => m.can_claim) && (
              <span className="px-1.5 py-0.5 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 text-xs rounded-full animate-pulse">
                {dailyMissions.filter(m => m.can_claim).length}
              </span>
            )}
            <span className="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 rounded-full text-xs text-gray-500 dark:text-gray-400">
              {dailyMissions.filter(m => m.is_completed).length}/{dailyMissions.length}
            </span>
          </button>
          <button
            onClick={() => setActiveTab('semanal')}
            className={`whitespace-nowrap px-4 py-2 rounded-full text-sm font-medium transition-colors flex items-center gap-2 ${
              activeTab === 'semanal'
                ? 'bg-purple-600 text-white shadow-lg'
                : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700'
            }`}
          >
            <span>📆</span>
            <span>Semanais</span>
            {weeklyMissions.some(m => m.can_claim) && (
              <span className="px-1.5 py-0.5 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 text-xs rounded-full animate-pulse">
                {weeklyMissions.filter(m => m.can_claim).length}
              </span>
            )}
            <span className="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 rounded-full text-xs text-gray-500 dark:text-gray-400">
              {weeklyMissions.filter(m => m.is_completed).length}/{weeklyMissions.length}
            </span>
          </button>
        </div>

        {/* Missions Grid */}
        {loading ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 animate-pulse">
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mb-2" />
                <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/2 mb-3" />
                <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full mb-3" />
                <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-full" />
              </div>
            ))}
          </div>
        ) : activeMissions.length === 0 ? (
          <div className="text-center py-12 text-gray-500 dark:text-gray-400">
            <div className="text-4xl mb-2">📋</div>
            <p>Nenhuma missão {activeTab === 'diaria' ? 'diária' : 'semanal'} disponível no momento.</p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {activeMissions.map(mission => (
              <MissionCard
                key={mission.id}
                mission={mission}
                onClaimed={handleMissionClaimed}
              />
            ))}
          </div>
        )}

        {/* Summary */}
        {!loading && activeMissions.length > 0 && (
          <div className="mt-6 p-4 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
                <span>Concluídas: <span className="font-bold text-gray-900 dark:text-white">{completedCount}</span> de {totalCount}</span>
                {completedCount === totalCount && totalCount > 0 && (
                  <span className="px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-full text-xs font-medium">
                    Todas concluídas! 🎉
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 text-sm">
                <span className="text-gray-500 dark:text-gray-400">XP total:</span>
                <span className="font-bold text-purple-600 dark:text-purple-400">
                  {activeMissions.filter(m => m.is_completed).reduce((sum, m) => sum + m.template.reward_xp, 0)}
                </span>
                <span className="text-gray-500 dark:text-gray-400">Moedas:</span>
                <span className="font-bold text-amber-600 dark:text-amber-400">
                  {activeMissions.filter(m => m.is_completed).reduce((sum, m) => sum + m.template.reward_coins, 0)}
                </span>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Bottom Nav */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-gray-900/95 backdrop-blur-md border-t border-gray-200 dark:border-gray-700 bottom-sheet-safe">
        <div className="grid grid-cols-4 max-w-screen-xl mx-auto">
          <Link href="/" className="flex flex-col items-center py-3 text-gray-500 dark:text-gray-400 hover:text-amber-600 dark:hover:text-amber-400 transition-colors">
            <span className="text-xl">🗺️</span>
            <span className="text-xs font-medium">Mapa</span>
          </Link>
          <Link href="/loja" className="flex flex-col items-center py-3 text-gray-500 dark:text-gray-400 hover:text-amber-600 dark:hover:text-amber-400 transition-colors">
            <span className="text-xl">🛍️</span>
            <span className="text-xs font-medium">Loja</span>
          </Link>
          <Link href="/armario" className="flex flex-col items-center py-3 text-gray-500 dark:text-gray-400 hover:text-amber-600 dark:hover:text-amber-400 transition-colors">
            <span className="text-xl">👕</span>
            <span className="text-xs font-medium">Armário</span>
          </Link>
          <Link href="/perfil" className="flex flex-col items-center py-3 text-gray-500 dark:text-gray-400 hover:text-amber-600 dark:hover:text-amber-400 transition-colors relative">
            <span className="text-xl relative">👤</span>
            {hasUnclaimedReward && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center animate-pulse">!</span>
            )}
            <span className="text-xs font-medium">Perfil</span>
          </Link>
        </div>
      </nav>
    </div>
  );
}

// Compact streak indicator for navbar
import { FC, memo } from 'react';

const StreakIndicatorCompact: FC<{ streak?: StreakInfo | null; onClick?: () => void }> = memo(function StreakIndicatorCompact({
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