import { describe, it, expect } from 'vitest';
import { XP_CONFIG } from '@/lib/gamification/xp';

describe('XP System', () => {
  describe('getLevelThreshold', () => {
    it('calculates correct XP threshold for level 1', () => {
      const threshold = XP_CONFIG.getLevelThreshold(1);
      expect(threshold).toBe(110); // 1 * 100 * (1 + 1 * 0.1) = 110
    });

    it('calculates correct XP threshold for level 2', () => {
      const threshold = XP_CONFIG.getLevelThreshold(2);
      expect(threshold).toBe(240); // 2 * 100 * (1 + 2 * 0.1) = 240
    });

    it('calculates correct XP threshold for level 3', () => {
      const threshold = XP_CONFIG.getLevelThreshold(3);
      expect(threshold).toBe(390); // 3 * 100 * (1 + 3 * 0.1) = 390
    });

    it('returns increasing thresholds for higher levels', () => {
      const level1 = XP_CONFIG.getLevelThreshold(1);
      const level2 = XP_CONFIG.getLevelThreshold(2);
      const level3 = XP_CONFIG.getLevelThreshold(3);

      expect(level2).toBeGreaterThan(level1);
      expect(level3).toBeGreaterThan(level2);
    });
  });

  describe('calculateLevel', () => {
    it('returns level 1 for 0 XP', () => {
      const level = XP_CONFIG.calculateLevel(0);
      expect(level).toBe(1);
    });

    it('returns level 1 just before first threshold', () => {
      const level = XP_CONFIG.calculateLevel(109);
      expect(level).toBe(1);
    });

    it('returns level 2 at exact first threshold', () => {
      const level = XP_CONFIG.calculateLevel(110);
      expect(level).toBe(2);
    });

    it('returns level 2 just before second threshold', () => {
      const level = XP_CONFIG.calculateLevel(349); // 110 + 239
      expect(level).toBe(2);
    });

    it('returns level 3 at exact second threshold', () => {
      const level = XP_CONFIG.calculateLevel(350); // 110 + 240
      expect(level).toBe(3);
    });

    it('handles large XP values', () => {
      const level = XP_CONFIG.calculateLevel(10000);
      expect(level).toBeGreaterThan(5);
      expect(typeof level).toBe('number');
    });
  });

  describe('getLevelProgress', () => {
    it('shows 0 progress at level 1 start', () => {
      const progress = XP_CONFIG.getLevelProgress(0);
      expect(progress.current).toBe(0);
      expect(progress.needed).toBe(110);
      expect(progress.percentage).toBe(0);
    });

    it('shows mid-level progress correctly', () => {
      const progress = XP_CONFIG.getLevelProgress(55); // Halfway through level 1
      expect(progress.current).toBe(55);
      expect(progress.needed).toBe(110);
      expect(progress.percentage).toBe(50);
    });

    it('resets progress at level up', () => {
      const progress = XP_CONFIG.getLevelProgress(110); // Exactly at level 2
      expect(progress.current).toBe(0);
      expect(progress.needed).toBe(240);
      expect(progress.percentage).toBe(0);
    });

    it('shows progress in level 2', () => {
      const progress = XP_CONFIG.getLevelProgress(230); // 110 + 120 (halfway through level 2)
      expect(progress.current).toBe(120);
      expect(progress.needed).toBe(240);
      expect(progress.percentage).toBe(50);
    });

    it('percentage is always between 0 and 100', () => {
      const testValues = [0, 55, 110, 230, 350, 500, 1000];
      testValues.forEach(xp => {
        const progress = XP_CONFIG.getLevelProgress(xp);
        expect(progress.percentage).toBeGreaterThanOrEqual(0);
        expect(progress.percentage).toBeLessThanOrEqual(100);
      });
    });
  });

  describe('action XP values', () => {
    it('has correct XP values for all actions', () => {
      expect(XP_CONFIG.actions.message_sent).toBe(10);
      expect(XP_CONFIG.actions.memory_created).toBe(25);
      expect(XP_CONFIG.actions.daily_login).toBe(15);
      expect(XP_CONFIG.actions.streak_bonus).toBe(5);
    });

    it('memory creation gives more XP than message', () => {
      expect(XP_CONFIG.actions.memory_created).toBeGreaterThan(XP_CONFIG.actions.message_sent);
    });

    it('all action values are positive integers', () => {
      Object.values(XP_CONFIG.actions).forEach(xp => {
        expect(xp).toBeGreaterThan(0);
        expect(Number.isInteger(xp)).toBe(true);
      });
    });
  });
});
