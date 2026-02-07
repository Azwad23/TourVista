const express = require('express');
const pool = require('../config/db');
const { authenticate, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// ==================== REGISTER FOR EVENT (Participant) ====================
router.post('/', authenticate, async (req, res) => {
  try {
    const { event_id, emergency_contact, notes } = req.body;

    if (!event_id) {
      return res.status(400).json({ error: 'Event ID is required' });
    }

    // Check event exists and is open
    const [events] = await pool.query('SELECT * FROM events WHERE id = ?', [event_id]);
    if (events.length === 0) {
      return res.status(404).json({ error: 'Event not found' });
    }

    const event = events[0];
    if (event.status === 'closed' || event.status === 'cancelled') {
      return res.status(400).json({ error: 'Event is not accepting registrations' });
    }

    // Check if already registered
    const [existingReg] = await pool.query(
      'SELECT id FROM registrations WHERE event_id = ? AND user_id = ?',
      [event_id, req.user.id]
    );
    if (existingReg.length > 0) {
      return res.status(400).json({ error: 'You are already registered for this event' });
    }

    // Determine status based on availability
    let regStatus = 'pending';
    if (event.current_participants >= event.participant_limit) {
      regStatus = 'waitlisted';
    }

    const [result] = await pool.query(
      'INSERT INTO registrations (event_id, user_id, status, emergency_contact, notes) VALUES (?, ?, ?, ?, ?)',
      [event_id, req.user.id, regStatus, emergency_contact || null, notes || null]
    );

    res.status(201).json({
      message: regStatus === 'waitlisted' ? 'Added to waitlist' : 'Registration submitted for approval',
      registration: {
        id: result.insertId,
        event_id,
        user_id: req.user.id,
        status: regStatus
      }
    });
  } catch (err) {
    console.error('Register for event error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ==================== CHECK REGISTRATION STATUS FOR A SPECIFIC EVENT ====================
router.get('/check/:eventId', authenticate, async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT id, status, payment_status, registered_at FROM registrations WHERE event_id = ? AND user_id = ?',
      [req.params.eventId, req.user.id]
    );
    if (rows.length === 0) {
      return res.json({ registered: false });
    }
    res.json({ registered: true, registration: rows[0] });
  } catch (err) {
    console.error('Check registration error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ==================== GET MY REGISTRATIONS (Participant) ====================
router.get('/my', authenticate, async (req, res) => {
  try {
    const { status } = req.query;

    let query = `
      SELECT r.*, e.title as event_title, e.start_date, e.end_date, e.cost,
             e.destination, e.category, e.gradient, e.icon, e.image_url, e.status as event_status
      FROM registrations r
      JOIN events e ON r.event_id = e.id
      WHERE r.user_id = ?
    `;
    const params = [req.user.id];

    if (status && status !== 'all') {
      query += ' AND r.status = ?';
      params.push(status);
    }

    query += ' ORDER BY r.registered_at DESC';

    const [registrations] = await pool.query(query, params);

    // Get counts
    const [counts] = await pool.query(
      `SELECT
        COUNT(*) as total,
        SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) as approved,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) as rejected
      FROM registrations WHERE user_id = ?`,
      [req.user.id]
    );

    res.json({ registrations, counts: counts[0] });
  } catch (err) {
    console.error('Get my registrations error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ==================== GET ALL REGISTRATIONS (Admin) ====================
router.get('/all', authenticate, requireAdmin, async (req, res) => {
  try {
    const { status, event_id } = req.query;

    let query = `
      SELECT r.*, e.title as event_title, e.category,
             u.first_name, u.last_name, u.email, u.avatar
      FROM registrations r
      JOIN events e ON r.event_id = e.id
      JOIN users u ON r.user_id = u.id
      WHERE 1=1
    `;
    const params = [];

    if (status && status !== 'all') {
      query += ' AND r.status = ?';
      params.push(status);
    }
    if (event_id) {
      query += ' AND r.event_id = ?';
      params.push(event_id);
    }

    query += ' ORDER BY r.registered_at DESC';

    const [registrations] = await pool.query(query, params);

    // Get counts
    const [counts] = await pool.query(
      `SELECT
        COUNT(*) as total,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) as approved,
        SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) as rejected
      FROM registrations`
    );

    res.json({ registrations, counts: counts[0] });
  } catch (err) {
    console.error('Get all registrations error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ==================== APPROVE REGISTRATION (Admin) ====================
router.put('/:id/approve', authenticate, requireAdmin, async (req, res) => {
  try {
    const [regs] = await pool.query('SELECT * FROM registrations WHERE id = ?', [req.params.id]);
    if (regs.length === 0) {
      return res.status(404).json({ error: 'Registration not found' });
    }

    await pool.query("UPDATE registrations SET status = 'approved' WHERE id = ?", [req.params.id]);

    // Update event participant count
    await pool.query(
      'UPDATE events SET current_participants = current_participants + 1 WHERE id = ?',
      [regs[0].event_id]
    );

    res.json({ message: 'Registration approved' });
  } catch (err) {
    console.error('Approve error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ==================== REJECT REGISTRATION (Admin) ====================
router.put('/:id/reject', authenticate, requireAdmin, async (req, res) => {
  try {
    const [regs] = await pool.query('SELECT * FROM registrations WHERE id = ?', [req.params.id]);
    if (regs.length === 0) {
      return res.status(404).json({ error: 'Registration not found' });
    }

    const wasApproved = regs[0].status === 'approved';

    await pool.query("UPDATE registrations SET status = 'rejected' WHERE id = ?", [req.params.id]);

    // Decrement participant count if was approved
    if (wasApproved) {
      await pool.query(
        'UPDATE events SET current_participants = GREATEST(current_participants - 1, 0) WHERE id = ?',
        [regs[0].event_id]
      );
    }

    res.json({ message: 'Registration rejected' });
  } catch (err) {
    console.error('Reject error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ==================== DELETE REGISTRATION (User cancels) ====================
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const [regs] = await pool.query('SELECT * FROM registrations WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
    if (regs.length === 0) {
      return res.status(404).json({ error: 'Registration not found' });
    }

    if (regs[0].status === 'approved') {
      await pool.query(
        'UPDATE events SET current_participants = GREATEST(current_participants - 1, 0) WHERE id = ?',
        [regs[0].event_id]
      );
    }

    await pool.query('DELETE FROM registrations WHERE id = ?', [req.params.id]);
    res.json({ message: 'Registration cancelled' });
  } catch (err) {
    console.error('Delete registration error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
