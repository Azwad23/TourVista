const express = require('express');
const pool = require('../config/db');
const { authenticate, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// ==================== SUBMIT PAYMENT (Participant) ====================
// User pays manually via bKash/Nagad app, then submits their TrxID here
router.post('/submit', authenticate, async (req, res) => {
  try {
    const { event_id, payment_method, transaction_id, phone_number, notes } = req.body;

    if (!event_id || !payment_method || !transaction_id) {
      return res.status(400).json({ error: 'Event ID, payment method, and transaction ID are required' });
    }

    if (!['bkash', 'nagad'].includes(payment_method)) {
      return res.status(400).json({ error: 'Payment method must be bkash or nagad' });
    }

    const trxId = transaction_id.trim();
    if (trxId.length < 5) {
      return res.status(400).json({ error: 'Please enter a valid Transaction ID' });
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

    // Check if TrxID already used
    const [existingTrx] = await pool.query(
      'SELECT id FROM payments WHERE transaction_id = ?',
      [trxId]
    );
    if (existingTrx.length > 0) {
      return res.status(400).json({ error: 'This Transaction ID has already been used' });
    }

    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      // Determine registration status
      let regStatus = 'pending';
      if (event.current_participants >= event.participant_limit) {
        regStatus = 'waitlisted';
      }

      // Create registration with payment_status = 'unpaid' (pending admin verification)
      const [regResult] = await connection.query(
        'INSERT INTO registrations (event_id, user_id, status, payment_status, notes) VALUES (?, ?, ?, ?, ?)',
        [event_id, req.user.id, regStatus, 'unpaid', notes || null]
      );

      // Create payment record with status = 'pending' (awaiting admin verification)
      const [payResult] = await connection.query(
        'INSERT INTO payments (registration_id, event_id, user_id, amount, payment_method, phone_number, transaction_id, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [regResult.insertId, event_id, req.user.id, parseFloat(event.cost), payment_method, phone_number || null, trxId, 'pending']
      );

      await connection.commit();

      res.status(201).json({
        message: 'Payment submitted successfully! Admin will verify your transaction.',
        payment: {
          id: payResult.insertId,
          transaction_id: trxId,
          payment_method,
          amount: event.cost,
          status: 'pending'
        },
        registration: {
          id: regResult.insertId,
          status: regStatus
        }
      });
    } catch (err) {
      await connection.rollback();
      throw err;
    } finally {
      connection.release();
    }
  } catch (err) {
    console.error('Payment submission error:', err);
    res.status(500).json({ error: err.message || 'Failed to submit payment' });
  }
});

// ==================== GET MY PAYMENTS (Participant) ====================
router.get('/my', authenticate, async (req, res) => {
  try {
    const [payments] = await pool.query(
      `SELECT p.*, e.title as event_title, e.start_date, e.destination
       FROM payments p
       JOIN events e ON p.event_id = e.id
       WHERE p.user_id = ?
       ORDER BY p.paid_at DESC`,
      [req.user.id]
    );
    res.json({ payments });
  } catch (err) {
    console.error('Get my payments error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ==================== GET ALL PAYMENTS (Admin) ====================
router.get('/all', authenticate, requireAdmin, async (req, res) => {
  try {
    const { status, event_id } = req.query;

    let query = `
      SELECT p.*, e.title as event_title, e.category,
             u.first_name, u.last_name, u.email, u.avatar, u.phone as user_phone
      FROM payments p
      JOIN events e ON p.event_id = e.id
      JOIN users u ON p.user_id = u.id
      WHERE 1=1
    `;
    const params = [];

    if (status && status !== 'all') {
      query += ' AND p.status = ?';
      params.push(status);
    }
    if (event_id) {
      query += ' AND p.event_id = ?';
      params.push(event_id);
    }

    query += ' ORDER BY p.paid_at DESC';

    const [payments] = await pool.query(query, params);

    // Get counts
    const [counts] = await pool.query(
      `SELECT
        COUNT(*) as total,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as verified,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as rejected
      FROM payments`
    );

    res.json({ payments, counts: counts[0] });
  } catch (err) {
    console.error('Get all payments error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ==================== VERIFY PAYMENT (Admin) ====================
router.put('/:id/verify', authenticate, requireAdmin, async (req, res) => {
  try {
    const { admin_notes } = req.body;

    const [payments] = await pool.query('SELECT * FROM payments WHERE id = ?', [req.params.id]);
    if (payments.length === 0) {
      return res.status(404).json({ error: 'Payment not found' });
    }

    const payment = payments[0];
    if (payment.status === 'completed') {
      return res.status(400).json({ error: 'Payment already verified' });
    }

    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      // Update payment status to completed
      await connection.query(
        "UPDATE payments SET status = 'completed', admin_notes = ? WHERE id = ?",
        [admin_notes || 'Verified by admin', req.params.id]
      );

      // Update registration payment_status to paid
      if (payment.registration_id) {
        await connection.query(
          "UPDATE registrations SET payment_status = 'paid' WHERE id = ?",
          [payment.registration_id]
        );
      }

      await connection.commit();
      res.json({ message: 'Payment verified successfully' });
    } catch (err) {
      await connection.rollback();
      throw err;
    } finally {
      connection.release();
    }
  } catch (err) {
    console.error('Verify payment error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ==================== REJECT PAYMENT (Admin) ====================
router.put('/:id/reject', authenticate, requireAdmin, async (req, res) => {
  try {
    const { admin_notes } = req.body;

    const [payments] = await pool.query('SELECT * FROM payments WHERE id = ?', [req.params.id]);
    if (payments.length === 0) {
      return res.status(404).json({ error: 'Payment not found' });
    }

    const payment = payments[0];

    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      // Update payment status to failed (rejected)
      await connection.query(
        "UPDATE payments SET status = 'failed', admin_notes = ? WHERE id = ?",
        [admin_notes || 'Rejected by admin', req.params.id]
      );

      // Reject the registration too
      if (payment.registration_id) {
        await connection.query(
          "UPDATE registrations SET status = 'rejected', payment_status = 'unpaid' WHERE id = ?",
          [payment.registration_id]
        );
      }

      await connection.commit();
      res.json({ message: 'Payment rejected' });
    } catch (err) {
      await connection.rollback();
      throw err;
    } finally {
      connection.release();
    }
  } catch (err) {
    console.error('Reject payment error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ==================== GET SINGLE PAYMENT (Admin) ====================
router.get('/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    const [payments] = await pool.query(
      `SELECT p.*, e.title as event_title, u.first_name, u.last_name, u.email
       FROM payments p
       JOIN events e ON p.event_id = e.id
       JOIN users u ON p.user_id = u.id
       WHERE p.id = ?`,
      [req.params.id]
    );
    if (payments.length === 0) {
      return res.status(404).json({ error: 'Payment not found' });
    }
    res.json({ payment: payments[0] });
  } catch (err) {
    console.error('Get payment error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
