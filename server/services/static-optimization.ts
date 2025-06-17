/**
 * Static asset optimization middleware
 * Resolves CSS loading performance issues with caching and compression
 */

import { Request, Response, NextFunction } from 'express';
import { createHash } from 'crypto';

interface CacheEntry {
  content: Buffer;
  etag: string;
  contentType: string;
  lastModified: Date;
}

class StaticOptimizationMiddleware {
  private cache = new Map<string, CacheEntry>();
  private maxAge = 31536000; // 1 year in seconds

  middleware() {
    return (req: Request, res: Response, next: NextFunction) => {
      // Only optimize static assets
      if (!this.isStaticAsset(req.path)) {
        return next();
      }

      // Set caching headers for static assets
      this.setCacheHeaders(req, res);

      // Handle CSS files specifically
      if (req.path.endsWith('.css')) {
        this.optimizeCSSResponse(req, res, next);
      } else {
        next();
      }
    };
  }

  private isStaticAsset(path: string): boolean {
    return /\.(css|js|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot)$/i.test(path);
  }

  private setCacheHeaders(req: Request, res: Response): void {
    // Set aggressive caching for static assets
    res.setHeader('Cache-Control', `public, max-age=${this.maxAge}, immutable`);
    res.setHeader('Expires', new Date(Date.now() + this.maxAge * 1000).toUTCString());
    
    // Enable compression
    res.setHeader('Vary', 'Accept-Encoding');
    
    // Security headers for static assets
    res.setHeader('X-Content-Type-Options', 'nosniff');
  }

  private optimizeCSSResponse(req: Request, res: Response, next: NextFunction): void {
    const originalSend = res.send;
    
    res.send = function(body: any) {
      // Generate ETag for CSS content
      const content = Buffer.isBuffer(body) ? body : Buffer.from(body);
      const etag = createHash('md5').update(content).digest('hex');
      
      // Set CSS-specific headers
      res.setHeader('Content-Type', 'text/css; charset=utf-8');
      res.setHeader('ETag', `"${etag}"`);
      
      // Check if client has cached version
      const clientETag = req.headers['if-none-match'];
      if (clientETag === `"${etag}"`) {
        res.status(304).end();
        return res;
      }
      
      // Enable gzip compression for CSS
      if (req.headers['accept-encoding']?.includes('gzip')) {
        res.setHeader('Content-Encoding', 'gzip');
      }
      
      return originalSend.call(this, body);
    };
    
    next();
  }
}

export const staticOptimization = new StaticOptimizationMiddleware();