import { Router } from 'express';
import { pool } from '../db';

const router = Router();

// Log audit trail entry
router.post('/log', async (req, res) => {
  try {
    const {
      userId,
      actionType,
      entityType,
      entityId,
      oldValues,
      newValues,
      reason
    } = req.body;

    const ipAddress = req.ip || req.connection.remoteAddress || 'unknown';
    const userAgent = req.get('User-Agent') || 'unknown';

    const query = `
      INSERT INTO audit_trail 
      (user_id, action_type, entity_type, entity_id, old_values, new_values, reason, ip_address, user_agent)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `;

    const result = await pool.query(query, [
      userId,
      actionType,
      entityType,
      entityId,
      oldValues ? JSON.stringify(oldValues) : null,
      newValues ? JSON.stringify(newValues) : null,
      reason,
      ipAddress,
      userAgent
    ]);

    res.json({
      success: true,
      audit: result.rows[0]
    });
  } catch (error) {
    console.error('Error logging audit trail:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to log audit trail entry'
    });
  }
});

// Get audit trail for entity
router.get('/entity/:entityType/:entityId', async (req, res) => {
  try {
    const { entityType, entityId } = req.params;
    const { limit = 50, offset = 0 } = req.query;

    const query = `
      SELECT * FROM audit_trail 
      WHERE entity_type = $1 AND entity_id = $2
      ORDER BY created_at DESC
      LIMIT $3 OFFSET $4
    `;

    const result = await pool.query(query, [entityType, entityId, limit, offset]);

    res.json({
      success: true,
      auditTrail: result.rows,
      total: result.rows.length
    });
  } catch (error) {
    console.error('Error fetching audit trail:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch audit trail'
    });
  }
});

// Get recent audit activities
router.get('/recent', async (req, res) => {
  try {
    const { limit = 20, userId } = req.query;

    let query = `
      SELECT at.*, 
        CASE 
          WHEN at.entity_type = 'product' THEN p.name
          WHEN at.entity_type = 'supplier' THEN s.name
          ELSE at.entity_id
        END as entity_name
      FROM audit_trail at
      LEFT JOIN products p ON at.entity_type = 'product' AND at.entity_id = p.id::text
      LEFT JOIN suppliers s ON at.entity_type = 'supplier' AND at.entity_id = s.id::text
    `;

    const params = [];
    if (userId) {
      query += ' WHERE at.user_id = $1';
      params.push(userId);
    }

    query += ' ORDER BY at.created_at DESC LIMIT $' + (params.length + 1);
    params.push(limit);

    const result = await pool.query(query, params);

    res.json({
      success: true,
      activities: result.rows
    });
  } catch (error) {
    console.error('Error fetching recent activities:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch recent activities'
    });
  }
});

export default router;