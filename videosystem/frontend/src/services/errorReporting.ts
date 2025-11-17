import Logger from '@/utils/logger';

interface ErrorReport {
  error: Error;
  context?: string;
  userId?: string;
  userAgent?: string;
  url?: string;
  timestamp: string;
  additionalData?: any;
}

class ErrorReportingService {
  private static isDevelopment = process.env.NODE_ENV === 'development';
  private static isProduction = process.env.NODE_ENV === 'production';

  static reportError(
    error: Error,
    context?: string,
    additionalData?: any
  ): void {
    // Don't report errors in development
    if (this.isDevelopment) {
      Logger.debug('Error reporting skipped in development mode', 'ErrorReporting');
      return;
    }

    // Create error report
    const report: ErrorReport = {
      error,
      context,
      userAgent: typeof window !== 'undefined' ? window.navigator.userAgent : 'Server',
      url: typeof window !== 'undefined' ? window.location.href : 'Server',
      timestamp: new Date().toISOString(),
      additionalData,
    };

    // Log the error locally first
    Logger.trackError(error, context, additionalData);

    // Send to error reporting service
    this.sendErrorReport(report);
  }

  static reportApiError(
    response: Response,
    context?: string,
    additionalData?: any
  ): void {
    // Don't report in development
    if (this.isDevelopment) {
      Logger.debug('API error reporting skipped in development mode', 'ErrorReporting');
      return;
    }

    // Create error from response
    const error = new Error(`API Error: ${response.status} ${response.statusText}`);
    
    const report: ErrorReport = {
      error,
      context: context || 'API',
      userAgent: typeof window !== 'undefined' ? window.navigator.userAgent : 'Server',
      url: typeof window !== 'undefined' ? window.location.href : 'Server',
      timestamp: new Date().toISOString(),
      additionalData: {
        responseStatus: response.status,
        responseStatusText: response.statusText,
        responseUrl: response.url,
        ...additionalData,
      },
    };

    // Log the error locally first
    Logger.trackApiError(response, context);

    // Send to error reporting service
    this.sendErrorReport(report);
  }

  static reportUserError(
    error: Error,
    userId?: string,
    context?: string,
    additionalData?: any
  ): void {
    // Don't report in development
    if (this.isDevelopment) {
      Logger.debug('User error reporting skipped in development mode', 'ErrorReporting');
      return;
    }

    // Create error report
    const report: ErrorReport = {
      error,
      context: context || 'User Action',
      userId,
      userAgent: typeof window !== 'undefined' ? window.navigator.userAgent : 'Server',
      url: typeof window !== 'undefined' ? window.location.href : 'Server',
      timestamp: new Date().toISOString(),
      additionalData,
    };

    // Log the error locally first
    Logger.trackError(error, context, { userId, ...additionalData });

    // Send to error reporting service
    this.sendErrorReport(report);
  }

  private static async sendErrorReport(report: ErrorReport): Promise<void> {
    try {
      // Send to error reporting API endpoint
      const response = await fetch('/api/errors', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(report),
      });

      if (!response.ok) {
        Logger.error('Failed to send error report', 'ErrorReporting', {
          status: response.status,
          statusText: response.statusText,
        });
      }
    } catch (error) {
      Logger.error('Error sending error report', 'ErrorReporting', { error });
    }
  }

  static reportPerformanceIssue(
    metric: string,
    value: number,
    context?: string,
    additionalData?: any
  ): void {
    // Don't report in development
    if (this.isDevelopment) {
      Logger.debug('Performance reporting skipped in development mode', 'ErrorReporting');
      return;
    }

    // Create performance report
    const report = {
      metric,
      value,
      context: context || 'Performance',
      userAgent: typeof window !== 'undefined' ? window.navigator.userAgent : 'Server',
      url: typeof window !== 'undefined' ? window.location.href : 'Server',
      timestamp: new Date().toISOString(),
      additionalData,
    };

    // Log the performance issue locally first
    Logger.trackPerformance(metric, value, additionalData);

    // Send to performance reporting service
    this.sendPerformanceReport(report);
  }

  private static async sendPerformanceReport(report: any): Promise<void> {
    try {
      // Send to performance reporting API endpoint
      const response = await fetch('/api/performance', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(report),
      });

      if (!response.ok) {
        Logger.error('Failed to send performance report', 'ErrorReporting', {
          status: response.status,
          statusText: response.statusText,
        });
      }
    } catch (error) {
      Logger.error('Error sending performance report', 'ErrorReporting', { error });
    }
  }

  static setupGlobalErrorHandlers(): void {
    if (typeof window === 'undefined') {
      return; // Skip on server-side
    }

    // Handle unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      Logger.error('Unhandled promise rejection', 'GlobalError', {
        reason: event.reason,
      });
      
      this.reportError(
        new Error(`Unhandled promise rejection: ${event.reason}`),
        'GlobalError',
        { reason: event.reason }
      );
    });

    // Handle uncaught errors
    window.addEventListener('error', (event) => {
      Logger.error('Uncaught error', 'GlobalError', {
        message: event.message,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        error: event.error,
      });
      
      this.reportError(
        event.error || new Error(event.message),
        'GlobalError',
        {
          filename: event.filename,
          lineno: event.lineno,
          colno: event.colno,
        }
      );
    });
  }

  static setupGlobalPerformanceObserver(): void {
    if (typeof window === 'undefined' || !('PerformanceObserver' in window)) {
      return; // Skip on server-side or unsupported browsers
    }

    // Observe long tasks
    if ('PerformanceObserver' in window) {
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.duration > 50) { // Tasks taking longer than 50ms
            this.reportPerformanceIssue(
              'long-task',
              entry.duration,
              'Performance',
              {
                name: entry.name,
                startTime: entry.startTime,
                delay: entry.startTime - performance.now(),
              }
            );
          }
        }
      });

      observer.observe({ entryTypes: ['longtask'] });
    }
  }

  static initialize(): void {
    // Initialize error reporting
    this.setupGlobalErrorHandlers();
    
    // Initialize performance monitoring
    if (this.isProduction) {
      this.setupGlobalPerformanceObserver();
    }

    Logger.info('Error reporting service initialized', 'ErrorReporting');
  }
}

export default ErrorReportingService;