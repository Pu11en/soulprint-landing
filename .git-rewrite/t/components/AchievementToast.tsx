'use client';

import { useState, useEffect, useCallback } from 'react';
import { RARITY_COLORS, type Achievement } from '@/lib/gamification/xp';

interface ToastProps {
  achievement: Achievement;
  onClose: () => void;
}

function Toast({ achievement, onClose }: ToastProps) {
  const colors = RARITY_COLORS[achievement.rarity];
  
  useEffect(() => {
    const timer = setTimeout(onClose, 5000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div 
      className={`animate-slide-up bg-gradient-to-br ${colors.bg} border ${colors.border} rounded-2xl p-4 shadow-xl ${colors.glow} backdrop-blur-lg`}
      onClick={onClose}
    >
      <div className="flex items-center gap-4">
        {/* Icon */}
        <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center text-2xl animate-bounce-once">
          {achievement.icon}
        </div>
        
        {/* Content */}
        <div className="flex-1">
          <p className="text-xs text-white/60 uppercase tracking-wider mb-0.5">
            Achievement Unlocked!
          </p>
          <h4 className="font-semibold text-white">{achievement.name}</h4>
          <p className={`text-sm ${colors.text}`}>+{achievement.xp_reward} XP</p>
        </div>

        {/* Close hint */}
        <div className="text-white/30 text-xs">tap to close</div>
      </div>
    </div>
  );
}

interface AchievementToastProviderProps {
  children: React.ReactNode;
}

// Global state for toasts
let toastQueue: Achievement[] = [];
let toastSetters: ((a: Achievement[]) => void)[] = [];

export function showAchievementToast(achievement: Achievement) {
  toastQueue = [...toastQueue, achievement];
  toastSetters.forEach(setter => setter([...toastQueue]));
}

export function showAchievementToasts(achievements: Achievement[]) {
  achievements.forEach((a, i) => {
    setTimeout(() => showAchievementToast(a), i * 1000);
  });
}

export function AchievementToastProvider({ children }: AchievementToastProviderProps) {
  const [toasts, setToasts] = useState<Achievement[]>([]);

  useEffect(() => {
    toastSetters.push(setToasts);
    return () => {
      toastSetters = toastSetters.filter(s => s !== setToasts);
    };
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
    toastQueue = toastQueue.filter(t => t.id !== id);
  }, []);

  return (
    <>
      {children}
      
      {/* Toast container */}
      <div className="fixed bottom-24 left-4 right-4 z-50 flex flex-col gap-3 pointer-events-none">
        {toasts.map(achievement => (
          <div key={achievement.id} className="pointer-events-auto">
            <Toast 
              achievement={achievement} 
              onClose={() => removeToast(achievement.id)} 
            />
          </div>
        ))}
      </div>
    </>
  );
}
