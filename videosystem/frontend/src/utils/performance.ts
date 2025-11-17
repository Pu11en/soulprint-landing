import logger from './logger';
import React from 'react';

// Performance metrics interface
export interface PerformanceMetrics {
  renderTime: number;
  componentName: string;
  timestamp: number;
  props?: Record<string, any>;
  memoryUsage?: number;
}

export interface ApiMetrics {
  url: string;
  method: string;
  duration: number;
  status: number;
  timestamp: number;
  error?: string;
}

export interface WebVitals {
  fcp?: number; // First Contentful Paint
  lcp?: number; // Largest Contentful Paint
  fid?: number; // First Input Delay
  cls?: number; // Cumulative Layout Shift
  ttfb?: number; // Time to First Byte
}

class PerformanceMonitor {
  private metrics: PerformanceMetrics[] = [];
  private apiMetrics: ApiMetrics[] = [];
  private webVitals: WebVitals = {};
  private observers: PerformanceObserver[] = [];

  constructor() {
    this.initializeWebVitals();
  }

  // Start monitoring component render performance
  startRenderTimer(componentName: string, props?: Record<string, any>): () => PerformanceMetrics {
    const startTime = performance.now();
    const startMemory = this.getMemoryUsage();

    return (): PerformanceMetrics => {
      const endTime = performance.now();
      const endMemory = this.getMemoryUsage();
      const renderTime = endTime - startTime;

      const metric: PerformanceMetrics = {
        renderTime,
        componentName,
        timestamp: Date.now(),
        props,
        memoryUsage: endMemory && startMemory ? endMemory - startMemory : undefined,
      };

      this.metrics.push(metric);
      this.logRenderMetric(metric);

      return metric;
    };
  }

  // Monitor API call performance
  async monitorApiCall<T>(
    url: string,
    method: string,
    apiCall: () => Promise<T>
  ): Promise<{ data: T; metrics: ApiMetrics }> {
    const startTime = performance.now();
    let status = 200;
    let error: string | undefined;

    try {
      const data = await apiCall();
      return { data, metrics: this.createApiMetrics(url, method, startTime, status) };
    } catch (err) {
      status = 0;
      error = err instanceof Error ? err.message : 'Unknown error';
      throw err;
    } finally {
      const metrics = this.createApiMetrics(url, method, startTime, status, error);
      this.apiMetrics.push(metrics);
      this.logApiMetric(metrics);
    }
  }

  private createApiMetrics(
    url: string,
    method: string,
    startTime: number,
    status: number,
    error?: string
  ): ApiMetrics {
    return {
      url,
      method,
      duration: performance.now() - startTime,
      status,
      timestamp: Date.now(),
      error,
    };
  }

  // Initialize Web Vitals monitoring
  private initializeWebVitals(): void {
    if (typeof window === 'undefined' || !window.performance) return;

    try {
      // First Contentful Paint
      this.observePerformanceEntry('paint', (entries) => {
        entries.forEach((entry) => {
          if (entry.name === 'first-contentful-paint') {
            this.webVitals.fcp = entry.startTime;
          }
        });
      });

      // Largest Contentful Paint
      this.observePerformanceEntry('largest-contentful-paint', (entries) => {
        entries.forEach((entry) => {
          this.webVitals.lcp = entry.startTime;
        });
      });

      // First Input Delay
      this.observePerformanceEntry('first-input', (entries) => {
        entries.forEach((entry) => {
          if (entry instanceof PerformanceEventTiming) {
            this.webVitals.fid = entry.processingStart - entry.startTime;
          }
        });
      });

      // Cumulative Layout Shift
      this.observePerformanceEntry('layout-shift', (entries) => {
        entries.forEach((entry) => {
          if (!(entry as any).hadRecentInput) {
            this.webVitals.cls = (this.webVitals.cls || 0) + (entry as any).value;
          }
        });
      });

      // Time to First Byte
      this.observeNavigation();
    } catch (error) {
      logger.warn('Failed to initialize Web Vitals monitoring', error instanceof Error ? error.message : String(error));
    }
  }

  private observePerformanceEntry(
    type: string,
    callback: (entries: PerformanceEntryList) => void
  ): void {
    try {
      const observer = new PerformanceObserver((list) => {
        callback(list.getEntries());
      });
      observer.observe({ type, buffered: true });
      this.observers.push(observer);
    } catch (error) {
      logger.warn(`Failed to observe ${type}`, error instanceof Error ? error.message : String(error));
    }
  }

  private observeNavigation(): void {
    if (!window.performance || !window.performance.getEntriesByType) return;

    const navigationEntries = window.performance.getEntriesByType('navigation');
    if (navigationEntries.length > 0) {
      const navEntry = navigationEntries[0] as PerformanceNavigationTiming;
      this.webVitals.ttfb = navEntry.responseStart - navEntry.requestStart;
    }
  }

  private getMemoryUsage(): number | null {
    if (typeof window !== 'undefined' && (window as any).performance && (window as any).performance.memory) {
      return (window as any).performance.memory.usedJSHeapSize;
    }
    return null;
  }

  private logRenderMetric(metric: PerformanceMetrics): void {
    if (metric.renderTime > 16) { // Log slow renders (> 1 frame at 60fps)
      logger.warn(`Slow render detected: ${metric.componentName} took ${metric.renderTime.toFixed(2)}ms`, JSON.stringify({
        component: metric.componentName,
        renderTime: metric.renderTime,
        props: metric.props,
        memoryUsage: metric.memoryUsage,
      }));
    } else {
      logger.debug(`Render: ${metric.componentName} took ${metric.renderTime.toFixed(2)}ms`);
    }
  }

  private logApiMetric(metric: ApiMetrics): void {
    if (metric.duration > 1000) { // Log slow API calls (> 1s)
      logger.warn(`Slow API call: ${metric.method} ${metric.url} took ${metric.duration.toFixed(2)}ms`, JSON.stringify({
        url: metric.url,
        method: metric.method,
        duration: metric.duration,
        status: metric.status,
        error: metric.error,
      }));
    } else {
      logger.debug(`API: ${metric.method} ${metric.url} took ${metric.duration.toFixed(2)}ms`);
    }
  }

  // Get collected metrics
  getMetrics(): { render: PerformanceMetrics[]; api: ApiMetrics[]; webVitals: WebVitals } {
    return {
      render: [...this.metrics],
      api: [...this.apiMetrics],
      webVitals: { ...this.webVitals },
    };
  }

  // Clear all metrics
  clearMetrics(): void {
    this.metrics = [];
    this.apiMetrics = [];
    this.webVitals = {};
  }

  // Cleanup observers
  cleanup(): void {
    this.observers.forEach((observer) => observer.disconnect());
    this.observers = [];
  }
}

// Singleton instance
export const performanceMonitor = new PerformanceMonitor();

// React hook for performance monitoring
export const usePerformanceMonitor = (componentName: string) => {
  const startTimer = React.useCallback(() => {
    return performanceMonitor.startRenderTimer(componentName);
  }, [componentName]);

  return { startTimer };
};

// API monitoring wrapper
export const withPerformanceMonitoring = async <T>(
  url: string,
  method: string,
  apiCall: () => Promise<T>
): Promise<T> => {
  const result = await performanceMonitor.monitorApiCall(url, method, apiCall);
  return result.data;
};