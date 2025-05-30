/**
 * Smart URL Validation and Health Check Service
 * Validates documentation URLs and provides health status
 */

import axios from 'axios';

export interface UrlHealthStatus {
  url: string;
  status: 'healthy' | 'broken' | 'redirected' | 'timeout' | 'unreachable';
  statusCode?: number;
  responseTime?: number;
  redirectUrl?: string;
  error?: string;
  lastChecked: Date;
  contentType?: string;
  fileSize?: number;
}

export interface BulkUrlHealthResult {
  results: UrlHealthStatus[];
  summary: {
    total: number;
    healthy: number;
    broken: number;
    redirected: number;
    timeout: number;
    unreachable: number;
  };
}

export class UrlValidator {
  private static readonly TIMEOUT_MS = 10000; // 10 second timeout
  private static readonly MAX_REDIRECTS = 5;
  private static readonly USER_AGENT = 'MDM-PIM-URL-Validator/1.0';

  /**
   * Validate a single URL and return health status
   */
  static async validateUrl(url: string): Promise<UrlHealthStatus> {
    const startTime = Date.now();
    
    try {
      if (!url || !this.isValidUrlFormat(url)) {
        return {
          url,
          status: 'broken',
          error: 'Invalid URL format',
          lastChecked: new Date(),
          responseTime: 0
        };
      }

      const response = await axios.head(url, {
        timeout: this.TIMEOUT_MS,
        maxRedirects: this.MAX_REDIRECTS,
        validateStatus: (status) => status < 500, // Accept redirects and client errors
        headers: {
          'User-Agent': this.USER_AGENT,
          'Accept': 'application/pdf,*/*'
        }
      });

      const responseTime = Date.now() - startTime;
      const contentType = response.headers['content-type'] || 'unknown';
      const contentLength = parseInt(response.headers['content-length'] || '0');

      // Check if URL was redirected
      const wasRedirected = response.request.res?.responseUrl !== url;
      const finalUrl = response.request.res?.responseUrl || url;

      let status: UrlHealthStatus['status'] = 'healthy';
      if (response.status >= 400) {
        status = 'broken';
      } else if (wasRedirected) {
        status = 'redirected';
      }

      return {
        url,
        status,
        statusCode: response.status,
        responseTime,
        redirectUrl: wasRedirected ? finalUrl : undefined,
        lastChecked: new Date(),
        contentType,
        fileSize: contentLength > 0 ? contentLength : undefined
      };

    } catch (error: any) {
      const responseTime = Date.now() - startTime;
      
      let status: UrlHealthStatus['status'] = 'unreachable';
      let errorMessage = 'Unknown error';

      if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
        status = 'timeout';
        errorMessage = 'Request timeout';
      } else if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
        status = 'unreachable';
        errorMessage = 'Host unreachable';
      } else if (error.response) {
        status = 'broken';
        errorMessage = `HTTP ${error.response.status}: ${error.response.statusText}`;
      } else {
        errorMessage = error.message || 'Network error';
      }

      return {
        url,
        status,
        statusCode: error.response?.status,
        responseTime,
        error: errorMessage,
        lastChecked: new Date()
      };
    }
  }

  /**
   * Validate multiple URLs in parallel with concurrency control
   */
  static async validateUrls(urls: string[], concurrency: number = 5): Promise<BulkUrlHealthResult> {
    const results: UrlHealthStatus[] = [];
    const uniqueUrls = [...new Set(urls.filter(url => url && url.trim()))];
    
    // Process URLs in batches to control concurrency
    for (let i = 0; i < uniqueUrls.length; i += concurrency) {
      const batch = uniqueUrls.slice(i, i + concurrency);
      const batchResults = await Promise.all(
        batch.map(url => this.validateUrl(url))
      );
      results.push(...batchResults);
    }

    // Generate summary statistics
    const summary = {
      total: results.length,
      healthy: results.filter(r => r.status === 'healthy').length,
      broken: results.filter(r => r.status === 'broken').length,
      redirected: results.filter(r => r.status === 'redirected').length,
      timeout: results.filter(r => r.status === 'timeout').length,
      unreachable: results.filter(r => r.status === 'unreachable').length
    };

    return { results, summary };
  }

  /**
   * Validate documentation URLs for a specific product
   */
  static async validateProductDocumentation(product: {
    sku: string;
    installationGuideUrl?: string;
    ownersManualUrl?: string;
    brochureUrl?: string;
    quickGuideUrl?: string;
  }): Promise<{
    sku: string;
    documentationHealth: {
      installationGuide?: UrlHealthStatus;
      ownersManual?: UrlHealthStatus;
      brochure?: UrlHealthStatus;
      quickGuide?: UrlHealthStatus;
    };
    overallHealth: 'healthy' | 'partial' | 'broken';
  }> {
    const urls: { [key: string]: string } = {};
    
    if (product.installationGuideUrl) urls.installationGuide = product.installationGuideUrl;
    if (product.ownersManualUrl) urls.ownersManual = product.ownersManualUrl;
    if (product.brochureUrl) urls.brochure = product.brochureUrl;
    if (product.quickGuideUrl) urls.quickGuide = product.quickGuideUrl;

    const documentationHealth: any = {};
    let healthyCount = 0;
    let totalCount = 0;

    for (const [key, url] of Object.entries(urls)) {
      documentationHealth[key] = await this.validateUrl(url);
      totalCount++;
      if (documentationHealth[key].status === 'healthy' || documentationHealth[key].status === 'redirected') {
        healthyCount++;
      }
    }

    let overallHealth: 'healthy' | 'partial' | 'broken' = 'broken';
    if (healthyCount === totalCount && totalCount > 0) {
      overallHealth = 'healthy';
    } else if (healthyCount > 0) {
      overallHealth = 'partial';
    }

    return {
      sku: product.sku,
      documentationHealth,
      overallHealth
    };
  }

  /**
   * Basic URL format validation
   */
  private static isValidUrlFormat(url: string): boolean {
    try {
      new URL(url);
      return url.startsWith('http://') || url.startsWith('https://');
    } catch {
      return false;
    }
  }

  /**
   * Get health status icon for UI display
   */
  static getHealthStatusIcon(status: UrlHealthStatus['status']): {
    icon: string;
    color: string;
    label: string;
  } {
    switch (status) {
      case 'healthy':
        return { icon: '✅', color: 'green', label: 'Healthy' };
      case 'redirected':
        return { icon: '🔄', color: 'yellow', label: 'Redirected' };
      case 'broken':
        return { icon: '❌', color: 'red', label: 'Broken' };
      case 'timeout':
        return { icon: '⏱️', color: 'orange', label: 'Timeout' };
      case 'unreachable':
        return { icon: '🚫', color: 'red', label: 'Unreachable' };
      default:
        return { icon: '❓', color: 'gray', label: 'Unknown' };
    }
  }
}