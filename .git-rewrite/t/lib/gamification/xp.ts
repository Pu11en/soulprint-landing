// XP System Configuration

export const XP_CONFIG = {
  // XP awarded for actions
  actions: {
    message_sent: 10,
    memory_created: 25,
    daily_login: 15,
    streak_bonus: 5, // multiplied by streak day
  },
  
  // Level thresholds (XP needed to reach each level)
  // Formula: level * 100 * (1 + level * 0.1)
  getLevelThreshold: (level: number): number => {
    return Math.floor(level * 100 * (1 + level * 0.1));
  },
  
  // Calculate level from total XP
  calculateLevel: (totalXp: number): number => {
    let level = 1;
    let xpNeeded = 0;
    while (true) {
      const threshold = XP_CONFIG.getLevelThreshold(level);
      if (xpNeeded + threshold > totalXp) break;
      xpNeeded += threshold;
      level++;
    }
    return level;
  },
  
  // Get XP progress to next level
  getLevelProgress: (totalXp: number): { current: number; needed: number; percentage: number } => {
    const level = XP_CONFIG.calculateLevel(totalXp);
    let xpForPreviousLevels = 0;
    for (let i = 1; i < level; i++) {
      xpForPreviousLevels += XP_CONFIG.getLevelThreshold(i);
    }
    const xpInCurrentLevel = totalXp - xpForPreviousLevels;
    const xpNeededForNextLevel = XP_CONFIG.getLevelThreshold(level);
    return {
      current: xpInCurrentLevel,
      needed: xpNeededForNextLevel,
      percentage: Math.floor((xpInCurrentLevel / xpNeededForNextLevel) * 100),
    };
  },
};

export type XPSource = 'message' | 'memory' | 'streak' | 'achievement' | 'daily_bonus';

export interface XPGain {
  amount: number;
  source: XPSource;
  description?: string;
}

export interface UserStats {
  id: string;
  user_id: string;
  total_xp: number;
  level: number;
  current_streak: number;
  longest_streak: number;
  last_active_date: string | null;
  messages_sent: number;
  memories_created: number;
  days_active: number;
}

export interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string;
  xp_reward: number;
  category: string;
  requirement_type: string;
  requirement_value: number;
  rarity: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
}

export interface UserAchievement {
  id: string;
  user_id: string;
  achievement_id: string;
  unlocked_at: string;
  notified: boolean;
  achievement?: Achievement;
}

export const RARITY_COLORS = {
  common: {
    bg: 'from-gray-500/20 to-gray-600/20',
    border: 'border-gray-500/30',
    text: 'text-gray-300',
    glow: 'shadow-gray-500/20',
  },
  uncommon: {
    bg: 'from-green-500/20 to-green-600/20',
    border: 'border-green-500/30',
    text: 'text-green-300',
    glow: 'shadow-green-500/20',
  },
  rare: {
    bg: 'from-blue-500/20 to-blue-600/20',
    border: 'border-blue-500/30',
    text: 'text-blue-300',
    glow: 'shadow-blue-500/20',
  },
  epic: {
    bg: 'from-purple-500/20 to-purple-600/20',
    border: 'border-purple-500/30',
    text: 'text-purple-300',
    glow: 'shadow-purple-500/20',
  },
  legendary: {
    bg: 'from-orange-500/20 to-yellow-500/20',
    border: 'border-orange-400/40',
    text: 'text-orange-300',
    glow: 'shadow-orange-500/30',
  },
};
