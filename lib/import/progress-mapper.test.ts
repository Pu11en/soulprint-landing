import { describe, it, expect } from 'vitest';
import { mapProgress, getStageProgress, STAGES } from './progress-mapper';

describe('mapProgress', () => {
  describe('monotonic guard', () => {
    it('should never allow progress to decrease', () => {
      const result = mapProgress(50, null, 60);
      expect(result.displayPercent).toBeGreaterThanOrEqual(60);
    });

    it('should use backend percent when it is higher', () => {
      const result = mapProgress(70, null, 60);
      expect(result.displayPercent).toBe(70);
    });

    it('should preserve lastKnownPercent when backend is lower', () => {
      const result = mapProgress(45, null, 60);
      expect(result.displayPercent).toBe(60);
    });
  });

  describe('clamping', () => {
    it('should clamp negative values to 0', () => {
      const result = mapProgress(-5, null, 0);
      expect(result.displayPercent).toBe(0);
    });

    it('should clamp values over 100 to 100', () => {
      const result = mapProgress(150, null, 0);
      expect(result.displayPercent).toBe(100);
    });

    it('should handle negative lastKnownPercent', () => {
      const result = mapProgress(50, null, -10);
      expect(result.displayPercent).toBe(50);
    });
  });

  describe('stage boundaries', () => {
    it('should map 0-49% to stage 0 (Upload)', () => {
      expect(mapProgress(0, null, 0).stageIndex).toBe(0);
      expect(mapProgress(25, null, 0).stageIndex).toBe(0);
      expect(mapProgress(49, null, 0).stageIndex).toBe(0);
    });

    it('should map 50-59% to stage 1 (Extract)', () => {
      expect(mapProgress(50, null, 0).stageIndex).toBe(1);
      expect(mapProgress(55, null, 0).stageIndex).toBe(1);
      expect(mapProgress(59, null, 0).stageIndex).toBe(1);
    });

    it('should map 60-79% to stage 2 (Analyze)', () => {
      expect(mapProgress(60, null, 0).stageIndex).toBe(2);
      expect(mapProgress(70, null, 0).stageIndex).toBe(2);
      expect(mapProgress(79, null, 0).stageIndex).toBe(2);
    });

    it('should map 80-100% to stage 3 (Build Profile)', () => {
      expect(mapProgress(80, null, 0).stageIndex).toBe(3);
      expect(mapProgress(90, null, 0).stageIndex).toBe(3);
      expect(mapProgress(100, null, 0).stageIndex).toBe(3);
    });
  });

  describe('backend stage string mapping', () => {
    it('should map download/upload stages to "Uploading your data..."', () => {
      expect(mapProgress(10, 'Downloading export', 0).stageLabel).toBe('Uploading your data...');
      expect(mapProgress(10, 'Uploading...', 0).stageLabel).toBe('Uploading your data...');
    });

    it('should map parsing stages to "Extracting conversations..."', () => {
      expect(mapProgress(55, 'Parsing conversations', 0).stageLabel).toBe('Extracting conversations...');
    });

    it('should map generation stages to "Analyzing your personality..."', () => {
      expect(mapProgress(70, 'Generating soulprint', 0).stageLabel).toBe('Analyzing your personality...');
    });

    it('should map building stages to "Building your SoulPrint..."', () => {
      expect(mapProgress(85, 'Building profile', 0).stageLabel).toBe('Building your SoulPrint...');
    });

    it('should map 100% to "Complete!"', () => {
      expect(mapProgress(100, 'Building profile', 0).stageLabel).toBe('Complete!');
    });

    it('should handle null stage string with generic labels', () => {
      expect(mapProgress(30, null, 0).stageLabel).toBe('Uploading your data...');
      expect(mapProgress(55, null, 0).stageLabel).toBe('Extracting conversations...');
      expect(mapProgress(70, null, 0).stageLabel).toBe('Analyzing your personality...');
      expect(mapProgress(85, null, 0).stageLabel).toBe('Building your SoulPrint...');
    });
  });

  describe('safeToClose flag', () => {
    it('should be false below 55%', () => {
      expect(mapProgress(0, null, 0).safeToClose).toBe(false);
      expect(mapProgress(30, null, 0).safeToClose).toBe(false);
      expect(mapProgress(54, null, 0).safeToClose).toBe(false);
    });

    it('should be true at or above 55%', () => {
      expect(mapProgress(55, null, 0).safeToClose).toBe(true);
      expect(mapProgress(70, null, 0).safeToClose).toBe(true);
      expect(mapProgress(100, null, 0).safeToClose).toBe(true);
    });
  });

  describe('isComplete flag', () => {
    it('should be false below 100%', () => {
      expect(mapProgress(0, null, 0).isComplete).toBe(false);
      expect(mapProgress(50, null, 0).isComplete).toBe(false);
      expect(mapProgress(99, null, 0).isComplete).toBe(false);
    });

    it('should be true at 100%', () => {
      expect(mapProgress(100, null, 0).isComplete).toBe(true);
    });
  });

  describe('edge cases', () => {
    it('should handle 0% correctly', () => {
      const result = mapProgress(0, null, 0);
      expect(result.stageIndex).toBe(0);
      expect(result.displayPercent).toBe(0);
      expect(result.isComplete).toBe(false);
      expect(result.safeToClose).toBe(false);
    });

    it('should handle 100% correctly', () => {
      const result = mapProgress(100, null, 0);
      expect(result.stageIndex).toBe(3);
      expect(result.displayPercent).toBe(100);
      expect(result.isComplete).toBe(true);
      expect(result.safeToClose).toBe(true);
      expect(result.stageLabel).toBe('Complete!');
    });
  });
});

describe('getStageProgress', () => {
  it('should calculate progress within stage 0 (0-49%)', () => {
    // At 0% overall = 0% through stage 0
    expect(getStageProgress(0, 0)).toBeCloseTo(0, 1);

    // At 24.5% overall = 50% through stage 0 (0-49 range)
    // (24.5 - 0) / (49 - 0) * 100 = 50%
    expect(getStageProgress(0, 24.5)).toBeCloseTo(50, 1);

    // At 49% overall = 100% through stage 0
    expect(getStageProgress(0, 49)).toBeCloseTo(100, 1);
  });

  it('should calculate progress within stage 1 (50-59%)', () => {
    // At 50% overall = 0% through stage 1
    expect(getStageProgress(1, 50)).toBeCloseTo(0, 1);

    // At 54.5% overall = 50% through stage 1 (50-59 range)
    // (54.5 - 50) / (59 - 50) * 100 = 50%
    expect(getStageProgress(1, 54.5)).toBeCloseTo(50, 1);

    // At 59% overall = 100% through stage 1
    expect(getStageProgress(1, 59)).toBeCloseTo(100, 1);
  });

  it('should calculate progress within stage 2 (60-79%)', () => {
    // At 60% overall = 0% through stage 2
    expect(getStageProgress(2, 60)).toBeCloseTo(0, 1);

    // At 70% overall = ~50% through stage 2 (60-79 range)
    // (70 - 60) / (79 - 60) * 100 = 52.6%
    expect(getStageProgress(2, 70)).toBeCloseTo(52.6, 1);

    // At 79% overall = 100% through stage 2
    expect(getStageProgress(2, 79)).toBeCloseTo(100, 1);
  });

  it('should calculate progress within stage 3 (80-100%)', () => {
    // At 80% overall = 0% through stage 3
    expect(getStageProgress(3, 80)).toBeCloseTo(0, 1);

    // At 90% overall = 50% through stage 3 (80-100 range)
    // (90 - 80) / (100 - 80) * 100 = 50%
    expect(getStageProgress(3, 90)).toBeCloseTo(50, 1);

    // At 100% overall = 100% through stage 3
    expect(getStageProgress(3, 100)).toBeCloseTo(100, 1);
  });

  it('should handle invalid stage index', () => {
    expect(getStageProgress(-1, 50)).toBe(0);
    expect(getStageProgress(99, 50)).toBe(0);
  });

  it('should clamp progress to 0-100 range', () => {
    // Progress before stage starts
    expect(getStageProgress(1, 40)).toBeCloseTo(0, 1);

    // Progress after stage ends
    expect(getStageProgress(1, 70)).toBeCloseTo(100, 1);
  });
});

describe('STAGES constant', () => {
  it('should have 4 stages', () => {
    expect(STAGES).toHaveLength(4);
  });

  it('should have correct stage names', () => {
    expect(STAGES[0].name).toBe('Upload');
    expect(STAGES[1].name).toBe('Extract');
    expect(STAGES[2].name).toBe('Analyze');
    expect(STAGES[3].name).toBe('Build Profile');
  });

  it('should have correct icon names', () => {
    expect(STAGES[0].icon).toBe('Upload');
    expect(STAGES[1].icon).toBe('FileSearch');
    expect(STAGES[2].icon).toBe('Sparkles');
    expect(STAGES[3].icon).toBe('Fingerprint');
  });

  it('should have contiguous percent ranges', () => {
    expect(STAGES[0].minPercent).toBe(0);
    expect(STAGES[0].maxPercent).toBe(49);
    expect(STAGES[1].minPercent).toBe(50);
    expect(STAGES[1].maxPercent).toBe(59);
    expect(STAGES[2].minPercent).toBe(60);
    expect(STAGES[2].maxPercent).toBe(79);
    expect(STAGES[3].minPercent).toBe(80);
    expect(STAGES[3].maxPercent).toBe(100);
  });
});
