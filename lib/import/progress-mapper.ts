/**
 * Progress Mapper - Pure function module for mapping backend import progress to frontend stages
 *
 * Converts raw backend data (progress_percent, import_stage string) into a structured
 * frontend stage model with monotonic enforcement (progress never decreases).
 */

export interface StageInfo {
  stageIndex: number;       // 0-3 (which stage we're in)
  stageLabel: string;       // Human-readable label for current state
  displayPercent: number;   // The percentage to show (0-100)
  isComplete: boolean;      // All stages done (100%)
  safeToClose: boolean;     // True when past upload phase (progress >= 55)
}

export interface StageDefinition {
  name: string;
  icon: string;             // Lucide icon name
  minPercent: number;
  maxPercent: number;
}

/**
 * Stage definitions - the 4 visual stages in the UI
 */
export const STAGES: StageDefinition[] = [
  { name: 'Upload', icon: 'Upload', minPercent: 0, maxPercent: 49 },
  { name: 'Extract', icon: 'FileSearch', minPercent: 50, maxPercent: 59 },
  { name: 'Analyze', icon: 'Sparkles', minPercent: 60, maxPercent: 79 },
  { name: 'Build Profile', icon: 'Fingerprint', minPercent: 80, maxPercent: 100 },
];

/**
 * Maps a backend stage string to a user-friendly display label
 */
function mapBackendStageToLabel(backendStage: string | null, percent: number): string {
  if (percent >= 100) {
    return 'Complete!';
  }

  if (!backendStage) {
    // No stage string - use generic based on percent
    if (percent < 50) return 'Uploading your data...';
    if (percent < 60) return 'Extracting conversations...';
    if (percent < 80) return 'Analyzing your personality...';
    return 'Building your SoulPrint...';
  }

  // Map backend stage strings to better display labels
  const stage = backendStage.toLowerCase();

  if (stage.includes('download') || stage.includes('upload')) {
    return 'Uploading your data...';
  }
  if (stage.includes('pars')) {
    return 'Extracting conversations...';
  }
  if (stage.includes('generat') || stage.includes('soulprint')) {
    return 'Analyzing your personality...';
  }
  if (stage.includes('build') || stage.includes('profile')) {
    return 'Building your SoulPrint...';
  }

  // Fallback: capitalize first letter and use as-is
  return backendStage.charAt(0).toUpperCase() + backendStage.slice(1);
}

/**
 * Determines which stage (0-3) we're in based on progress percent
 */
function getStageIndexFromPercent(percent: number): number {
  for (let i = 0; i < STAGES.length; i++) {
    if (percent >= STAGES[i].minPercent && percent <= STAGES[i].maxPercent) {
      return i;
    }
  }
  // Fallback: if somehow percent is above all ranges, return last stage
  return STAGES.length - 1;
}

/**
 * Calculates progress within the current stage (0-100)
 * Used for inner progress bars that show how far through the active stage we are
 *
 * @param stageIndex - The current stage (0-3)
 * @param overallPercent - The overall progress percent (0-100)
 * @returns Progress within the stage (0-100)
 */
export function getStageProgress(stageIndex: number, overallPercent: number): number {
  if (stageIndex < 0 || stageIndex >= STAGES.length) {
    return 0;
  }

  const stage = STAGES[stageIndex];
  const range = stage.maxPercent - stage.minPercent;
  const progressInRange = overallPercent - stage.minPercent;

  // Clamp to 0-100
  const stageProgress = Math.max(0, Math.min(100, (progressInRange / range) * 100));

  return stageProgress;
}

/**
 * Maps backend progress to frontend stage information
 *
 * @param backendPercent - Progress from backend (0-100)
 * @param backendStage - Stage string from backend (e.g., "Parsing conversations")
 * @param lastKnownPercent - Last known progress for monotonic guard
 * @returns StageInfo object with all display information
 */
export function mapProgress(
  backendPercent: number,
  backendStage: string | null,
  lastKnownPercent: number
): StageInfo {
  // Monotonic guard: never go backwards
  let effectivePercent = Math.max(backendPercent, lastKnownPercent);

  // Clamp to valid range
  effectivePercent = Math.max(0, Math.min(100, effectivePercent));

  // Determine which stage we're in
  const stageIndex = getStageIndexFromPercent(effectivePercent);

  // Map backend stage string to display label
  const stageLabel = mapBackendStageToLabel(backendStage, effectivePercent);

  // Calculate derived flags
  const isComplete = effectivePercent >= 100;
  const safeToClose = effectivePercent >= 55;

  return {
    stageIndex,
    stageLabel,
    displayPercent: effectivePercent,
    isComplete,
    safeToClose,
  };
}
