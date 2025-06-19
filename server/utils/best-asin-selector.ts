/**
 * Best ASIN Selection Logic for Products with Multiple ASIN Mappings
 * 
 * This module implements intelligent ASIN selection when a single UPC
 * returns multiple Amazon ASINs. Uses authentic Amazon SP-API data only.
 */

interface ASINCandidate {
  asin: string;
  title?: string;
  brand?: string;
  price?: number;
  salesRank?: number;
  categoryRank?: number;
  buyboxHolder?: string;
  isBuyboxEligible?: boolean;
  condition?: string;
  sellersCount?: number;
  imageUrl?: string;
  score?: number;
}

interface ASINSelectionCriteria {
  // Scoring weights (should sum to 100)
  salesRankWeight: number;        // Lower rank = better (40%)
  priceCompetitivenessWeight: number;  // Reasonable pricing (25%)
  buyboxEligibilityWeight: number;     // Buy box eligibility (20%)
  dataCompletenessWeight: number;      // Complete product data (15%)
}

export class BestASINSelector {
  private criteria: ASINSelectionCriteria = {
    salesRankWeight: 40,
    priceCompetitivenessWeight: 25,
    buyboxEligibilityWeight: 20,
    dataCompletenessWeight: 15
  };

  /**
   * Select the best ASIN from multiple candidates using scoring algorithm
   */
  async selectBestASIN(candidates: ASINCandidate[]): Promise<ASINCandidate | null> {
    if (!candidates || candidates.length === 0) {
      return null;
    }

    if (candidates.length === 1) {
      return candidates[0];
    }

    // Score each candidate
    const scoredCandidates = candidates.map(candidate => ({
      ...candidate,
      score: this.calculateASINScore(candidate, candidates)
    }));

    // Sort by score (highest first)
    scoredCandidates.sort((a, b) => (b.score || 0) - (a.score || 0));

    return scoredCandidates[0];
  }

  /**
   * Calculate score for an ASIN candidate (0-100 scale)
   */
  private calculateASINScore(candidate: ASINCandidate, allCandidates: ASINCandidate[]): number {
    let score = 0;

    // 1. Sales Rank Score (40% weight)
    score += this.calculateSalesRankScore(candidate, allCandidates) * (this.criteria.salesRankWeight / 100);

    // 2. Price Competitiveness Score (25% weight)
    score += this.calculatePriceScore(candidate, allCandidates) * (this.criteria.priceCompetitivenessWeight / 100);

    // 3. Buy Box Eligibility Score (20% weight)
    score += this.calculateBuyboxScore(candidate) * (this.criteria.buyboxEligibilityWeight / 100);

    // 4. Data Completeness Score (15% weight)
    score += this.calculateCompletenessScore(candidate) * (this.criteria.dataCompletenessWeight / 100);

    return Math.round(score * 100) / 100; // Round to 2 decimal places
  }

  /**
   * Score based on sales rank (lower rank is better)
   */
  private calculateSalesRankScore(candidate: ASINCandidate, allCandidates: ASINCandidate[]): number {
    if (!candidate.salesRank) return 0;

    const ranksWithValues = allCandidates.filter(c => c.salesRank).map(c => c.salesRank!);
    if (ranksWithValues.length === 0) return 0;

    const bestRank = Math.min(...ranksWithValues);
    const worstRank = Math.max(...ranksWithValues);

    if (bestRank === worstRank) return 100;

    // Invert the score since lower rank is better
    return 100 - ((candidate.salesRank - bestRank) / (worstRank - bestRank)) * 100;
  }

  /**
   * Score based on price competitiveness
   */
  private calculatePriceScore(candidate: ASINCandidate, allCandidates: ASINCandidate[]): number {
    if (!candidate.price) return 0;

    const pricesWithValues = allCandidates.filter(c => c.price).map(c => c.price!);
    if (pricesWithValues.length === 0) return 0;

    const avgPrice = pricesWithValues.reduce((sum, price) => sum + price, 0) / pricesWithValues.length;
    const minPrice = Math.min(...pricesWithValues);
    const maxPrice = Math.max(...pricesWithValues);

    // Prefer prices close to average, not necessarily the cheapest
    const deviationFromAvg = Math.abs(candidate.price - avgPrice);
    const maxDeviation = Math.max(Math.abs(maxPrice - avgPrice), Math.abs(minPrice - avgPrice));

    if (maxDeviation === 0) return 100;

    return 100 - (deviationFromAvg / maxDeviation) * 100;
  }

  /**
   * Score based on Buy Box eligibility and holder
   */
  private calculateBuyboxScore(candidate: ASINCandidate): number {
    let score = 0;

    // Buy Box eligibility
    if (candidate.isBuyboxEligible) {
      score += 50;
    }

    // Buy Box holder (Amazon is preferred)
    if (candidate.buyboxHolder === 'Amazon') {
      score += 50;
    } else if (candidate.buyboxHolder && candidate.buyboxHolder !== 'None') {
      score += 25;
    }

    return score;
  }

  /**
   * Score based on data completeness
   */
  private calculateCompletenessScore(candidate: ASINCandidate): number {
    let score = 0;
    let maxScore = 0;

    // Title
    maxScore += 25;
    if (candidate.title && candidate.title.length > 10) {
      score += 25;
    }

    // Brand
    maxScore += 20;
    if (candidate.brand) {
      score += 20;
    }

    // Image
    maxScore += 25;
    if (candidate.imageUrl) {
      score += 25;
    }

    // Condition
    maxScore += 15;
    if (candidate.condition === 'New') {
      score += 15;
    } else if (candidate.condition) {
      score += 7;
    }

    // Sellers count
    maxScore += 15;
    if (candidate.sellersCount && candidate.sellersCount > 0) {
      score += 15;
    }

    return maxScore > 0 ? (score / maxScore) * 100 : 0;
  }

  /**
   * Get detailed scoring breakdown for debugging
   */
  getScoreBreakdown(candidate: ASINCandidate, allCandidates: ASINCandidate[]): {
    totalScore: number;
    salesRankScore: number;
    priceScore: number;
    buyboxScore: number;
    completenessScore: number;
  } {
    return {
      totalScore: this.calculateASINScore(candidate, allCandidates),
      salesRankScore: this.calculateSalesRankScore(candidate, allCandidates),
      priceScore: this.calculatePriceScore(candidate, allCandidates),
      buyboxScore: this.calculateBuyboxScore(candidate),
      completenessScore: this.calculateCompletenessScore(candidate)
    };
  }
}

export const bestASINSelector = new BestASINSelector();