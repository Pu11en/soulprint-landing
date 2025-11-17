import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/utils/logger';

interface PerformanceReport {
  metrics: {
    render: Array<{
      componentName: string;
      renderTime: number;
      timestamp: number;
      memoryUsage?: number;
    }>;
    api: Array<{
      url: string;
      method: string;
      duration: number;
      status: number;
      timestamp: number;
      error?: string;
    }>;
    webVitals: {
      fcp?: number;
      lcp?: number;
      fid?: number;
      cls?: number;
      ttfb?: number;
    }>;
  };
  userAgent: string;
  timestamp: number;
}

export async function POST(request: NextRequest) {
  try {
    const body: PerformanceReport = await request.json();
    
    // Log performance metrics
    logger.info('Performance metrics received', {
      renderCount: body.metrics.render.length,
      apiCount: body.metrics.api.length,
      webVitals: body.metrics.webVitals,
      userAgent: body.userAgent || request.headers.get('user-agent') || 'unknown',
      timestamp: body.timestamp || Date.now(),
    });

    // In a production environment, you would:
    // 1. Store metrics in a database (e.g., Supabase)
    // 2. Send to analytics service (e.g., Vercel Analytics, Google Analytics)
    // 3. Set up alerts for performance degradation
    // 4. Aggregate metrics for reporting

    // For now, we'll just log the data and return success
    
    // Log slow renders (> 100ms)
    const slowRenders = body.metrics.render.filter(m => m.renderTime > 100);
    if (slowRenders.length > 0) {
      logger.warn('Slow renders detected', {
        count: slowRenders.length,
        renders: slowRenders.map(r => ({
          component: r.componentName,
          renderTime: r.renderTime,
        })),
      });
    }

    // Log slow API calls (> 2s)
    const slowApiCalls = body.metrics.api.filter(m => m.duration > 2000);
    if (slowApiCalls.length > 0) {
      logger.warn('Slow API calls detected', {
        count: slowApiCalls.length,
        calls: slowApiCalls.map(c => ({
          url: c.url,
          method: c.method,
          duration: c.duration,
          status: c.status,
        })),
      });
    }

    // Log poor Web Vitals
    const { webVitals } = body.metrics;
    const performanceIssues = [];
    
    if (webVitals.fcp && webVitals.fcp > 1800) {
      performanceIssues.push(`FCP: ${webVitals.fcp.toFixed(0)}ms (threshold: 1800ms)`);
    }
    
    if (webVitals.lcp && webVitals.lcp > 2500) {
      performanceIssues.push(`LCP: ${webVitals.lcp.toFixed(0)}ms (threshold: 2500ms)`);
    }
    
    if (webVitals.fid && webVitals.fid > 100) {
      performanceIssues.push(`FID: ${webVitals.fid.toFixed(0)}ms (threshold: 100ms)`);
    }
    
    if (webVitals.cls && webVitals.cls > 0.1) {
      performanceIssues.push(`CLS: ${webVitals.cls.toFixed(3)} (threshold: 0.1)`);
    }
    
    if (webVitals.ttfb && webVitals.ttfb > 800) {
      performanceIssues.push(`TTFB: ${webVitals.ttfb.toFixed(0)}ms (threshold: 800ms)`);
    }

    if (performanceIssues.length > 0) {
      logger.warn('Performance issues detected', {
        issues: performanceIssues,
        webVitals,
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('Failed to process performance metrics', error);
    
    return NextResponse.json(
      { error: 'Failed to process performance metrics' },
      { status: 500 }
    );
  }
}

// Optional: GET endpoint to retrieve aggregated performance data
export async function GET(request: NextRequest) {
  try {
    // In a real implementation, you would fetch aggregated data from your database
    // For now, we'll return a placeholder response
    
    return NextResponse.json({
      message: 'Performance data aggregation not implemented yet',
      // Example of what you might return:
      // avgRenderTime: 12.5,
      // avgApiResponseTime: 245,
      // webVitalsPercentiles: {
      //   fcp: { p50: 1200, p75: 1800, p95: 3000 },
      //   lcp: { p50: 1800, p75: 2500, p95: 4000 },
      // },
    });
  } catch (error) {
    logger.error('Failed to retrieve performance data', error);
    
    return NextResponse.json(
      { error: 'Failed to retrieve performance data' },
      { status: 500 }
    );
  }
}