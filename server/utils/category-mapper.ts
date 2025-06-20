/**
 * Category Mapping Utilities
 * Handles intelligent category name-to-ID mapping for data ingestion
 */

import { db } from '../db';
import { categories } from '../../shared/schema';
import { eq, ilike, or } from 'drizzle-orm';

interface CategoryMappingResult {
  categoryId: number | null;
  categoryName: string | null;
  confidence: number;
  matchType: 'exact' | 'fuzzy' | 'partial' | 'created' | 'none';
}

export class CategoryMapper {
  private categoryCache: Map<string, CategoryMappingResult> = new Map();
  
  /**
   * Map a category name to category ID with intelligent matching
   */
  async mapCategoryNameToId(categoryName: string): Promise<CategoryMappingResult> {
    if (!categoryName || typeof categoryName !== 'string') {
      return {
        categoryId: null,
        categoryName: null,
        confidence: 0,
        matchType: 'none'
      };
    }

    const normalizedName = this.normalizeCategoryName(categoryName);
    
    // Check cache first
    if (this.categoryCache.has(normalizedName)) {
      return this.categoryCache.get(normalizedName)!;
    }

    let result: CategoryMappingResult;

    try {
      // 1. Try exact match
      result = await this.tryExactMatch(normalizedName);
      if (result.categoryId) {
        this.categoryCache.set(normalizedName, result);
        return result;
      }

      // 2. Try fuzzy matching
      result = await this.tryFuzzyMatch(normalizedName);
      if (result.categoryId) {
        this.categoryCache.set(normalizedName, result);
        return result;
      }

      // 3. Try partial matching
      result = await this.tryPartialMatch(normalizedName);
      if (result.categoryId) {
        this.categoryCache.set(normalizedName, result);
        return result;
      }

      // 4. Create new category if auto-creation is enabled
      result = await this.createCategoryIfNeeded(categoryName);
      this.categoryCache.set(normalizedName, result);
      return result;

    } catch (error) {
      console.error('Error in category mapping:', error);
      result = {
        categoryId: null,
        categoryName: categoryName,
        confidence: 0,
        matchType: 'none'
      };
      this.categoryCache.set(normalizedName, result);
      return result;
    }
  }

  /**
   * Try exact name match
   */
  private async tryExactMatch(normalizedName: string): Promise<CategoryMappingResult> {
    const exactMatches = await db.select()
      .from(categories)
      .where(eq(categories.name, normalizedName))
      .limit(1);

    if (exactMatches.length > 0) {
      const category = exactMatches[0];
      return {
        categoryId: category.id,
        categoryName: category.name,
        confidence: 1.0,
        matchType: 'exact'
      };
    }

    return {
      categoryId: null,
      categoryName: null,
      confidence: 0,
      matchType: 'none'
    };
  }

  /**
   * Try fuzzy matching with case-insensitive search
   */
  private async tryFuzzyMatch(normalizedName: string): Promise<CategoryMappingResult> {
    const fuzzyMatches = await db.select()
      .from(categories)
      .where(ilike(categories.name, normalizedName))
      .limit(5);

    if (fuzzyMatches.length > 0) {
      // Find best match based on string similarity
      let bestMatch = fuzzyMatches[0];
      let bestScore = this.calculateSimilarity(normalizedName, bestMatch.name);

      for (const match of fuzzyMatches) {
        const score = this.calculateSimilarity(normalizedName, match.name);
        if (score > bestScore) {
          bestScore = score;
          bestMatch = match;
        }
      }

      if (bestScore >= 0.8) {
        return {
          categoryId: bestMatch.id,
          categoryName: bestMatch.name,
          confidence: bestScore,
          matchType: 'fuzzy'
        };
      }
    }

    return {
      categoryId: null,
      categoryName: null,
      confidence: 0,
      matchType: 'none'
    };
  }

  /**
   * Try partial matching for complex category names
   */
  private async tryPartialMatch(normalizedName: string): Promise<CategoryMappingResult> {
    // Split category name and try matching parts
    const parts = normalizedName.split(/[,|>\/\-\s]+/).filter(part => part.length > 2);
    
    for (const part of parts) {
      const partialMatches = await db.select()
        .from(categories)
        .where(or(
          ilike(categories.name, `%${part}%`),
          ilike(categories.code, `%${part.toLowerCase()}%`)
        ))
        .limit(3);

      if (partialMatches.length > 0) {
        const bestMatch = partialMatches[0];
        const confidence = 0.6; // Lower confidence for partial matches

        return {
          categoryId: bestMatch.id,
          categoryName: bestMatch.name,
          confidence: confidence,
          matchType: 'partial'
        };
      }
    }

    return {
      categoryId: null,
      categoryName: null,
      confidence: 0,
      matchType: 'none'
    };
  }

  /**
   * Create new category if auto-creation is enabled
   */
  private async createCategoryIfNeeded(originalName: string): Promise<CategoryMappingResult> {
    // For now, return null - category auto-creation can be enabled later
    // In production, you might want to create categories automatically
    // or add them to a queue for manual review
    
    return {
      categoryId: null,
      categoryName: originalName,
      confidence: 0,
      matchType: 'none'
    };
  }

  /**
   * Normalize category name for consistent matching
   */
  private normalizeCategoryName(name: string): string {
    return name
      .trim()
      .toLowerCase()
      .replace(/[^\w\s,|>\-\/]/g, '') // Remove special chars except common separators
      .replace(/\s+/g, ' '); // Normalize whitespace
  }

  /**
   * Calculate string similarity using simple algorithm
   */
  private calculateSimilarity(str1: string, str2: string): number {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    
    if (longer.length === 0) return 1.0;
    
    const editDistance = this.levenshteinDistance(longer, shorter);
    return (longer.length - editDistance) / longer.length;
  }

  /**
   * Calculate Levenshtein distance
   */
  private levenshteinDistance(str1: string, str2: string): number {
    const matrix = [];
    
    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }
    
    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }
    
    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }
    
    return matrix[str2.length][str1.length];
  }

  /**
   * Clear the category cache
   */
  clearCache(): void {
    this.categoryCache.clear();
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; entries: string[] } {
    return {
      size: this.categoryCache.size,
      entries: Array.from(this.categoryCache.keys())
    };
  }
}

// Export singleton instance
export const categoryMapper = new CategoryMapper();