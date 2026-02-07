const express = require('express');
const { body, validationResult } = require('express-validator');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const pool = require('../config/db');
const { authenticate, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// ==================== MULTER SETUP (Event Images) ====================
const eventUploadDir = path.join(__dirname, '..', 'uploads', 'events');
if (!fs.existsSync(eventUploadDir)) {
  fs.mkdirSync(eventUploadDir, { recursive: true });
}

const eventStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, eventUploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `event-${Date.now()}${ext}`);
  }
});

const eventUpload = multer({
  storage: eventStorage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|gif|webp/;
    const extOk = allowed.test(path.extname(file.originalname).toLowerCase());
    const mimeOk = allowed.test(file.mimetype);
    if (extOk && mimeOk) return cb(null, true);
    cb(new Error('Only image files (jpg, png, gif, webp) are allowed'));
  }
});

// ==================== GET ALL EVENTS (Public) ====================
router.get('/', async (req, res) => {
  try {
    const { category, status, search, sort } = req.query;

    let query = 'SELECT * FROM events WHERE 1=1';
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
    res.json({ events });
  } catch (err) {
    console.error('Get events error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ==================== GET SINGLE EVENT (Public) ====================
router.get('/:id', async (req, res) => {
  try {
    const [events] = await pool.query('SELECT * FROM events WHERE id = ?', [req.params.id]);
    if (events.length === 0) {
      return res.status(404).json({ error: 'Event not found' });
    }

    const event = events[0];

    // Get itinerary
    const [itinerary] = await pool.query(
      'SELECT * FROM event_itinerary WHERE event_id = ? ORDER BY day_number',
      [req.params.id]
    );
    event.itinerary = itinerary;

    // Get registration count
    const [regCount] = await pool.query(
      'SELECT COUNT(*) as count FROM registrations WHERE event_id = ? AND status IN ("approved", "pending")',
      [req.params.id]
    );
    event.registered_count = regCount[0].count;

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
      gradient, icon
    } = req.body;

    // Validate required fields
    if (!title || !category || !start_date || !end_date || cost === undefined || !participant_limit) {
      return res.status(400).json({ error: 'Missing required fields: title, category, start_date, end_date, cost, participant_limit' });
    }

    // If a file was uploaded, use its path; otherwise check for image_url in body
    let imageUrl = req.body.image_url || null;
    if (req.file) {
      imageUrl = '/uploads/events/' + req.file.filename;
    }

    const [result] = await pool.query(
      `INSERT INTO events (title, description, category, status, start_date, end_date, cost, participant_limit, destination, meeting_point, difficulty, gradient, icon, image_url, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [title, description || null, category, status || 'open', start_date, end_date,
       cost, participant_limit, destination || null, meeting_point || null,
       difficulty || 'moderate', gradient || 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
       icon || 'fas fa-map-marked-alt', imageUrl, req.user.id]
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

    const [newEvent] = await pool.query('SELECT * FROM events WHERE id = ?', [result.insertId]);

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
      gradient, icon
    } = req.body;

    // Handle image: new upload, keep existing, or remove
    let imageUrl = existing[0].image_url; // keep existing by default
    if (req.file) {
      // New file uploaded — delete old one if it was a local upload
      if (existing[0].image_url && existing[0].image_url.startsWith('/uploads/')) {
        const oldPath = path.join(__dirname, '..', existing[0].image_url);
        if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
      }
      imageUrl = '/uploads/events/' + req.file.filename;
    } else if (req.body.remove_image === 'true') {
      // Explicitly remove image
      if (existing[0].image_url && existing[0].image_url.startsWith('/uploads/')) {
        const oldPath = path.join(__dirname, '..', existing[0].image_url);
        if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
      }
      imageUrl = null;
    } else if (req.body.image_url !== undefined) {
      imageUrl = req.body.image_url || null;
    }

    await pool.query(
      `UPDATE events SET title=?, description=?, category=?, status=?, start_date=?, end_date=?,
       cost=?, participant_limit=?, destination=?, meeting_point=?, difficulty=?, gradient=?, icon=?, image_url=?
       WHERE id=?`,
      [title, description, category, status, start_date, end_date,
       cost, participant_limit, destination, meeting_point, difficulty,
       gradient, icon, imageUrl, req.params.id]
    );

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

    const [updated] = await pool.query('SELECT * FROM events WHERE id = ?', [req.params.id]);
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

    // Delete old image if local
    if (existing[0].image_url && existing[0].image_url.startsWith('/uploads/')) {
      const oldPath = path.join(__dirname, '..', existing[0].image_url);
      if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
    }

    const imageUrl = '/uploads/events/' + req.file.filename;
    await pool.query('UPDATE events SET image_url = ? WHERE id = ?', [imageUrl, req.params.id]);

    res.json({ message: 'Event image uploaded', image_url: imageUrl });
  } catch (err) {
    console.error('Upload event image error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ==================== DELETE EVENT IMAGE (Admin) ====================
router.delete('/:id/image', authenticate, requireAdmin, async (req, res) => {
  try {
    const [existing] = await pool.query('SELECT * FROM events WHERE id = ?', [req.params.id]);
    if (existing.length === 0) {
      return res.status(404).json({ error: 'Event not found' });
    }

    if (existing[0].image_url && existing[0].image_url.startsWith('/uploads/')) {
      const oldPath = path.join(__dirname, '..', existing[0].image_url);
      if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
    }

    await pool.query('UPDATE events SET image_url = NULL WHERE id = ?', [req.params.id]);
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
