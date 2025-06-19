/**
 * ASIN Change Tracking API Routes
 * 
 * Tracks changes in ASIN data over time for monitoring Amazon updates
 */

import { Router } from 'express';
import { pool } from '../db';

const router = Router();

/**
 * POST /asin-tracking/capture-snapshot
 * Capture current state of ASIN data for change tracking
 */
router.post('/capture-snapshot', async (req, res) => {
  try {
    const { asins } = req.body;

    if (!asins || !Array.isArray(asins)) {
      return res.status(400).json({
        success: false,
        error: 'ASINs array is required'
      });
    }

    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');

      let snapshotsCreated = 0;

      for (const asin of asins) {
        // Get current ASIN data
        const currentData = await client.query(`
          SELECT * FROM amazon_catalog_data WHERE asin = $1
        `, [asin]);

        if (currentData.rows.length > 0) {
          const data = currentData.rows[0];

          // Insert snapshot
          await client.query(`
            INSERT INTO asin_change_tracking (
              asin,
              snapshot_date,
              title,
              brand,
              current_price,
              list_price,
              sales_rank,
              category_rank,
              main_category,
              buybox_holder,
              is_buybox_eligible,
              condition,
              seller_count,
              review_count,
              average_rating,
              image_url,
              description,
              availability_status
            ) VALUES ($1, NOW(), $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
            ON CONFLICT (asin, snapshot_date::date) DO UPDATE SET
              title = EXCLUDED.title,
              current_price = EXCLUDED.current_price,
              sales_rank = EXCLUDED.sales_rank,
              updated_at = NOW()
          `, [
            asin,
            data.title,
            data.brand,
            data.current_price,
            data.list_price,
            data.sales_rank,
            data.category_rank,
            data.main_category,
            data.buybox_holder,
            data.is_buybox_eligible,
            data.condition,
            data.seller_count,
            data.review_count,
            data.average_rating,
            data.image_url,
            data.description,
            data.availability_status
          ]);

          snapshotsCreated++;
        }
      }

      await client.query('COMMIT');

      res.json({
        success: true,
        message: `Captured ${snapshotsCreated} ASIN snapshots`,
        snapshotsCreated
      });

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

  } catch (error) {
    console.error('Error capturing ASIN snapshots:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to capture ASIN snapshots'
    });
  }
});

/**
 * GET /asin-tracking/changes/:asin
 * Get change history for a specific ASIN
 */
router.get('/changes/:asin', async (req, res) => {
  try {
    const { asin } = req.params;
    const { days = 30 } = req.query;

    const result = await pool.query(`
      SELECT 
        snapshot_date,
        title,
        current_price,
        list_price,
        sales_rank,
        buybox_holder,
        seller_count,
        review_count,
        average_rating,
        availability_status,
        LAG(current_price) OVER (ORDER BY snapshot_date) as prev_price,
        LAG(sales_rank) OVER (ORDER BY snapshot_date) as prev_rank,
        LAG(seller_count) OVER (ORDER BY snapshot_date) as prev_seller_count
      FROM asin_change_tracking
      WHERE asin = $1 
        AND snapshot_date >= NOW() - INTERVAL '${parseInt(days as string)} days'
      ORDER BY snapshot_date DESC
    `, [asin]);

    // Calculate changes
    const changes = result.rows.map((row, index) => {
      const changes: any = {
        date: row.snapshot_date,
        data: {
          title: row.title,
          currentPrice: row.current_price,
          listPrice: row.list_price,
          salesRank: row.sales_rank,
          buyboxHolder: row.buybox_holder,
          sellerCount: row.seller_count,
          reviewCount: row.review_count,
          averageRating: row.average_rating,
          availabilityStatus: row.availability_status
        },
        changes: []
      };

      if (row.prev_price && row.current_price !== row.prev_price) {
        changes.changes.push({
          field: 'price',
          oldValue: row.prev_price,
          newValue: row.current_price,
          changePercent: ((row.current_price - row.prev_price) / row.prev_price * 100).toFixed(2)
        });
      }

      if (row.prev_rank && row.sales_rank !== row.prev_rank) {
        changes.changes.push({
          field: 'salesRank',
          oldValue: row.prev_rank,
          newValue: row.sales_rank,
          changePercent: ((row.sales_rank - row.prev_rank) / row.prev_rank * 100).toFixed(2)
        });
      }

      if (row.prev_seller_count && row.seller_count !== row.prev_seller_count) {
        changes.changes.push({
          field: 'sellerCount',
          oldValue: row.prev_seller_count,
          newValue: row.seller_count,
          changePercent: ((row.seller_count - row.prev_seller_count) / row.prev_seller_count * 100).toFixed(2)
        });
      }

      return changes;
    });

    res.json({
      success: true,
      asin,
      changeHistory: changes,
      totalSnapshots: result.rows.length
    });

  } catch (error) {
    console.error('Error fetching ASIN changes:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch ASIN changes'
    });
  }
});

/**
 * GET /asin-tracking/significant-changes
 * Get ASINs with significant changes in the last period
 */
router.get('/significant-changes', async (req, res) => {
  try {
    const { days = 7, priceChangeThreshold = 10, rankChangeThreshold = 20 } = req.query;

    const result = await pool.query(`
      WITH recent_changes AS (
        SELECT 
          asin,
          current_price,
          sales_rank,
          seller_count,
          snapshot_date,
          LAG(current_price) OVER (PARTITION BY asin ORDER BY snapshot_date) as prev_price,
          LAG(sales_rank) OVER (PARTITION BY asin ORDER BY snapshot_date) as prev_rank,
          LAG(seller_count) OVER (PARTITION BY asin ORDER BY snapshot_date) as prev_seller_count
        FROM asin_change_tracking
        WHERE snapshot_date >= NOW() - INTERVAL '${parseInt(days as string)} days'
      ),
      significant_price_changes AS (
        SELECT 
          asin,
          snapshot_date,
          current_price,
          prev_price,
          ABS((current_price - prev_price) / prev_price * 100) as price_change_percent
        FROM recent_changes
        WHERE prev_price IS NOT NULL 
          AND ABS((current_price - prev_price) / prev_price * 100) >= ${parseFloat(priceChangeThreshold as string)}
      ),
      significant_rank_changes AS (
        SELECT 
          asin,
          snapshot_date,
          sales_rank,
          prev_rank,
          ABS((sales_rank - prev_rank) / prev_rank * 100) as rank_change_percent
        FROM recent_changes
        WHERE prev_rank IS NOT NULL 
          AND ABS((sales_rank - prev_rank) / prev_rank * 100) >= ${parseFloat(rankChangeThreshold as string)}
      )
      SELECT DISTINCT
        asin,
        'price_change' as change_type,
        price_change_percent as change_percent,
        current_price as new_value,
        prev_price as old_value
      FROM significant_price_changes
      UNION ALL
      SELECT DISTINCT
        asin,
        'rank_change' as change_type,
        rank_change_percent as change_percent,
        sales_rank as new_value,
        prev_rank as old_value
      FROM significant_rank_changes
      ORDER BY change_percent DESC
    `);

    // Group by ASIN
    const changesByAsin: Record<string, any> = {};
    
    result.rows.forEach(row => {
      if (!changesByAsin[row.asin]) {
        changesByAsin[row.asin] = {
          asin: row.asin,
          changes: []
        };
      }
      changesByAsin[row.asin].changes.push({
        type: row.change_type,
        changePercent: row.change_percent,
        newValue: row.new_value,
        oldValue: row.old_value
      });
    });

    res.json({
      success: true,
      significantChanges: Object.values(changesByAsin),
      totalAsinsWithChanges: Object.keys(changesByAsin).length,
      thresholds: {
        priceChangeThreshold: parseFloat(priceChangeThreshold as string),
        rankChangeThreshold: parseFloat(rankChangeThreshold as string),
        days: parseInt(days as string)
      }
    });

  } catch (error) {
    console.error('Error fetching significant changes:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch significant changes'
    });
  }
});

export default router;