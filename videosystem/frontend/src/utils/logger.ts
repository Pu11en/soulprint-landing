type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  context?: string;
  data?: any;
}

class Logger {
  private static isDevelopment = process.env.NODE_ENV === 'development';
  private static isTest = process.env.NODE_ENV === 'test';

  private static formatLogEntry(entry: LogEntry): string {
    const { level, message, timestamp, context, data } = entry;
    
    let formattedMessage = `[${timestamp}] ${level.toUpperCase()}: ${message}`;
    
    if (context) {
      formattedMessage += ` (${context})`;
    }
    
    if (data) {
      formattedMessage += `\nData: ${JSON.stringify(data, null, 2)}`;
    }
    
    return formattedMessage;
  }

  private static createLogEntry(level: LogLevel, message: string, context?: string, data?: any): LogEntry {
    return {
      level,
      message,
      timestamp: new Date().toISOString(),
      context,
      data,
    };
  }

  private static log(entry: LogEntry): void {
    const formattedEntry = Logger.formatLogEntry(entry);
    
    if (Logger.isDevelopment) {
      // In development, log to console with colors
      switch (entry.level) {
        case 'debug':
          console.debug(`\x1b[36m${formattedEntry}\x1b[0m`); // Cyan
          break;
        case 'info':
          console.info(`\x1b[32m${formattedEntry}\x1b[0m`); // Green
          break;
        case 'warn':
          console.warn(`\x1b[33m${formattedEntry}\x1b[0m`); // Yellow
          break;
        case 'error':
          console.error(`\x1b[31m${formattedEntry}\x1b[0m`); // Red
          break;
        default:
          console.log(formattedEntry);
      }
    } else {
      // In production, send to logging service
      Logger.sendToLogService(entry);
    }
  }

  private static async sendToLogService(entry: LogEntry): Promise<void> {
    try {
      // Send to external logging service (e.g., Sentry, LogRocket, etc.)
      // This is a placeholder implementation
      if (typeof window !== 'undefined') {
        // Client-side logging
        const response = await fetch('/api/logs', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(entry),
        });
        
        if (!response.ok) {
          console.error('Failed to send log to service:', await response.text());
        }
      }
    } catch (error) {
      console.error('Error sending log to service:', error);
    }
  }

  static debug(message: string, context?: string, data?: any): void {
    if (Logger.isDevelopment || Logger.isTest) {
      const entry = Logger.createLogEntry('debug', message, context, data);
      Logger.log(entry);
    }
  }

  static info(message: string, context?: string, data?: any): void {
    const entry = Logger.createLogEntry('info', message, context, data);
    Logger.log(entry);
  }

  static warn(message: string, context?: string, data?: any): void {
    const entry = Logger.createLogEntry('warn', message, context, data);
    Logger.log(entry);
  }

  static error(message: string, context?: string, data?: any): void {
    const entry = Logger.createLogEntry('error', message, context, data);
    Logger.log(entry);
  }

  // Specialized logging methods
  static auth(message: string, data?: any): void {
    Logger.info(message, 'Auth', data);
  }

  static api(message: string, data?: any): void {
    Logger.info(message, 'API', data);
  }

  static database(message: string, data?: any): void {
    Logger.info(message, 'Database', data);
  }

  static performance(message: string, data?: any): void {
    Logger.info(message, 'Performance', data);
  }

  static user(message: string, data?: any): void {
    Logger.info(message, 'User', data);
  }

  static video(message: string, data?: any): void {
    Logger.info(message, 'Video', data);
  }

  // Error tracking
  static trackError(error: Error, context?: string, data?: any): void {
    const errorData = {
      name: error.name,
      message: error.message,
      stack: error.stack,
      ...data,
    };

    Logger.error(`Error: ${error.message}`, context, errorData);
  }

  static trackApiError(response: Response, context?: string): void {
    Logger.error(`API Error: ${response.status} ${response.statusText}`, context, {
      url: response.url,
      status: response.status,
      statusText: response.statusText,
    });
  }

  static trackUserAction(action: string, data?: any): void {
    Logger.info(`User Action: ${action}`, 'User', data);
  }

  static trackPerformance(metric: string, value: number, data?: any): void {
    Logger.info(`Performance: ${metric} = ${value}ms`, 'Performance', {
      metric,
      value,
      ...data,
    });
  }

  // Component lifecycle logging
  static componentMount(componentName: string, props?: any): void {
    Logger.debug(`Component mounted: ${componentName}`, 'Component', { props });
  }

  static componentUnmount(componentName: string): void {
    Logger.debug(`Component unmounted: ${componentName}`, 'Component');
  }

  static componentUpdate(componentName: string, props?: any): void {
    Logger.debug(`Component updated: ${componentName}`, 'Component', { props });
  }
}

export default Logger;