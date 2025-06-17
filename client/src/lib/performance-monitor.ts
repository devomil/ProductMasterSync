/**
 * Frontend performance monitoring and error tracking
 * Captures load times, API latency, and runtime errors
 */

interface PerformanceMetric {
  timestamp: string;
  type: 'navigation' | 'api' | 'resource' | 'error';
  name: string;
  duration: number;
  status?: number;
  error?: string;
  stack?: string;
  url?: string;
}

interface APICall {
  url: string;
  method: string;
  duration: number;
  status: number;
  timestamp: string;
  error?: string;
}

class PerformanceMonitor {
  private metrics: PerformanceMetric[] = [];
  private apiCalls: APICall[] = [];
  private errorCount = 0;
  private maxMetrics = 500;

  constructor() {
    this.setupErrorHandling();
    this.setupPerformanceObserver();
    this.monitorPageLoad();
  }

  private setupErrorHandling() {
    // Capture unhandled JavaScript errors
    window.addEventListener('error', (event) => {
      this.logError({
        type: 'error',
        name: 'JavaScript Error',
        error: event.message,
        stack: event.error?.stack,
        url: event.filename,
        duration: 0
      });
    });

    // Capture unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      this.logError({
        type: 'error',
        name: 'Unhandled Promise Rejection',
        error: event.reason?.message || String(event.reason),
        stack: event.reason?.stack,
        duration: 0
      });
    });

    // Capture React errors (if using React error boundaries)
    if (typeof window !== 'undefined' && (window as any).__REACT_ERROR_OVERLAY_GLOBAL_HOOK__) {
      const originalCaptureException = (window as any).__REACT_ERROR_OVERLAY_GLOBAL_HOOK__.captureException;
      (window as any).__REACT_ERROR_OVERLAY_GLOBAL_HOOK__.captureException = (error: Error) => {
        this.logError({
          type: 'error',
          name: 'React Error',
          error: error.message,
          stack: error.stack,
          duration: 0
        });
        return originalCaptureException?.(error);
      };
    }
  }

  private setupPerformanceObserver() {
    if ('PerformanceObserver' in window) {
      // Monitor navigation timing
      const navObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.entryType === 'navigation') {
            const navEntry = entry as PerformanceNavigationTiming;
            this.logMetric({
              type: 'navigation',
              name: 'Page Load',
              duration: navEntry.loadEventEnd - navEntry.navigationStart,
              url: window.location.href
            });
          }
        }
      });
      navObserver.observe({ entryTypes: ['navigation'] });

      // Monitor resource loading
      const resourceObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.entryType === 'resource') {
            const resourceEntry = entry as PerformanceResourceTiming;
            // Only log slow resources (>1 second)
            if (resourceEntry.duration > 1000) {
              this.logMetric({
                type: 'resource',
                name: resourceEntry.name,
                duration: resourceEntry.duration,
                url: resourceEntry.name
              });
            }
          }
        }
      });
      resourceObserver.observe({ entryTypes: ['resource'] });
    }
  }

  private monitorPageLoad() {
    // Monitor initial page load performance
    window.addEventListener('load', () => {
      setTimeout(() => {
        const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
        if (navigation) {
          this.logMetric({
            type: 'navigation',
            name: 'DOM Content Loaded',
            duration: navigation.domContentLoadedEventEnd - navigation.navigationStart
          });

          this.logMetric({
            type: 'navigation',
            name: 'First Paint',
            duration: navigation.responseEnd - navigation.navigationStart
          });
        }

        // Check for Core Web Vitals
        this.measureWebVitals();
      }, 0);
    });
  }

  private measureWebVitals() {
    // Largest Contentful Paint (LCP)
    if ('PerformanceObserver' in window) {
      const lcpObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const lastEntry = entries[entries.length - 1];
        this.logMetric({
          type: 'navigation',
          name: 'Largest Contentful Paint',
          duration: lastEntry.startTime
        });
      });
      lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] });

      // Cumulative Layout Shift (CLS)
      let clsValue = 0;
      const clsObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (!(entry as any).hadRecentInput) {
            clsValue += (entry as any).value;
          }
        }
        this.logMetric({
          type: 'navigation',
          name: 'Cumulative Layout Shift',
          duration: clsValue * 1000 // Convert to milliseconds for consistency
        });
      });
      clsObserver.observe({ entryTypes: ['layout-shift'] });
    }
  }

  logMetric(metric: Omit<PerformanceMetric, 'timestamp'>) {
    const fullMetric: PerformanceMetric = {
      ...metric,
      timestamp: new Date().toISOString()
    };

    this.metrics.push(fullMetric);

    // Keep only recent metrics
    if (this.metrics.length > this.maxMetrics) {
      this.metrics = this.metrics.slice(-this.maxMetrics);
    }

    // Send critical metrics to backend
    if (metric.duration > 5000 || metric.type === 'error') {
      this.sendToBackend(fullMetric);
    }
  }

  logError(error: Omit<PerformanceMetric, 'timestamp'>) {
    this.errorCount++;
    this.logMetric(error);
    
    // Send error to backend immediately
    this.sendToBackend({
      ...error,
      timestamp: new Date().toISOString()
    });
  }

  // Monitor API calls made through fetch
  monitorAPICall(url: string, options: RequestInit = {}) {
    const startTime = Date.now();
    const method = options.method || 'GET';

    return fetch(url, options)
      .then(response => {
        const duration = Date.now() - startTime;
        const apiCall: APICall = {
          url,
          method,
          duration,
          status: response.status,
          timestamp: new Date().toISOString()
        };

        this.apiCalls.push(apiCall);
        this.logMetric({
          type: 'api',
          name: `${method} ${url}`,
          duration,
          status: response.status,
          url
        });

        // Keep only recent API calls
        if (this.apiCalls.length > this.maxMetrics) {
          this.apiCalls = this.apiCalls.slice(-this.maxMetrics);
        }

        return response;
      })
      .catch(error => {
        const duration = Date.now() - startTime;
        const apiCall: APICall = {
          url,
          method,
          duration,
          status: 0,
          timestamp: new Date().toISOString(),
          error: error.message
        };

        this.apiCalls.push(apiCall);
        this.logError({
          type: 'api',
          name: `${method} ${url}`,
          duration,
          error: error.message,
          url
        });

        throw error;
      });
  }

  private async sendToBackend(metric: PerformanceMetric) {
    try {
      await fetch('/api/monitoring/frontend-metrics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(metric)
      });
    } catch (error) {
      // Silently fail to avoid infinite loops
      console.warn('Failed to send metric to backend:', error);
    }
  }

  getMetrics() {
    return {
      totalMetrics: this.metrics.length,
      errorCount: this.errorCount,
      averageLoadTime: this.getAverageLoadTime(),
      slowestAPICalls: this.getSlowestAPICalls(),
      errorRate: this.metrics.length > 0 ? (this.errorCount / this.metrics.length) * 100 : 0,
      recentErrors: this.getRecentErrors()
    };
  }

  private getAverageLoadTime(): number {
    const loadMetrics = this.metrics.filter(m => m.type === 'navigation');
    if (loadMetrics.length === 0) return 0;
    
    const totalTime = loadMetrics.reduce((sum, m) => sum + m.duration, 0);
    return totalTime / loadMetrics.length;
  }

  private getSlowestAPICalls(limit = 5): APICall[] {
    return this.apiCalls
      .sort((a, b) => b.duration - a.duration)
      .slice(0, limit);
  }

  private getRecentErrors(limit = 5): PerformanceMetric[] {
    return this.metrics
      .filter(m => m.type === 'error')
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, limit);
  }

  // Get performance insights
  getInsights() {
    const insights: string[] = [];
    const avgLoadTime = this.getAverageLoadTime();
    
    if (avgLoadTime > 3000) {
      insights.push('Page load time is slow (>3s) - consider optimizing bundle size');
    }
    
    const slowAPIs = this.apiCalls.filter(call => call.duration > 2000);
    if (slowAPIs.length > 0) {
      insights.push(`${slowAPIs.length} API calls are slow (>2s) - check backend performance`);
    }
    
    const errorRate = this.metrics.length > 0 ? (this.errorCount / this.metrics.length) * 100 : 0;
    if (errorRate > 5) {
      insights.push(`High error rate (${errorRate.toFixed(1)}%) - investigate error sources`);
    }
    
    const resourceMetrics = this.metrics.filter(m => m.type === 'resource');
    const slowResources = resourceMetrics.filter(m => m.duration > 1000);
    if (slowResources.length > 0) {
      insights.push(`${slowResources.length} resources are loading slowly - optimize images/assets`);
    }
    
    return insights;
  }
}

export const performanceMonitor = new PerformanceMonitor();