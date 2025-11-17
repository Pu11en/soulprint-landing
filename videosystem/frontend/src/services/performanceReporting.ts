import { performanceMonitor, PerformanceMetrics, ApiMetrics, WebVitals } from '@/utils/performance';

interface PerformanceReportData {
  metrics: {
    render: PerformanceMetrics[];
    api: ApiMetrics[];
    webVitals: WebVitals;
  };
  userAgent: string;
  timestamp: number;
}

class PerformanceReportingService {
  private reportInterval: NodeJS.Timeout | null = null;
  private isReporting = false;
  private reportEndpoint = '/api/performance';
  private reportFrequency = 60000; // Report every minute

  constructor() {
    // Set up periodic reporting
    this.setupPeriodicReporting();
    
    // Report on page unload
    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', () => {
        this.reportMetrics(true); // Use sendBeacon for unload
      });
      
      // Report when page becomes hidden (user switches tabs, etc.)
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') {
          this.reportMetrics(true); // Use sendBeacon for hidden
        }
      });
    }
  }

  // Set up periodic reporting
  private setupPeriodicReporting(): void {
    if (this.reportInterval) {
      clearInterval(this.reportInterval);
    }

    this.reportInterval = setInterval(() => {
      this.reportMetrics();
    }, this.reportFrequency);
  }

  // Report collected metrics to the server
  async reportMetrics(useBeacon = false): Promise<void> {
    if (this.isReporting) return;
    
    try {
      this.isReporting = true;
      const metrics = performanceMonitor.getMetrics();
      
      // Skip if no metrics to report
      if (metrics.render.length === 0 && metrics.api.length === 0) {
        return;
      }

      const reportData: PerformanceReportData = {
        metrics,
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
        timestamp: Date.now(),
      };

      if (useBeacon && typeof navigator !== 'undefined' && navigator.sendBeacon) {
        // Use sendBeacon for unload/hidden events (more reliable)
        const blob = new Blob([JSON.stringify(reportData)], {
          type: 'application/json',
        });
        navigator.sendBeacon(this.reportEndpoint, blob);
      } else {
        // Use regular fetch for periodic reporting
        await fetch(this.reportEndpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(reportData),
        });
      }

      // Clear reported metrics
      performanceMonitor.clearMetrics();
    } catch (error) {
      console.error('Failed to report performance metrics:', error);
    } finally {
      this.isReporting = false;
    }
  }

  // Force immediate report
  async forceReport(): Promise<void> {
    await this.reportMetrics();
  }

  // Set report frequency
  setReportFrequency(frequency: number): void {
    this.reportFrequency = frequency;
    this.setupPeriodicReporting();
  }

  // Enable/disable reporting
  setReportingEnabled(enabled: boolean): void {
    if (enabled) {
      this.setupPeriodicReporting();
    } else if (this.reportInterval) {
      clearInterval(this.reportInterval);
      this.reportInterval = null;
    }
  }

  // Cleanup
  cleanup(): void {
    if (this.reportInterval) {
      clearInterval(this.reportInterval);
      this.reportInterval = null;
    }
  }
}

// Singleton instance
export const performanceReportingService = new PerformanceReportingService();

// Hook for using performance reporting
export const usePerformanceReporting = () => {
  const forceReport = async () => {
    await performanceReportingService.forceReport();
  };

  return {
    forceReport,
    setFrequency: (frequency: number) => {
      performanceReportingService.setReportFrequency(frequency);
    },
    setEnabled: (enabled: boolean) => {
      performanceReportingService.setReportingEnabled(enabled);
    },
  };
};

export default performanceReportingService;