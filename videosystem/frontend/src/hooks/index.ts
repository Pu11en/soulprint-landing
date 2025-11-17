// Import hooks for re-export
import { useAuthState, useAuthActions, useAuthFull } from './useAuth';
import useAutoSave from './useAutoSave';
// import { useRedux } from './useRedux'; // Commented out as file is empty
import {
  usePerformance,
  useRenderPerformance,
  useApiPerformance,
  useWebVitals,
  withPerformanceMonitoring
} from './usePerformance';
import { usePerformanceReporting } from '../services/performanceReporting';
import { useStorage } from './useStorage';
import { useOmniclip } from './useOmniclip';

// Re-export hooks
export {
  useAuthFull as useAuth,
  useAutoSave,
  // useRedux, // Commented out as file is empty
  usePerformance,
  useRenderPerformance,
  useApiPerformance,
  useWebVitals,
  withPerformanceMonitoring,
  usePerformanceReporting,
  useStorage,
  useOmniclip,
};