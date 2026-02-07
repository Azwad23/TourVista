const express = require('express');
const pool = require('../config/db');
const { authenticate, requireAdmin } = require('../middleware/auth');
const bkash = require('../services/bkash');
const nagad = require('../services/nagad');

const router = express.Router();

// In-memory store for pending payment sessions (use Redis in production)
const pendingPayments = new Map();

// Simulation mode: skip real API calls in development
const SIMULATION_MODE = process.env.PAYMENT_SIMULATION === 'true';

// ==================== INITIATE PAYMENT (Participant) ====================
// Frontend calls this → gets a redirect URL → user pays on bKash/Nagad page
router.post('/initiate', authenticate, async (req, res) => {
  try {
    const { event_id, payment_method, emergency_contact, notes } = req.body;

    if (!event_id || !payment_method) {
      return res.status(400).json({ error: 'Event ID and payment method are required' });
    }

    if (!['bkash', 'nagad'].includes(payment_method)) {
      return res.status(400).json({ error: 'Payment method must be bkash or nagad' });
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

    const amount = parseFloat(event.cost);
    const invoiceNumber = `TV-${event_id}-${req.user.id}-${Date.now()}`;

    // ── SIMULATION MODE ── redirect to local sim page instead of real gateway
    if (SIMULATION_MODE) {
      const simPaymentId = 'SIM-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8);

      pendingPayments.set(simPaymentId, {
        event_id,
        user_id: req.user.id,
        amount,
        payment_method,
        invoiceNumber,
        emergency_contact: emergency_contact || null,
        notes: notes || null,
        created_at: Date.now()
      });

      const simParams = new URLSearchParams({
        method: payment_method,
        paymentId: simPaymentId,
        orderId: simPaymentId,
        amount: String(amount),
        invoice: invoiceNumber
      });

      return res.json({
        payment_method,
        paymentID: simPaymentId,
        redirectURL: `/payment-sim.html?${simParams.toString()}`
      });
    }

    if (payment_method === 'bkash') {
      // ── bKash Checkout (URL) flow ──
      const callbackURL = process.env.BKASH_CALLBACK_URL;
      const result = await bkash.createPayment({
        amount,
        invoiceNumber,
        callbackURL,
        payerReference: ' '
      });

      // Store session data so callback can complete registration
      pendingPayments.set(result.paymentID, {
        event_id,
        user_id: req.user.id,
        amount,
        payment_method: 'bkash',
        invoiceNumber,
        emergency_contact: emergency_contact || null,
        notes: notes || null,
        created_at: Date.now()
      });

      return res.json({
        payment_method: 'bkash',
        paymentID: result.paymentID,
        redirectURL: result.bkashURL
      });

    } else {
      // ── Nagad flow ──
      const orderId = nagad.generateOrderId();

      // Step 1: Initialize
      const initResult = await nagad.initializePayment(orderId);

      if (initResult.reason) {
        throw new Error(initResult.message || 'Nagad initialization failed');
      }

      // Decrypt the sensitive data from response
      let sensitiveData;
      try {
        sensitiveData = JSON.parse(
          Buffer.from(initResult.sensitiveData || '', 'base64').toString('utf8')
        );
      } catch (e) {
        // If sandbox returns plain JSON
        sensitiveData = initResult.sensitiveData || initResult;
      }

      const paymentReferenceId = sensitiveData.paymentReferenceId || initResult.paymentReferenceId;
      const challenge = sensitiveData.challenge || initResult.challenge;

      // Step 2: Complete (create payment)
      const callbackURL = process.env.NAGAD_CALLBACK_URL;
      const completeResult = await nagad.createPayment({
        orderId,
        amount,
        paymentReferenceId,
        challenge,
        callbackURL
      });

      if (!completeResult.callBackUrl) {
        throw new Error(completeResult.message || 'Nagad payment creation failed');
      }

      // Store session data
      pendingPayments.set(orderId, {
        event_id,
        user_id: req.user.id,
        amount,
        payment_method: 'nagad',
        invoiceNumber,
        orderId,
        emergency_contact: emergency_contact || null,
        notes: notes || null,
        created_at: Date.now()
      });

      return res.json({
        payment_method: 'nagad',
        orderId,
        redirectURL: completeResult.callBackUrl
      });
    }

  } catch (err) {
    console.error('Payment initiation error:', err);
    res.status(500).json({ error: err.message || 'Failed to initiate payment. Please try again.' });
  }
});

// ==================== BKASH CALLBACK ====================
// bKash redirects user here after payment
router.get('/bkash/callback', async (req, res) => {
  const { paymentID, status } = req.query;

  if (!paymentID) {
    return res.redirect('/payment-result.html?status=error&message=Missing+payment+ID');
  }

  const session = pendingPayments.get(paymentID);
  if (!session) {
    return res.redirect('/payment-result.html?status=error&message=Payment+session+expired');
  }

  if (status === 'cancel') {
    pendingPayments.delete(paymentID);
    return res.redirect('/payment-result.html?status=cancelled');
  }

  if (status === 'failure') {
    pendingPayments.delete(paymentID);
    return res.redirect('/payment-result.html?status=failed&message=bKash+payment+failed');
  }

  // status === 'success' → Execute the payment
  const connection = await pool.getConnection();
  try {
    // In simulation mode or for simulated paymentIDs, skip the real bKash execute call
    let execResult;
    if (SIMULATION_MODE || paymentID.startsWith('SIM-')) {
      execResult = {
        paymentID,
        trxID: 'SIMTRX' + Date.now(),
        transactionStatus: 'Completed',
        amount: String(session.amount),
        customerMsisdn: '01XXXXXXXXX'
      };
    } else {
      execResult = await bkash.executePayment(paymentID);
    }

    await connection.beginTransaction();

    // Determine registration status
    const [events] = await connection.query('SELECT * FROM events WHERE id = ?', [session.event_id]);
    const event = events[0];
    let regStatus = 'pending';
    if (event.current_participants >= event.participant_limit) {
      regStatus = 'waitlisted';
    }

    // Create registration
    const [regResult] = await connection.query(
      'INSERT INTO registrations (event_id, user_id, status, payment_status, emergency_contact, notes) VALUES (?, ?, ?, ?, ?, ?)',
      [session.event_id, session.user_id, regStatus, 'paid', session.emergency_contact, session.notes]
    );

    // Create payment record
    await connection.query(
      'INSERT INTO payments (registration_id, event_id, user_id, amount, payment_method, phone_number, transaction_id, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [regResult.insertId, session.event_id, session.user_id, session.amount, 'bkash',
       execResult.customerMsisdn || '', execResult.trxID || paymentID, 'completed']
    );

    await connection.commit();
    pendingPayments.delete(paymentID);

    const params = new URLSearchParams({
      status: 'success',
      method: 'bkash',
      trxID: execResult.trxID || paymentID,
      amount: String(session.amount),
      eventId: String(session.event_id)
    });

    return res.redirect(`/payment-result.html?${params.toString()}`);

  } catch (err) {
    await connection.rollback();
    console.error('bKash callback execution error:', err);
    pendingPayments.delete(paymentID);
    return res.redirect('/payment-result.html?status=error&message=' + encodeURIComponent(err.message || 'Payment execution failed'));
  } finally {
    connection.release();
  }
});

// ==================== NAGAD CALLBACK ====================
// Nagad redirects user here after payment
router.get('/nagad/callback', async (req, res) => {
  const {
    payment_ref_id,
    order_id,
    status: paymentStatus,
    status_code
  } = req.query;

  const orderId = order_id;

  if (!orderId) {
    return res.redirect('/payment-result.html?status=error&message=Missing+order+ID');
  }

  const session = pendingPayments.get(orderId);
  if (!session) {
    return res.redirect('/payment-result.html?status=error&message=Payment+session+expired');
  }

  if (paymentStatus === 'Aborted' || paymentStatus === 'cancel') {
    pendingPayments.delete(orderId);
    return res.redirect('/payment-result.html?status=cancelled');
  }

  if (paymentStatus !== 'Success') {
    pendingPayments.delete(orderId);
    return res.redirect('/payment-result.html?status=failed&message=Nagad+payment+failed');
  }

  // Verify payment
  const connection = await pool.getConnection();
  try {
    // In simulation mode, skip the real Nagad verify call
    let verifyResult;
    if (SIMULATION_MODE || (orderId && orderId.startsWith('SIM-'))) {
      verifyResult = {
        status: 'Success',
        clientMobileNo: '01XXXXXXXXX'
      };
    } else {
      verifyResult = await nagad.verifyPayment(payment_ref_id);
    }

    if (verifyResult.status !== 'Success') {
      throw new Error('Nagad payment verification failed');
    }

    await connection.beginTransaction();

    // Determine registration status
    const [events] = await connection.query('SELECT * FROM events WHERE id = ?', [session.event_id]);
    const event = events[0];
    let regStatus = 'pending';
    if (event.current_participants >= event.participant_limit) {
      regStatus = 'waitlisted';
    }

    // Create registration
    const [regResult] = await connection.query(
      'INSERT INTO registrations (event_id, user_id, status, payment_status, emergency_contact, notes) VALUES (?, ?, ?, ?, ?, ?)',
      [session.event_id, session.user_id, regStatus, 'paid', session.emergency_contact, session.notes]
    );

    // Create payment record  
    await connection.query(
      'INSERT INTO payments (registration_id, event_id, user_id, amount, payment_method, phone_number, transaction_id, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [regResult.insertId, session.event_id, session.user_id, session.amount, 'nagad',
       verifyResult.clientMobileNo || '', payment_ref_id || orderId, 'completed']
    );

    await connection.commit();
    pendingPayments.delete(orderId);

    const params = new URLSearchParams({
      status: 'success',
      method: 'nagad',
      trxID: payment_ref_id || orderId,
      amount: String(session.amount),
      eventId: String(session.event_id)
    });

    return res.redirect(`/payment-result.html?${params.toString()}`);

  } catch (err) {
    await connection.rollback();
    console.error('Nagad callback error:', err);
    pendingPayments.delete(orderId);
    return res.redirect('/payment-result.html?status=error&message=' + encodeURIComponent(err.message || 'Payment verification failed'));
  } finally {
    connection.release();
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
    const [payments] = await pool.query(
      `SELECT p.*, e.title as event_title,
              u.first_name, u.last_name, u.email
       FROM payments p
       JOIN events e ON p.event_id = e.id
       JOIN users u ON p.user_id = u.id
       ORDER BY p.paid_at DESC`
    );
    res.json({ payments });
  } catch (err) {
    console.error('Get all payments error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ==================== GET SINGLE PAYMENT ====================
router.get('/:id', authenticate, async (req, res) => {
  try {
    const [payments] = await pool.query(
      `SELECT p.*, e.title as event_title
       FROM payments p
       JOIN events e ON p.event_id = e.id
       WHERE p.id = ? AND p.user_id = ?`,
      [req.params.id, req.user.id]
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

// Clean up expired pending payments (older than 30 minutes)
setInterval(() => {
  const now = Date.now();
  for (const [key, session] of pendingPayments) {
    if (now - session.created_at > 30 * 60 * 1000) {
      pendingPayments.delete(key);
    }
  }
}, 5 * 60 * 1000);

module.exports = router;
