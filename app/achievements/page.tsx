'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { RARITY_COLORS, type Achievement, type UserStats } from '@/lib/gamification/xp';

interface AchievementWithStatus extends Achievement {
  unlocked: boolean;
  unlocked_at: string | null;
}

interface StatsWithProgress extends UserStats {
  level_progress: {
    current: number;
    needed: number;
    percentage: number;
  };
}

const CATEGORY_LABELS: Record<string, { label: string; icon: string }> = {
  messages: { label: 'Messages', icon: '💬' },
  memories: { label: 'Memories', icon: '🧠' },
  streaks: { label: 'Streaks', icon: '🔥' },
  milestones: { label: 'Milestones', icon: '🏆' },
  general: { label: 'General', icon: '⭐' },
};

export default function AchievementsPage() {
  const router = useRouter();
  const [stats, setStats] = useState<StatsWithProgress | null>(null);
  const [achievements, setAchievements] = useState<AchievementWithStatus[]>([]);
  const [byCategory, setByCategory] = useState<Record<string, AchievementWithStatus[]>>({});
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [unlockedCount, setUnlockedCount] = useState(0);
  const [totalCount, setTotalCount] = useState(0);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [statsRes, achievementsRes] = await Promise.all([
          fetch('/api/gamification/stats'),
          fetch('/api/gamification/achievements'),
        ]);

        if (!statsRes.ok || !achievementsRes.ok) {
          router.push('/login');
          return;
        }

        const statsData = await statsRes.json();
        const achievementsData = await achievementsRes.json();

        setStats(statsData.stats);
        setAchievements(achievementsData.achievements);
        setByCategory(achievementsData.byCategory);
        setUnlockedCount(achievementsData.unlockedCount);
        setTotalCount(achievementsData.totalCount);
      } catch (error) {
        console.error('Error loading achievements:', error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0A0A0B] flex items-center justify-center">
        <div className="text-white/50 animate-pulse">Loading achievements...</div>
      </div>
    );
  }

  const displayAchievements = selectedCategory === 'all' 
    ? achievements 
    : byCategory[selectedCategory] || [];

  const categories = ['all', ...Object.keys(byCategory)];

  return (
    <div className="min-h-screen bg-[#0A0A0B] text-white">
      {/* Header */}
      <header className="sticky top-0 bg-[#0A0A0B]/95 backdrop-blur-lg border-b border-white/[0.06] z-10">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/chat" className="p-2 -ml-2 text-white/60 hover:text-white transition-colors">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
            <h1 className="text-xl font-semibold">Achievements</h1>
          </div>
          <div className="text-sm text-white/50">
            {unlockedCount}/{totalCount} unlocked
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-6 space-y-8">
        {/* Stats Overview */}
        {stats && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {/* Level Card */}
            <div className="col-span-2 bg-gradient-to-br from-orange-500/20 to-orange-600/10 border border-orange-500/30 rounded-2xl p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-orange-300/70 text-sm">Level</p>
                  <p className="text-4xl font-bold text-orange-300">{stats.level}</p>
                </div>
                <div className="w-16 h-16 bg-gradient-to-br from-orange-500 to-orange-600 rounded-full flex items-center justify-center text-2xl shadow-lg shadow-orange-500/30">
                  ⭐
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-white/60">XP Progress</span>
                  <span className="text-orange-300">{stats.level_progress.current}/{stats.level_progress.needed}</span>
                </div>
                <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-orange-500 to-orange-400 rounded-full transition-all duration-500"
                    style={{ width: `${stats.level_progress.percentage}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Streak */}
            <div className="bg-[#1a1a1b] border border-white/[0.06] rounded-2xl p-5">
              <p className="text-white/50 text-sm mb-1">Current Streak</p>
              <p className="text-3xl font-bold flex items-center gap-2">
                {stats.current_streak}
                <span className="text-xl">🔥</span>
              </p>
              <p className="text-white/40 text-xs mt-1">Best: {stats.longest_streak}</p>
            </div>

            {/* Total XP */}
            <div className="bg-[#1a1a1b] border border-white/[0.06] rounded-2xl p-5">
              <p className="text-white/50 text-sm mb-1">Total XP</p>
              <p className="text-3xl font-bold text-gradient">{stats.total_xp.toLocaleString()}</p>
            </div>

            {/* Messages */}
            <div className="bg-[#1a1a1b] border border-white/[0.06] rounded-2xl p-4">
              <p className="text-white/50 text-xs mb-1">Messages</p>
              <p className="text-xl font-semibold">{stats.messages_sent}</p>
            </div>

            {/* Memories */}
            <div className="bg-[#1a1a1b] border border-white/[0.06] rounded-2xl p-4">
              <p className="text-white/50 text-xs mb-1">Memories</p>
              <p className="text-xl font-semibold">{stats.memories_created}</p>
            </div>

            {/* Days Active */}
            <div className="bg-[#1a1a1b] border border-white/[0.06] rounded-2xl p-4">
              <p className="text-white/50 text-xs mb-1">Days Active</p>
              <p className="text-xl font-semibold">{stats.days_active}</p>
            </div>

            {/* Achievements */}
            <div className="bg-[#1a1a1b] border border-white/[0.06] rounded-2xl p-4">
              <p className="text-white/50 text-xs mb-1">Badges</p>
              <p className="text-xl font-semibold">{unlockedCount}</p>
            </div>
          </div>
        )}

        {/* Category Tabs */}
        <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-hide">
          {categories.map(cat => {
            const catInfo = cat === 'all' ? { label: 'All', icon: '🎯' } : CATEGORY_LABELS[cat] || { label: cat, icon: '📦' };
            const count = cat === 'all' ? achievements.length : (byCategory[cat]?.length || 0);
            const unlockedInCat = cat === 'all' 
              ? unlockedCount 
              : (byCategory[cat]?.filter(a => a.unlocked).length || 0);
            
            return (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${
                  selectedCategory === cat
                    ? 'bg-orange-500/20 text-orange-300 border border-orange-500/30'
                    : 'bg-white/[0.04] text-white/60 border border-white/[0.06] hover:bg-white/[0.08]'
                }`}
              >
                <span>{catInfo.icon}</span>
                <span>{catInfo.label}</span>
                <span className={`text-xs ${selectedCategory === cat ? 'text-orange-300/70' : 'text-white/40'}`}>
                  {unlockedInCat}/{count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Achievements Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {displayAchievements.map(achievement => {
            const colors = RARITY_COLORS[achievement.rarity];
            
            return (
              <div
                key={achievement.id}
                className={`relative rounded-2xl p-5 border transition-all ${
                  achievement.unlocked
                    ? `bg-gradient-to-br ${colors.bg} ${colors.border} shadow-lg ${colors.glow}`
                    : 'bg-[#1a1a1b]/50 border-white/[0.04] opacity-60'
                }`}
              >
                {/* Rarity badge */}
                <div className={`absolute top-3 right-3 text-[10px] font-medium uppercase tracking-wider ${
                  achievement.unlocked ? colors.text : 'text-white/30'
                }`}>
                  {achievement.rarity}
                </div>

                <div className="flex items-start gap-4">
                  {/* Icon */}
                  <div className={`w-14 h-14 rounded-xl flex items-center justify-center text-2xl ${
                    achievement.unlocked 
                      ? 'bg-white/10' 
                      : 'bg-white/[0.04] grayscale'
                  }`}>
                    {achievement.unlocked ? achievement.icon : '🔒'}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <h3 className={`font-semibold text-lg mb-1 ${
                      achievement.unlocked ? 'text-white' : 'text-white/50'
                    }`}>
                      {achievement.name}
                    </h3>
                    <p className={`text-sm ${
                      achievement.unlocked ? 'text-white/70' : 'text-white/40'
                    }`}>
                      {achievement.description}
                    </p>
                    
                    {/* XP reward */}
                    <div className="flex items-center gap-3 mt-3">
                      <span className={`text-sm font-medium ${
                        achievement.unlocked ? colors.text : 'text-white/40'
                      }`}>
                        +{achievement.xp_reward} XP
                      </span>
                      {achievement.unlocked && achievement.unlocked_at && (
                        <span className="text-xs text-white/40">
                          {new Date(achievement.unlocked_at).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Unlocked checkmark */}
                {achievement.unlocked && (
                  <div className="absolute bottom-3 right-3">
                    <svg className={`w-6 h-6 ${colors.text}`} fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {displayAchievements.length === 0 && (
          <div className="text-center py-12 text-white/40">
            No achievements in this category yet.
          </div>
        )}
      </main>
    </div>
  );
}
