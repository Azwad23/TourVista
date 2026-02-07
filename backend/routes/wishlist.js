const express = require('express');
const pool = require('../config/db');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// All wishlist routes require authentication
router.use(authenticate);

// ==================== GET USER'S WISHLIST ====================
router.get('/', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT w.id AS wishlist_id, w.created_at AS added_at, e.*
       FROM wishlists w
       JOIN events e ON w.event_id = e.id
       WHERE w.user_id = ?
       ORDER BY w.created_at DESC`,
      [req.user.id]
    );
    res.json({ wishlist: rows });
  } catch (err) {
    console.error('Get wishlist error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ==================== CHECK IF EVENT IS IN WISHLIST ====================
router.get('/check/:eventId', async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT id FROM wishlists WHERE user_id = ? AND event_id = ?',
      [req.user.id, req.params.eventId]
    );
    res.json({ inWishlist: rows.length > 0 });
  } catch (err) {
    console.error('Check wishlist error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ==================== CHECK MULTIPLE EVENTS AT ONCE ====================
router.post('/check-bulk', async (req, res) => {
  try {
    const { eventIds } = req.body;
    if (!eventIds || !Array.isArray(eventIds) || eventIds.length === 0) {
      return res.json({ wishlisted: [] });
    }
    const placeholders = eventIds.map(() => '?').join(',');
    const [rows] = await pool.query(
      `SELECT event_id FROM wishlists WHERE user_id = ? AND event_id IN (${placeholders})`,
      [req.user.id, ...eventIds]
    );
    res.json({ wishlisted: rows.map(r => r.event_id) });
  } catch (err) {
    console.error('Bulk check wishlist error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ==================== ADD TO WISHLIST ====================
router.post('/:eventId', async (req, res) => {
  try {
    // Verify event exists
    const [events] = await pool.query('SELECT id FROM events WHERE id = ?', [req.params.eventId]);
    if (events.length === 0) {
      return res.status(404).json({ error: 'Event not found' });
    }

    await pool.query(
      'INSERT IGNORE INTO wishlists (user_id, event_id) VALUES (?, ?)',
      [req.user.id, req.params.eventId]
    );
    res.json({ message: 'Added to wishlist', inWishlist: true });
  } catch (err) {
    console.error('Add to wishlist error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ==================== REMOVE FROM WISHLIST ====================
router.delete('/:eventId', async (req, res) => {
  try {
    await pool.query(
      'DELETE FROM wishlists WHERE user_id = ? AND event_id = ?',
      [req.user.id, req.params.eventId]
    );
    res.json({ message: 'Removed from wishlist', inWishlist: false });
  } catch (err) {
    console.error('Remove from wishlist error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ==================== TOGGLE WISHLIST ====================
router.post('/:eventId/toggle', async (req, res) => {
  try {
    // Check if already wishlisted
    const [existing] = await pool.query(
      'SELECT id FROM wishlists WHERE user_id = ? AND event_id = ?',
      [req.user.id, req.params.eventId]
    );

    if (existing.length > 0) {
      // Remove
      await pool.query(
        'DELETE FROM wishlists WHERE user_id = ? AND event_id = ?',
        [req.user.id, req.params.eventId]
      );
      res.json({ message: 'Removed from wishlist', inWishlist: false });
    } else {
      // Verify event exists
      const [events] = await pool.query('SELECT id FROM events WHERE id = ?', [req.params.eventId]);
      if (events.length === 0) {
        return res.status(404).json({ error: 'Event not found' });
      }
      // Add
      await pool.query(
        'INSERT INTO wishlists (user_id, event_id) VALUES (?, ?)',
        [req.user.id, req.params.eventId]
      );
      res.json({ message: 'Added to wishlist', inWishlist: true });
    }
  } catch (err) {
    console.error('Toggle wishlist error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ==================== CLEAR ALL WISHLIST ====================
router.delete('/', async (req, res) => {
  try {
    await pool.query('DELETE FROM wishlists WHERE user_id = ?', [req.user.id]);
    res.json({ message: 'Wishlist cleared' });
  } catch (err) {
    console.error('Clear wishlist error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ==================== GET WISHLIST COUNT ====================
router.get('/count', async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT COUNT(*) AS count FROM wishlists WHERE user_id = ?',
      [req.user.id]
    );
    res.json({ count: rows[0].count });
  } catch (err) {
    console.error('Wishlist count error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
