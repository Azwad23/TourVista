const express = require('express');
const { body, validationResult } = require('express-validator');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const pool = require('../config/db');
const { authenticate, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// ==================== MULTER SETUP (Event Images — memory storage for DB) ====================
const eventUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|gif|webp/;
    const extOk = allowed.test(path.extname(file.originalname).toLowerCase());
    const mimeOk = allowed.test(file.mimetype);
    if (extOk && mimeOk) return cb(null, true);
    cb(new Error('Only image files (jpg, png, gif, webp) are allowed'));
  }
});

// Helper: convert uploaded file buffer to data URI
function fileToDataUri(file) {
  const base64 = file.buffer.toString('base64');
  return `data:${file.mimetype};base64,${base64}`;
}

// ==================== SERVE EVENT IMAGE FROM DB ====================
router.get('/:id/image-data', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT image_data FROM events WHERE id = ?', [req.params.id]);
    if (rows.length === 0 || !rows[0].image_data) {
      return res.status(404).json({ error: 'No image found' });
    }
    const dataUri = rows[0].image_data;
    const matches = dataUri.match(/^data:(.+);base64,(.+)$/);
    if (!matches) {
      return res.status(500).json({ error: 'Invalid image data' });
    }
    const mimeType = matches[1];
    const buffer = Buffer.from(matches[2], 'base64');
    res.set('Content-Type', mimeType);
    res.set('Cache-Control', 'public, max-age=86400');
    res.send(buffer);
  } catch (err) {
    console.error('Serve event image error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ==================== GET ALL EVENTS (Public) ====================
router.get('/', async (req, res) => {
  try {
    const { category, status, search, sort } = req.query;

    let query = `SELECT e.id, e.title, e.description, e.category, e.status, e.start_date, e.end_date, e.cost, e.participant_limit, e.destination, e.meeting_point, e.difficulty, e.gradient, e.icon, e.image_url, e.merchant_bkash, e.merchant_nagad, e.payment_instructions, e.created_by, e.created_at, CASE WHEN e.image_data IS NOT NULL THEN 1 ELSE 0 END as has_image, COALESCE((SELECT COUNT(*) FROM registrations r WHERE r.event_id = e.id AND r.status IN ('approved','pending')), 0) as current_participants FROM events e WHERE 1=1`;
    const params = [];

    if (category && category !== 'all') {
      query += ' AND category = ?';
      params.push(category);
    }

    if (status && status !== 'all') {
      query += ' AND status = ?';
      params.push(status);
    }

    if (search) {
      query += ' AND (title LIKE ? OR description LIKE ? OR destination LIKE ?)';
      const searchTerm = `%${search}%`;
      params.push(searchTerm, searchTerm, searchTerm);
    }

    // Sorting
    switch (sort) {
      case 'date-asc':
        query += ' ORDER BY start_date ASC';
        break;
      case 'date-desc':
        query += ' ORDER BY start_date DESC';
        break;
      case 'price-asc':
        query += ' ORDER BY cost ASC';
        break;
      case 'price-desc':
        query += ' ORDER BY cost DESC';
        break;
      case 'name':
        query += ' ORDER BY title ASC';
        break;
      default:
        query += ' ORDER BY created_at DESC';
    }

    const [events] = await pool.query(query, params);

    // Rewrite image_url for events with DB-stored images
    events.forEach(e => {
      if (e.has_image) {
        e.image_url = '/api/events/' + e.id + '/image-data';
      }
      delete e.has_image;
    });

    res.json({ events });
  } catch (err) {
    console.error('Get events error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ==================== GET SINGLE EVENT (Public) ====================
router.get('/:id', async (req, res) => {
  try {
    const [events] = await pool.query(
      'SELECT id, title, description, category, status, start_date, end_date, cost, participant_limit, destination, meeting_point, difficulty, gradient, icon, image_url, merchant_bkash, merchant_nagad, payment_instructions, created_by, created_at, CASE WHEN image_data IS NOT NULL THEN 1 ELSE 0 END as has_image FROM events WHERE id = ?',
      [req.params.id]
    );
    if (events.length === 0) {
      return res.status(404).json({ error: 'Event not found' });
    }

    const event = events[0];
    if (event.has_image) {
      event.image_url = '/api/events/' + event.id + '/image-data';
    }
    delete event.has_image;

    // Get itinerary
    const [itinerary] = await pool.query(
      'SELECT * FROM event_itinerary WHERE event_id = ? ORDER BY day_number',
      [req.params.id]
    );
    event.itinerary = itinerary;

    // Get registration count
    const [regCount] = await pool.query(
      "SELECT COUNT(*) as count FROM registrations WHERE event_id = ? AND status IN ('approved', 'pending')",
      [req.params.id]
    );
    event.registered_count = regCount[0].count;
    event.current_participants = regCount[0].count;

    res.json({ event });
  } catch (err) {
    console.error('Get event error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ==================== CREATE EVENT (Admin) ====================
router.post('/', authenticate, requireAdmin, eventUpload.single('image'), async (req, res) => {
  try {
    const {
      title, description, category, status, start_date, end_date,
      cost, participant_limit, destination, meeting_point, difficulty,
      gradient, icon, merchant_bkash, merchant_nagad, payment_instructions
    } = req.body;

    // Validate required fields
    if (!title || !category || !start_date || !end_date || cost === undefined || !participant_limit) {
      return res.status(400).json({ error: 'Missing required fields: title, category, start_date, end_date, cost, participant_limit' });
    }

    // If a file was uploaded, convert to base64 and store in DB
    let imageUrl = req.body.image_url || null;
    let imageData = null;
    if (req.file) {
      imageData = fileToDataUri(req.file);
      imageUrl = null; // will be computed on read
    }

    const [result] = await pool.query(
      `INSERT INTO events (title, description, category, status, start_date, end_date, cost, participant_limit, destination, meeting_point, difficulty, gradient, icon, image_url, image_data, merchant_bkash, merchant_nagad, payment_instructions, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [title, description || null, category, status || 'open', start_date, end_date,
       cost, participant_limit, destination || null, meeting_point || null,
       difficulty || 'moderate', gradient || 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
       icon || 'fas fa-map-marked-alt', imageUrl, imageData,
       merchant_bkash || null, merchant_nagad || null, payment_instructions || null,
       req.user.id]
    );

    // Add itinerary if provided
    let itinerary = req.body.itinerary;
    if (typeof itinerary === 'string') {
      try { itinerary = JSON.parse(itinerary); } catch(e) { itinerary = null; }
    }
    if (itinerary && Array.isArray(itinerary)) {
      for (const item of itinerary) {
        await pool.query(
          'INSERT INTO event_itinerary (event_id, day_number, title, description) VALUES (?, ?, ?, ?)',
          [result.insertId, item.day_number, item.title, item.description || null]
        );
      }
    }

    const [newEvent] = await pool.query(
      'SELECT id, title, description, category, status, start_date, end_date, cost, participant_limit, destination, meeting_point, difficulty, gradient, icon, image_url, merchant_bkash, merchant_nagad, payment_instructions, created_by, created_at, CASE WHEN image_data IS NOT NULL THEN 1 ELSE 0 END as has_image FROM events WHERE id = ?',
      [result.insertId]
    );
    if (newEvent[0].has_image) {
      newEvent[0].image_url = '/api/events/' + newEvent[0].id + '/image-data';
    }
    delete newEvent[0].has_image;

    res.status(201).json({ message: 'Event created', event: newEvent[0] });
  } catch (err) {
    console.error('Create event error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ==================== UPDATE EVENT (Admin) ====================
router.put('/:id', authenticate, requireAdmin, eventUpload.single('image'), async (req, res) => {
  try {
    const [existing] = await pool.query('SELECT * FROM events WHERE id = ?', [req.params.id]);
    if (existing.length === 0) {
      return res.status(404).json({ error: 'Event not found' });
    }

    const {
      title, description, category, status, start_date, end_date,
      cost, participant_limit, destination, meeting_point, difficulty,
      gradient, icon, merchant_bkash, merchant_nagad, payment_instructions
    } = req.body;

    // Handle image: new upload stores base64 in DB
    let imageUrl = existing[0].image_url; // keep existing by default
    let imageData = undefined; // undefined = don't update
    if (req.file) {
      // New file uploaded — store as base64 in DB
      imageData = fileToDataUri(req.file);
      imageUrl = null;
    } else if (req.body.remove_image === 'true') {
      // Explicitly remove image
      imageUrl = null;
      imageData = null;
    } else if (req.body.image_url !== undefined) {
      imageUrl = req.body.image_url || null;
    }

    let updateQuery = `UPDATE events SET title=?, description=?, category=?, status=?, start_date=?, end_date=?,
       cost=?, participant_limit=?, destination=?, meeting_point=?, difficulty=?, gradient=?, icon=?, image_url=?,
       merchant_bkash=?, merchant_nagad=?, payment_instructions=?`;
    let updateParams = [title, description, category, status, start_date, end_date,
       cost, participant_limit, destination, meeting_point, difficulty,
       gradient, icon, imageUrl,
       merchant_bkash || null, merchant_nagad || null, payment_instructions || null];

    if (imageData !== undefined) {
      updateQuery += ', image_data=?';
      updateParams.push(imageData);
    }
    updateQuery += ' WHERE id=?';
    updateParams.push(req.params.id);

    await pool.query(updateQuery, updateParams);

    // Update itinerary if provided
    let itinerary = req.body.itinerary;
    if (typeof itinerary === 'string') {
      try { itinerary = JSON.parse(itinerary); } catch(e) { itinerary = null; }
    }
    if (itinerary && Array.isArray(itinerary)) {
      await pool.query('DELETE FROM event_itinerary WHERE event_id = ?', [req.params.id]);
      for (const item of itinerary) {
        await pool.query(
          'INSERT INTO event_itinerary (event_id, day_number, title, description) VALUES (?, ?, ?, ?)',
          [req.params.id, item.day_number, item.title, item.description || null]
        );
      }
    }

    const [updated] = await pool.query(
      'SELECT id, title, description, category, status, start_date, end_date, cost, participant_limit, destination, meeting_point, difficulty, gradient, icon, image_url, merchant_bkash, merchant_nagad, payment_instructions, created_by, created_at, CASE WHEN image_data IS NOT NULL THEN 1 ELSE 0 END as has_image FROM events WHERE id = ?',
      [req.params.id]
    );
    if (updated[0].has_image) {
      updated[0].image_url = '/api/events/' + updated[0].id + '/image-data';
    }
    delete updated[0].has_image;
    res.json({ message: 'Event updated', event: updated[0] });
  } catch (err) {
    console.error('Update event error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ==================== UPLOAD EVENT IMAGE (Admin) ====================
router.post('/:id/image', authenticate, requireAdmin, eventUpload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No image file provided' });
    }

    const [existing] = await pool.query('SELECT * FROM events WHERE id = ?', [req.params.id]);
    if (existing.length === 0) {
      return res.status(404).json({ error: 'Event not found' });
    }

    const imageData = fileToDataUri(req.file);
    await pool.query('UPDATE events SET image_data = ?, image_url = NULL WHERE id = ?', [imageData, req.params.id]);

    const imageUrl = '/api/events/' + req.params.id + '/image-data';
    res.json({ message: 'Event image uploaded', image_url: imageUrl });
  } catch (err) {
    console.error('Upload event image error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ==================== DELETE EVENT IMAGE (Admin) ====================
router.delete('/:id/image', authenticate, requireAdmin, async (req, res) => {
  try {
    const [existing] = await pool.query('SELECT id FROM events WHERE id = ?', [req.params.id]);
    if (existing.length === 0) {
      return res.status(404).json({ error: 'Event not found' });
    }

    await pool.query('UPDATE events SET image_url = NULL, image_data = NULL WHERE id = ?', [req.params.id]);
    res.json({ message: 'Event image removed' });
  } catch (err) {
    console.error('Delete event image error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ==================== DELETE EVENT (Admin) ====================
router.delete('/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    const [existing] = await pool.query('SELECT id FROM events WHERE id = ?', [req.params.id]);
    if (existing.length === 0) {
      return res.status(404).json({ error: 'Event not found' });
    }

    await pool.query('DELETE FROM events WHERE id = ?', [req.params.id]);
    res.json({ message: 'Event deleted' });
  } catch (err) {
    console.error('Delete event error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ==================== DASHBOARD STATS (Admin) ====================
router.get('/admin/stats', authenticate, requireAdmin, async (req, res) => {
  try {
    const [userCount] = await pool.query('SELECT COUNT(*) as count FROM users');
    const [eventCount] = await pool.query('SELECT COUNT(*) as count FROM events');
    const [regCount] = await pool.query('SELECT COUNT(*) as count FROM registrations');
    const [pendingCount] = await pool.query("SELECT COUNT(*) as count FROM registrations WHERE status = 'pending'");

    // Category breakdown
    const [categories] = await pool.query(
      'SELECT category, COUNT(*) as count FROM events GROUP BY category'
    );

    // Monthly registrations (last 6 months)
    const [monthly] = await pool.query(
      `SELECT DATE_FORMAT(registered_at, '%Y-%m') as month, COUNT(*) as count
       FROM registrations
       WHERE registered_at >= DATE_SUB(NOW(), INTERVAL 6 MONTH)
       GROUP BY month ORDER BY month`
    );

    res.json({
      stats: {
        totalUsers: userCount[0].count,
        totalEvents: eventCount[0].count,
        totalRegistrations: regCount[0].count,
        pendingApprovals: pendingCount[0].count
      },
      categories,
      monthlyRegistrations: monthly
    });
  } catch (err) {
    console.error('Stats error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
