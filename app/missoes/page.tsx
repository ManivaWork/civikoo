'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { Map, Flame, Calendar, CalendarDays, Trophy, Coins } from 'lucide-react';
import { useSession } from '@/lib/auth';
import { UserMissionWithTemplate } from '@/app/components/map/types';
import { MissionCard } from '@/app/components/ui/MissionCard';
import { StreakIndicator, type StreakInfo } from '@/app/components/ui/StreakIndicator';
import { getMyMissions, getStreakInfo } from '@/lib/supabase/client';
import { useToast } from '@/app/components/ui/Toast';
import { BottomNavigation } from '@/app/components/ui/BottomNavigation';

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
    <div className="min-h-screen bg-zinc-950 flex flex-col">
      {/* Top Bar */}
      <header className="fixed top-0 left-0 right-0 z-40 bg-zinc-950/95 backdrop-blur-xl border-b border-zinc-800 navbar-safe">
        <div className="max-w-screen-xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3" aria-label="Civikoo - Início">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center">
              <Map className="w-5 h-5 text-white" aria-hidden="true" />
            </div>
            <div className="hidden sm:block">
              <h1 className="text-lg font-bold text-white">Civikoo</h1>
              <p className="text-xs text-zinc-500">Missões</p>
            </div>
          </Link>

          <div className="flex items-center gap-3">
            {/* Streak indicator */}
            {streak && streak.streak_count > 0 && (
              <div className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-amber-500/10 border border-amber-500/20 rounded-xl">
                <Flame className="w-4 h-4 text-amber-500" aria-hidden="true" />
                <span className="text-sm font-bold text-amber-400">{streak.streak_count}</span>
                <span className="text-xs text-zinc-500">dias</span>
              </div>
            )}

            {/* Avatar */}
            <Link
              href="/perfil"
              className="relative w-10 h-10 rounded-xl bg-zinc-900 border border-zinc-800 overflow-hidden flex items-center justify-center hover:border-zinc-700 transition-colors"
              aria-label="Meu perfil"
            >
              {profile?.avatar_url ? (
                <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-amber-500 to-amber-600">
                  <span className="text-white font-bold text-lg">
                    {profile?.username?.charAt(0).toUpperCase() || "?"}
                  </span>
                </div>
              )}
              {hasUnclaimedReward && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center animate-pulse">!</span>
              )}
              <span className="absolute -bottom-1 -right-1 w-5 h-5 bg-amber-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-zinc-950">
                {profile?.level ?? 1}
              </span>
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1 pt-20 pb-24 px-4 max-w-screen-xl mx-auto w-full">
        {/* Header */}
        <div className="mb-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-4">
            <div>
              <h1 className="text-2xl font-bold text-white">Missões</h1>
              <p className="text-zinc-400 text-sm mt-1">Complete missões diárias e semanais para ganhar XP e moedas</p>
            </div>
            {/* Streak display (mobile) */}
            <div className="md:hidden">
              <StreakIndicator streak={streak} size="md" className="w-full justify-center" onClick={() => {}} />
            </div>
          </div>

          {/* Streak display (desktop) */}
          <div className="hidden md:block mb-4">
            <StreakIndicator streak={streak} size="md" onClick={() => {}} />
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="mb-4 flex gap-2 overflow-x-auto pb-2 -mx-4 px-4">
          <button
            onClick={() => setActiveTab('diaria')}
            className={`whitespace-nowrap px-4 py-2 rounded-full text-sm font-medium transition-colors flex items-center gap-2 ${
              activeTab === 'diaria'
                ? 'bg-blue-500 text-white shadow-lg'
                : 'bg-zinc-900 text-zinc-400 border border-zinc-800 hover:bg-zinc-800 hover:text-zinc-200'
            }`}
          >
            <Calendar className="w-4 h-4" aria-hidden="true" />
            <span>Diárias</span>
            {dailyMissions.some(m => m.can_claim) && (
              <span className="px-1.5 py-0.5 bg-amber-500/20 text-amber-400 text-xs rounded-full animate-pulse">
                {dailyMissions.filter(m => m.can_claim).length}
              </span>
            )}
            <span className="px-2 py-0.5 bg-zinc-800 rounded-full text-xs text-zinc-500">
              {dailyMissions.filter(m => m.is_completed).length}/{dailyMissions.length}
            </span>
          </button>
          <button
            onClick={() => setActiveTab('semanal')}
            className={`whitespace-nowrap px-4 py-2 rounded-full text-sm font-medium transition-colors flex items-center gap-2 ${
              activeTab === 'semanal'
                ? 'bg-purple-500 text-white shadow-lg'
                : 'bg-zinc-900 text-zinc-400 border border-zinc-800 hover:bg-zinc-800 hover:text-zinc-200'
            }`}
          >
            <CalendarDays className="w-4 h-4" aria-hidden="true" />
            <span>Semanais</span>
            {weeklyMissions.some(m => m.can_claim) && (
              <span className="px-1.5 py-0.5 bg-amber-500/20 text-amber-400 text-xs rounded-full animate-pulse">
                {weeklyMissions.filter(m => m.can_claim).length}
              </span>
            )}
            <span className="px-2 py-0.5 bg-zinc-800 rounded-full text-xs text-zinc-500">
              {weeklyMissions.filter(m => m.is_completed).length}/{weeklyMissions.length}
            </span>
          </button>
        </div>

        {/* Missions Grid */}
        {loading ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 animate-pulse">
                <div className="h-4 bg-zinc-800 rounded w-3/4 mb-2" />
                <div className="h-3 bg-zinc-800 rounded w-1/2 mb-3" />
                <div className="h-2 bg-zinc-800 rounded-full mb-3" />
                <div className="h-8 bg-zinc-800 rounded w-full" />
              </div>
            ))}
          </div>
        ) : activeMissions.length === 0 ? (
          <div className="text-center py-12 text-zinc-500">
            <div className="text-4xl mb-2">📋</div>
            <p>Nenhuma missão {activeTab === 'diaria' ? 'diária' : 'semanal'} disponível no momento.</p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {activeMissions.map(mission => (
              <MissionCard key={mission.id} mission={mission} onClaimed={handleMissionClaimed} />
            ))}
          </div>
        )}

        {/* Summary */}
        {!loading && activeMissions.length > 0 && (
          <div className="mt-6 p-4 bg-zinc-900 border border-zinc-800 rounded-xl">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div className="flex items-center gap-4 text-sm text-zinc-400">
                <span>Concluídas: <span className="font-bold text-white">{completedCount}</span> de {totalCount}</span>
                {completedCount === totalCount && totalCount > 0 && (
                  <span className="px-2 py-1 bg-green-500/20 text-green-400 rounded-full text-xs font-medium">Todas concluídas! 🎉</span>
                )}
              </div>
              <div className="flex items-center gap-4 text-sm">
                <div className="flex items-center gap-1">
                  <Trophy className="w-4 h-4 text-amber-500" aria-hidden="true" />
                  <span>XP total:</span>
                  <span className="font-bold text-amber-400">
                    {activeMissions.filter(m => m.is_completed).reduce((sum, m) => sum + m.template.reward_xp, 0)}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <Coins className="w-4 h-4 text-amber-500" aria-hidden="true" />
                  <span>Moedas:</span>
                  <span className="font-bold text-amber-400">
                    {activeMissions.filter(m => m.is_completed).reduce((sum, m) => sum + m.template.reward_coins, 0)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      <BottomNavigation />
    </div>
  );
}