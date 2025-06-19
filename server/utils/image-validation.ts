/**
 * Image Validation Utilities
 * 
 * Provides functionality to validate product images for quality and availability
 */

import axios from 'axios';

interface ImageValidationResult {
  isValid: boolean;
  warnings: string[];
  metadata: {
    width?: number;
    height?: number;
    size?: number;
    format?: string;
    accessible: boolean;
  };
}

/**
 * Validate image URL for accessibility and quality
 */
export async function validateImageUrl(imageUrl: string): Promise<ImageValidationResult> {
  const result: ImageValidationResult = {
    isValid: true,
    warnings: [],
    metadata: {
      accessible: false
    }
  };

  if (!imageUrl) {
    result.isValid = false;
    result.warnings.push('No image URL provided');
    return result;
  }

  try {
    // Check if image is accessible
    const response = await axios.head(imageUrl, {
      timeout: 5000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; ImageValidator/1.0)'
      }
    });

    result.metadata.accessible = response.status === 200;

    if (response.status !== 200) {
      result.isValid = false;
      result.warnings.push(`Image not accessible (HTTP ${response.status})`);
      return result;
    }

    // Get content type and size
    const contentType = response.headers['content-type'];
    const contentLength = response.headers['content-length'];

    if (contentType) {
      if (!contentType.startsWith('image/')) {
        result.isValid = false;
        result.warnings.push('URL does not point to an image file');
        return result;
      }
      result.metadata.format = contentType.split('/')[1];
    }

    if (contentLength) {
      result.metadata.size = parseInt(contentLength);
      
      // Check minimum file size (5KB)
      if (result.metadata.size < 5120) {
        result.warnings.push('Image file size too small (likely placeholder)');
      }
      
      // Check maximum file size (10MB)
      if (result.metadata.size > 10485760) {
        result.warnings.push('Image file size very large (may affect loading)');
      }
    }

    // For more detailed validation, we'd need to actually download and analyze the image
    // For now, we'll use a lightweight approach with HEAD requests

  } catch (error) {
    result.isValid = false;
    result.metadata.accessible = false;
    
    if (axios.isAxiosError(error)) {
      if (error.code === 'ENOTFOUND') {
        result.warnings.push('Image URL domain not found');
      } else if (error.code === 'ETIMEDOUT') {
        result.warnings.push('Image URL request timed out');
      } else if (error.response?.status === 403) {
        result.warnings.push('Image access forbidden (403)');
      } else if (error.response?.status === 404) {
        result.warnings.push('Image not found (404)');
      } else {
        result.warnings.push(`Image validation failed: ${error.message}`);
      }
    } else {
      result.warnings.push('Unknown error validating image');
    }
  }

  return result;
}

/**
 * Validate multiple images and return aggregated results
 */
export async function validateMultipleImages(imageUrls: string[]): Promise<{
  results: Record<string, ImageValidationResult>;
  summary: {
    total: number;
    valid: number;
    invalid: number;
    warnings: number;
  };
}> {
  const results: Record<string, ImageValidationResult> = {};
  
  // Validate images in parallel but with concurrency limit
  const batchSize = 5;
  for (let i = 0; i < imageUrls.length; i += batchSize) {
    const batch = imageUrls.slice(i, i + batchSize);
    const batchPromises = batch.map(async (url) => {
      results[url] = await validateImageUrl(url);
    });
    await Promise.all(batchPromises);
  }

  // Calculate summary
  const summary = {
    total: imageUrls.length,
    valid: 0,
    invalid: 0,
    warnings: 0
  };

  Object.values(results).forEach(result => {
    if (result.isValid) {
      summary.valid++;
    } else {
      summary.invalid++;
    }
    if (result.warnings.length > 0) {
      summary.warnings++;
    }
  });

  return { results, summary };
}

/**
 * Generate image quality flags based on validation results
 */
export function generateImageQualityFlags(validationResult: ImageValidationResult): string[] {
  const flags: string[] = [];

  if (!validationResult.metadata.accessible) {
    flags.push('IMAGE_NOT_ACCESSIBLE');
  }

  if (validationResult.warnings.includes('Image file size too small (likely placeholder)')) {
    flags.push('LIKELY_PLACEHOLDER');
  }

  if (validationResult.warnings.some(w => w.includes('timed out'))) {
    flags.push('SLOW_LOADING');
  }

  if (validationResult.warnings.some(w => w.includes('404'))) {
    flags.push('IMAGE_NOT_FOUND');
  }

  if (validationResult.warnings.some(w => w.includes('403'))) {
    flags.push('ACCESS_FORBIDDEN');
  }

  if (!validationResult.isValid) {
    flags.push('INVALID_IMAGE');
  }

  return flags;
}