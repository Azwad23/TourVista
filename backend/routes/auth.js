const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const nodemailer = require('nodemailer');
const crypto = require('crypto');
const pool = require('../config/db');
const { authenticate } = require('../middleware/auth');
require('dotenv').config();

const router = express.Router();

// ==================== EMAIL TRANSPORTER ====================
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT) || 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});

// Generate 6-digit OTP
function generateOTP() {
  return crypto.randomInt(100000, 999999).toString();
}

// ==================== REGISTER ====================
router.post('/register', [
  body('first_name').trim().notEmpty().withMessage('First name is required'),
  body('last_name').trim().notEmpty().withMessage('Last name is required'),
  body('email').isEmail().withMessage('Valid email is required'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('phone').optional({ checkFalsy: true }).matches(/^\+880\d{10}$/).withMessage('Phone must start with +880 followed by 10 digits')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { first_name, last_name, email, password, phone } = req.body;

    // Check if email already exists
    const [existing] = await pool.query('SELECT id FROM users WHERE email = ?', [email]);
    if (existing.length > 0) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create avatar from initials
    const avatar = (first_name[0] + last_name[0]).toUpperCase();

    // Insert user
    const [result] = await pool.query(
      'INSERT INTO users (first_name, last_name, email, password, phone, avatar) VALUES (?, ?, ?, ?, ?, ?)',
      [first_name, last_name, email, hashedPassword, phone || null, avatar]
    );

    // Generate token
    const token = jwt.sign(
      { id: result.insertId, email, role: 'participant' },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN }
    );

    res.status(201).json({
      message: 'Registration successful',
      token,
      user: {
        id: result.insertId,
        first_name,
        last_name,
        email,
        role: 'participant',
        avatar,
        profile_picture: null
      }
    });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ==================== LOGIN ====================
router.post('/login', [
  body('email').isEmail().withMessage('Valid email is required'),
  body('password').notEmpty().withMessage('Password is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password } = req.body;

    // Find user
    const [users] = await pool.query('SELECT * FROM users WHERE email = ?', [email]);
    if (users.length === 0) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const user = users[0];

    // Check if user is active
    if (user.status === 'inactive') {
      return res.status(403).json({ error: 'Account is deactivated. Contact admin.' });
    }

    // Check if this is an OAuth-only account (no password set)
    if (!user.password && user.oauth_provider) {
      return res.status(400).json({ 
        error: `This account uses ${user.oauth_provider.charAt(0).toUpperCase() + user.oauth_provider.slice(1)} sign-in. Please use the "${user.oauth_provider.charAt(0).toUpperCase() + user.oauth_provider.slice(1)}" button instead.`
      });
    }

    // Verify password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Generate token
    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN }
    );

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        first_name: user.first_name,
        last_name: user.last_name,
        email: user.email,
        role: user.role,
        avatar: user.avatar,
        profile_picture: user.profile_picture && user.profile_picture.startsWith('data:') ? '/api/users/profile-picture/' + user.id : user.profile_picture
      }
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ==================== GET CURRENT USER ====================
router.get('/me', authenticate, async (req, res) => {
  try {
    const [users] = await pool.query(
      'SELECT id, first_name, last_name, email, phone, role, status, avatar, profile_picture, created_at FROM users WHERE id = ?',
      [req.user.id]
    );

    if (users.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const u = users[0];
    if (u.profile_picture && u.profile_picture.startsWith('data:')) {
      u.profile_picture = '/api/users/profile-picture/' + u.id;
    }

    res.json({ user: u });
  } catch (err) {
    console.error('Get me error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ==================== FORGOT PASSWORD — SEND OTP ====================
router.post('/forgot-password', [
  body('email').isEmail().withMessage('Valid email is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email } = req.body;

    // Check if user exists
    const [users] = await pool.query('SELECT id, first_name, email FROM users WHERE email = ?', [email]);
    if (users.length === 0) {
      // Don't reveal whether email exists — return success anyway
      return res.json({ message: 'If this email is registered, you will receive an OTP shortly.' });
    }

    const user = users[0];

    // Invalidate any previous OTPs for this email
    await pool.query("UPDATE password_resets SET used = 1 WHERE email = ? AND used = 0", [email]);

    // Generate OTP and set expiry (10 minutes)
    const otp = generateOTP();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 min

    await pool.query(
      'INSERT INTO password_resets (email, otp, expires_at) VALUES (?, ?, ?)',
      [email, otp, expiresAt]
    );

    // Send OTP email
    try {
      await transporter.sendMail({
        from: process.env.SMTP_FROM || process.env.SMTP_USER,
        to: email,
        subject: 'TourVista — Password Reset OTP',
        html: `
          <div style="font-family:'Inter',Arial,sans-serif;max-width:480px;margin:0 auto;padding:32px;background:#ffffff;border-radius:16px;border:1px solid #e5e7eb;">
            <div style="text-align:center;margin-bottom:24px;">
              <div style="display:inline-flex;align-items:center;gap:8px;font-size:1.5rem;font-weight:800;color:#4f46e5;">
                🌍 TourVista
              </div>
            </div>
            <h2 style="margin:0 0 8px;font-size:1.25rem;color:#111827;">Password Reset</h2>
            <p style="color:#6b7280;font-size:0.95rem;line-height:1.6;">
              Hi ${user.first_name},<br>
              You requested to reset your password. Use the OTP below to verify your identity:
            </p>
            <div style="text-align:center;margin:24px 0;">
              <div style="display:inline-block;padding:16px 32px;background:linear-gradient(135deg,#4f46e5,#7c3aed);border-radius:12px;letter-spacing:8px;font-size:2rem;font-weight:800;color:#ffffff;">
                ${otp}
              </div>
            </div>
            <p style="color:#6b7280;font-size:0.85rem;text-align:center;">
              This OTP is valid for <strong>10 minutes</strong>. Do not share it with anyone.
            </p>
            <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;">
            <p style="color:#9ca3af;font-size:0.75rem;text-align:center;">
              If you didn't request this, you can safely ignore this email.<br>
              &copy; TourVista — Group Tour Platform
            </p>
          </div>
        `
      });
      console.log(`OTP sent to ${email}: ${otp}`);
    } catch (emailErr) {
      console.error('Email send error:', emailErr.message);
      // Still return success — log the OTP for debugging
      console.log(`[FALLBACK] OTP for ${email}: ${otp}`);
    }

    res.json({ message: 'If this email is registered, you will receive an OTP shortly.' });
  } catch (err) {
    console.error('Forgot password error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ==================== VERIFY OTP ====================
router.post('/verify-otp', [
  body('email').isEmail().withMessage('Valid email is required'),
  body('otp').isLength({ min: 6, max: 6 }).withMessage('OTP must be 6 digits')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, otp } = req.body;

    // Find valid OTP
    const [records] = await pool.query(
      "SELECT * FROM password_resets WHERE email = ? AND otp = ? AND used = 0 AND expires_at > NOW() ORDER BY created_at DESC LIMIT 1",
      [email, otp]
    );

    if (records.length === 0) {
      return res.status(400).json({ error: 'Invalid or expired OTP. Please request a new one.' });
    }

    // OTP is valid — generate a temporary reset token
    const resetToken = crypto.randomBytes(32).toString('hex');

    // Mark OTP as used and store token
    await pool.query(
      "UPDATE password_resets SET used = 1 WHERE id = ?",
      [records[0].id]
    );

    // Store reset token in a new record (valid for 15 min)
    const tokenExpiry = new Date(Date.now() + 15 * 60 * 1000);
    await pool.query(
      'INSERT INTO password_resets (email, otp, expires_at, used) VALUES (?, ?, ?, 0)',
      [email, resetToken, tokenExpiry]
    );

    res.json({ message: 'OTP verified successfully', reset_token: resetToken });
  } catch (err) {
    console.error('Verify OTP error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ==================== RESET PASSWORD ====================
router.post('/reset-password', [
  body('email').isEmail().withMessage('Valid email is required'),
  body('reset_token').notEmpty().withMessage('Reset token is required'),
  body('new_password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, reset_token, new_password } = req.body;

    // Verify reset token
    const [records] = await pool.query(
      "SELECT * FROM password_resets WHERE email = ? AND otp = ? AND used = 0 AND expires_at > NOW() ORDER BY created_at DESC LIMIT 1",
      [email, reset_token]
    );

    if (records.length === 0) {
      return res.status(400).json({ error: 'Invalid or expired reset token. Please start over.' });
    }

    // Check user exists
    const [users] = await pool.query('SELECT id FROM users WHERE email = ?', [email]);
    if (users.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Hash new password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(new_password, salt);

    // Update password
    await pool.query('UPDATE users SET password = ? WHERE email = ?', [hashedPassword, email]);

    // Mark token as used
    await pool.query("UPDATE password_resets SET used = 1 WHERE id = ?", [records[0].id]);

    // Invalidate all other reset tokens for this email
    await pool.query("UPDATE password_resets SET used = 1 WHERE email = ? AND used = 0", [email]);

    res.json({ message: 'Password reset successful! You can now log in with your new password.' });
  } catch (err) {
    console.error('Reset password error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
