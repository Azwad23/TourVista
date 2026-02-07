const express = require('express');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const pool = require('../config/db');
const { authenticate, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// ==================== MULTER SETUP ====================
const uploadDir = path.join(__dirname, '..', 'uploads', 'avatars');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `user-${req.user.id}-${Date.now()}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|gif|webp/;
    const extOk = allowed.test(path.extname(file.originalname).toLowerCase());
    const mimeOk = allowed.test(file.mimetype);
    if (extOk && mimeOk) return cb(null, true);
    cb(new Error('Only image files (jpg, png, gif, webp) are allowed'));
  }
});

// ==================== GET ALL USERS (Admin) ====================
router.get('/', authenticate, requireAdmin, async (req, res) => {
  try {
    const { role, search } = req.query;

    let query = 'SELECT id, first_name, last_name, email, phone, role, status, avatar, profile_picture, created_at FROM users WHERE 1=1';
    const params = [];

    if (role && role !== 'all') {
      query += ' AND role = ?';
      params.push(role);
    }

    if (search) {
      query += ' AND (first_name LIKE ? OR last_name LIKE ? OR email LIKE ?)';
      const term = `%${search}%`;
      params.push(term, term, term);
    }

    query += ' ORDER BY created_at DESC';

    const [users] = await pool.query(query, params);

    // Counts
    const [counts] = await pool.query(
      `SELECT
        COUNT(*) as total,
        SUM(CASE WHEN role = 'admin' THEN 1 ELSE 0 END) as admins,
        SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active
      FROM users`
    );

    res.json({ users, counts: counts[0] });
  } catch (err) {
    console.error('Get users error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ==================== GET SINGLE USER (Admin) ====================
router.get('/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    const [users] = await pool.query(
      'SELECT id, first_name, last_name, email, phone, role, status, avatar, profile_picture, created_at FROM users WHERE id = ?',
      [req.params.id]
    );

    if (users.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Get user's registrations
    const [registrations] = await pool.query(
      `SELECT r.*, e.title as event_title, e.start_date, e.category
       FROM registrations r JOIN events e ON r.event_id = e.id
       WHERE r.user_id = ? ORDER BY r.registered_at DESC`,
      [req.params.id]
    );

    res.json({ user: users[0], registrations });
  } catch (err) {
    console.error('Get user error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ==================== TOGGLE USER STATUS (Admin) ====================
router.put('/:id/toggle-status', authenticate, requireAdmin, async (req, res) => {
  try {
    const [users] = await pool.query('SELECT id, status FROM users WHERE id = ?', [req.params.id]);
    if (users.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const newStatus = users[0].status === 'active' ? 'inactive' : 'active';
    await pool.query('UPDATE users SET status = ? WHERE id = ?', [newStatus, req.params.id]);

    res.json({ message: `User ${newStatus === 'active' ? 'activated' : 'deactivated'}`, status: newStatus });
  } catch (err) {
    console.error('Toggle status error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ==================== UPDATE PROFILE (Self) ====================
router.put('/profile', authenticate, async (req, res) => {
  try {
    const { first_name, last_name, phone } = req.body;

    if (phone && !/^\+880\d{10}$/.test(phone)) {
      return res.status(400).json({ error: 'Phone must start with +880 followed by 10 digits' });
    }

    await pool.query(
      'UPDATE users SET first_name = ?, last_name = ?, phone = ?, avatar = ? WHERE id = ?',
      [first_name, last_name, phone || null, (first_name[0] + last_name[0]).toUpperCase(), req.user.id]
    );

    const [updated] = await pool.query(
      'SELECT id, first_name, last_name, email, phone, role, status, avatar, profile_picture FROM users WHERE id = ?',
      [req.user.id]
    );

    res.json({ message: 'Profile updated', user: updated[0] });
  } catch (err) {
    console.error('Update profile error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ==================== CHANGE PASSWORD (Self) ====================
router.put('/change-password', authenticate, async (req, res) => {
  try {
    const { current_password, new_password } = req.body;

    if (!current_password || !new_password) {
      return res.status(400).json({ error: 'Both current and new passwords required' });
    }

    if (new_password.length < 6) {
      return res.status(400).json({ error: 'New password must be at least 6 characters' });
    }

    const [users] = await pool.query('SELECT password FROM users WHERE id = ?', [req.user.id]);
    const isMatch = await bcrypt.compare(current_password, users[0].password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashed = await bcrypt.hash(new_password, salt);
    await pool.query('UPDATE users SET password = ? WHERE id = ?', [hashed, req.user.id]);

    res.json({ message: 'Password changed successfully' });
  } catch (err) {
    console.error('Change password error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ==================== UPLOAD PROFILE PICTURE (Self) ====================
router.post('/profile-picture', authenticate, upload.single('profile_picture'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No image file provided' });
    }

    // Delete old picture if exists
    const [current] = await pool.query('SELECT profile_picture FROM users WHERE id = ?', [req.user.id]);
    if (current[0] && current[0].profile_picture) {
      const oldPath = path.join(__dirname, '..', current[0].profile_picture);
      if (fs.existsSync(oldPath)) {
        fs.unlinkSync(oldPath);
      }
    }

    const picturePath = '/uploads/avatars/' + req.file.filename;
    await pool.query('UPDATE users SET profile_picture = ? WHERE id = ?', [picturePath, req.user.id]);

    const [updated] = await pool.query(
      'SELECT id, first_name, last_name, email, phone, role, status, avatar, profile_picture FROM users WHERE id = ?',
      [req.user.id]
    );

    res.json({ message: 'Profile picture updated', user: updated[0] });
  } catch (err) {
    console.error('Upload profile picture error:', err);
    res.status(500).json({ error: err.message || 'Server error' });
  }
});

// ==================== DELETE PROFILE PICTURE (Self) ====================
router.delete('/profile-picture', authenticate, async (req, res) => {
  try {
    const [current] = await pool.query('SELECT profile_picture FROM users WHERE id = ?', [req.user.id]);
    if (current[0] && current[0].profile_picture) {
      const oldPath = path.join(__dirname, '..', current[0].profile_picture);
      if (fs.existsSync(oldPath)) {
        fs.unlinkSync(oldPath);
      }
    }

    await pool.query('UPDATE users SET profile_picture = NULL WHERE id = ?', [req.user.id]);

    const [updated] = await pool.query(
      'SELECT id, first_name, last_name, email, phone, role, status, avatar, profile_picture FROM users WHERE id = ?',
      [req.user.id]
    );

    res.json({ message: 'Profile picture removed', user: updated[0] });
  } catch (err) {
    console.error('Delete profile picture error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
