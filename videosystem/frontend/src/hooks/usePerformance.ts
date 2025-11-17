import React, { useEffect, useRef, useCallback } from 'react';
import { performanceMonitor, PerformanceMetrics, WebVitals } from '@/utils/performance';

interface UsePerformanceOptions {
  trackRenders?: boolean;
  trackInteractions?: boolean;
  componentName?: string;
}

interface UsePerformanceReturn {
  startTimer: (componentName?: string) => () => PerformanceMetrics;
  trackInteraction: (action: string, data?: Record<string, any>) => void;
  getMetrics: () => { render: PerformanceMetrics[]; api: any[]; webVitals: WebVitals };
  clearMetrics: () => void;
}

export const usePerformance = (options: UsePerformanceOptions = {}): UsePerformanceReturn => {
  const {
    trackRenders = true,
    trackInteractions = true,
    componentName: defaultComponentName = 'Component',
  } = options;

  const metricsRef = useRef<{
    render: PerformanceMetrics[];
    api: any[];
    webVitals: WebVitals;
  }>({
    render: [],
    api: [],
    webVitals: {},
  });

  // Start a performance timer
  const startTimer = useCallback((componentName?: string) => {
    const name = componentName || defaultComponentName;
    return performanceMonitor.startRenderTimer(name);
  }, [defaultComponentName]);

  // Track user interactions
  const trackInteraction = useCallback((action: string, data?: Record<string, any>) => {
    if (!trackInteractions) return;

    const startTime = performance.now();
    
    // Log interaction
    console.debug(`Interaction: ${action}`, data);
    
    return () => {
      const duration = performance.now() - startTime;
      console.debug(`Interaction completed: ${action} took ${duration.toFixed(2)}ms`);
    };
  }, [trackInteractions]);

  // Get all collected metrics
  const getMetrics = useCallback(() => {
    return performanceMonitor.getMetrics();
  }, []);

  // Clear all metrics
  const clearMetrics = useCallback(() => {
    performanceMonitor.clearMetrics();
    metricsRef.current = {
      render: [],
      api: [],
      webVitals: {},
    };
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Cleanup performance observers if this is the last instance
      // Note: In a real app, you might want to implement reference counting
    };
  }, []);

  return {
    startTimer,
    trackInteraction,
    getMetrics,
    clearMetrics,
  };
};

// Hook for monitoring component render performance
export const useRenderPerformance = (componentName: string) => {
  const { startTimer } = usePerformance({ componentName });
  
  useEffect(() => {
    const endTimer = startTimer();
    
    return () => {
      endTimer();
    };
  }, [componentName, startTimer]);
};

// Hook for monitoring API performance
export const useApiPerformance = () => {
  const monitorApiCall = useCallback(async <T>(
    url: string,
    method: string,
    apiCall: () => Promise<T>
  ): Promise<T> => {
    const result = await performanceMonitor.monitorApiCall(url, method, apiCall);
    return result.data;
  }, []);

  return { monitorApiCall };
};

// Hook for monitoring Web Vitals
export const useWebVitals = () => {
  const { getMetrics } = usePerformance();
  
  const getWebVitals = useCallback(() => {
    return getMetrics().webVitals;
  }, [getMetrics]);

  return { getWebVitals };
};

// Higher-order component for performance monitoring
export const withPerformanceMonitoring = <P extends object>(
  Component: React.ComponentType<P>,
  componentName?: string
) => {
  const WrappedComponent = (props: P) => {
    const name = componentName || Component.displayName || Component.name || 'Component';
    useRenderPerformance(name);
    
    return React.createElement(Component, props);
  };

  WrappedComponent.displayName = `withPerformanceMonitoring(${Component.displayName || Component.name})`;
  
  return WrappedComponent;
};

export default usePerformance;