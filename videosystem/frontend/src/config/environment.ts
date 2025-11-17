interface EnvironmentConfig {
  // Supabase Configuration
  supabaseUrl: string;
  supabaseAnonKey: string;
  
  // Application Configuration
  apiUrl: string;
  nodeEnv: 'development' | 'staging' | 'production';
  appVersion: string;
  
  // Feature Flags
  enableDebugMode: boolean;
  enableErrorReporting: boolean;
  enablePerformanceMonitoring: boolean;
  
  // API Configuration
  apiTimeout: number;
  apiRetryAttempts: number;
  apiRetryDelay: number;
  
  // Storage Configuration
  storagePrefix: string;
  maxFileSize: number;
  allowedFileTypes: string[];
  
  // Export Configuration
  maxExportDuration: number;
  defaultExportQuality: string;
  supportedExportFormats: string[];
  
  // UI Configuration
  defaultTheme: 'light' | 'dark' | 'system';
  defaultLanguage: string;
  enableAnimations: boolean;
  
  // Performance Configuration
  performanceThresholds: {
    renderTime: number;
    apiResponseTime: number;
    loadTime: number;
  };
}

class Environment {
  private static config: EnvironmentConfig;
  private static isInitialized = false;

  static initialize(): void {
    if (this.isInitialized) {
      return;
    }

    this.config = this.createConfig();
    this.isInitialized = true;
    
    // Validate required environment variables
    this.validateConfig();
  }

  private static createConfig(): EnvironmentConfig {
    return {
      // Supabase Configuration
      supabaseUrl: this.getRequiredEnvVar('NEXT_PUBLIC_SUPABASE_URL'),
      supabaseAnonKey: this.getRequiredEnvVar('NEXT_PUBLIC_SUPABASE_ANON_KEY'),
      
      // Application Configuration
      apiUrl: this.getEnvVar('NEXT_PUBLIC_API_URL', '/api'),
      nodeEnv: this.getEnvVar('NODE_ENV', 'development') as 'development' | 'staging' | 'production',
      appVersion: this.getEnvVar('NEXT_PUBLIC_APP_VERSION', '1.0.0'),
      
      // Feature Flags
      enableDebugMode: this.getEnvVar('NEXT_PUBLIC_ENABLE_DEBUG_MODE', 'false') === 'true',
      enableErrorReporting: this.getEnvVar('NEXT_PUBLIC_ENABLE_ERROR_REPORTING', 'true') === 'true',
      enablePerformanceMonitoring: this.getEnvVar('NEXT_PUBLIC_ENABLE_PERFORMANCE_MONITORING', 'true') === 'true',
      
      // API Configuration
      apiTimeout: parseInt(this.getEnvVar('NEXT_PUBLIC_API_TIMEOUT', '10000')),
      apiRetryAttempts: parseInt(this.getEnvVar('NEXT_PUBLIC_API_RETRY_ATTEMPTS', '3')),
      apiRetryDelay: parseInt(this.getEnvVar('NEXT_PUBLIC_API_RETRY_DELAY', '1000')),
      
      // Storage Configuration
      storagePrefix: this.getEnvVar('NEXT_PUBLIC_STORAGE_PREFIX', 'viracut'),
      maxFileSize: parseInt(this.getEnvVar('NEXT_PUBLIC_MAX_FILE_SIZE', '52428800')), // 50MB
      allowedFileTypes: this.getEnvVar('NEXT_PUBLIC_ALLOWED_FILE_TYPES', 'video/mp4,video/webm,image/jpeg,image/png,image/gif,audio/mpeg,audio/wav').split(','),
      
      // Export Configuration
      maxExportDuration: parseInt(this.getEnvVar('NEXT_PUBLIC_MAX_EXPORT_DURATION', '300')),
      defaultExportQuality: this.getEnvVar('NEXT_PUBLIC_DEFAULT_EXPORT_QUALITY', 'medium'),
      supportedExportFormats: this.getEnvVar('NEXT_PUBLIC_SUPPORTED_EXPORT_FORMATS', 'mp4,webm').split(','),
      
      // UI Configuration
      defaultTheme: this.getEnvVar('NEXT_PUBLIC_DEFAULT_THEME', 'system') as 'light' | 'dark' | 'system',
      defaultLanguage: this.getEnvVar('NEXT_PUBLIC_DEFAULT_LANGUAGE', 'en'),
      enableAnimations: this.getEnvVar('NEXT_PUBLIC_ENABLE_ANIMATIONS', 'true') === 'true',
      
      // Performance Configuration
      performanceThresholds: {
        renderTime: parseInt(this.getEnvVar('NEXT_PUBLIC_RENDER_TIME_THRESHOLD', '16')),
        apiResponseTime: parseInt(this.getEnvVar('NEXT_PUBLIC_API_RESPONSE_TIME_THRESHOLD', '1000')),
        loadTime: parseInt(this.getEnvVar('NEXT_PUBLIC_LOAD_TIME_THRESHOLD', '3000')),
      },
    };
  }

  private static validateConfig(): void {
    const requiredVars = [
      'NEXT_PUBLIC_SUPABASE_URL',
      'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    ];

    const missingVars = requiredVars.filter(varName => !process.env[varName]);

    if (missingVars.length > 0) {
      console.error(`Missing required environment variables: ${missingVars.join(', ')}`);
      
      if (typeof window !== 'undefined') {
        // Show user-friendly error in browser
        document.body.innerHTML = `
          <div style="
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.8);
            color: white;
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 9999;
            font-family: Arial, sans-serif;
          ">
            <div style="
              background: white;
              padding: 2rem;
              border-radius: 8px;
              box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
              max-width: 500px;
              text-align: center;
            ">
              <h1 style="color: #e53e3e; margin-bottom: 1rem;">Configuration Error</h1>
              <p style="margin-bottom: 1rem;">Missing required environment variables:</p>
              <ul style="text-align: left; color: #666;">
                ${missingVars.map(varName => `<li style="margin-bottom: 0.5rem;"><code>${varName}</code></li>`).join('')}
              </ul>
              <p style="font-size: 0.875rem; color: #666;">Please check your environment configuration and reload the page.</p>
            </div>
          </div>
        `;
      }
    }
  }

  private static getRequiredEnvVar(key: string): string {
    const value = process.env[key];
    if (!value) {
      throw new Error(`Required environment variable ${key} is not set`);
    }
    return value;
  }

  private static getEnvVar(key: string, defaultValue: string): string {
    return process.env[key] || defaultValue;
  }

  static getConfig(): EnvironmentConfig {
    if (!this.isInitialized) {
      this.initialize();
    }
    return this.config;
  }

  static isDevelopment(): boolean {
    return this.getConfig().nodeEnv === 'development';
  }

  static isStaging(): boolean {
    return this.getConfig().nodeEnv === 'staging';
  }

  static isProduction(): boolean {
    return this.getConfig().nodeEnv === 'production';
  }

  static isDebugMode(): boolean {
    return this.getConfig().enableDebugMode;
  }

  static isErrorReportingEnabled(): boolean {
    return this.getConfig().enableErrorReporting;
  }

  static isPerformanceMonitoringEnabled(): boolean {
    return this.getConfig().enablePerformanceMonitoring;
  }

  static getApiUrl(): string {
    return this.getConfig().apiUrl;
  }

  static getSupabaseUrl(): string {
    return this.getConfig().supabaseUrl;
  }

  static getSupabaseAnonKey(): string {
    return this.getConfig().supabaseAnonKey;
  }

  static getMaxFileSize(): number {
    return this.getConfig().maxFileSize;
  }

  static getAllowedFileTypes(): string[] {
    return this.getConfig().allowedFileTypes;
  }

  static getMaxExportDuration(): number {
    return this.getConfig().maxExportDuration;
  }

  static getDefaultExportQuality(): string {
    return this.getConfig().defaultExportQuality;
  }

  static getSupportedExportFormats(): string[] {
    return this.getConfig().supportedExportFormats;
  }

  static getDefaultTheme(): 'light' | 'dark' | 'system' {
    return this.getConfig().defaultTheme;
  }

  static getDefaultLanguage(): string {
    return this.getConfig().defaultLanguage;
  }

  static areAnimationsEnabled(): boolean {
    return this.getConfig().enableAnimations;
  }

  static getPerformanceThresholds(): EnvironmentConfig['performanceThresholds'] {
    return this.getConfig().performanceThresholds;
  }

  static getApiTimeout(): number {
    return this.getConfig().apiTimeout;
  }

  static getApiRetryAttempts(): number {
    return this.getConfig().apiRetryAttempts;
  }

  static getApiRetryDelay(): number {
    return this.getConfig().apiRetryDelay;
  }

  static getAppVersion(): string {
    return this.getConfig().appVersion;
  }

  static getStoragePrefix(): string {
    return this.getConfig().storagePrefix;
  }
}

export default Environment;
export type { EnvironmentConfig };