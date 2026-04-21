const express = require('express');
const pool = require('../config/db');
const { authenticate, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// ==================== AUTO-CREATE TABLES ====================
let tablesInitialized = false;
async function ensureSettingsTables() {
  if (tablesInitialized) return;
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS platform_settings (
        setting_key VARCHAR(100) PRIMARY KEY,
        setting_value TEXT NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS user_settings (
        user_id INT NOT NULL,
        setting_key VARCHAR(100) NOT NULL,
        setting_value TEXT NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (user_id, setting_key)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    // Insert default platform settings if empty
    const [existing] = await pool.query('SELECT COUNT(*) as cnt FROM platform_settings');
    if (existing[0].cnt === 0) {
      await pool.query(`
        INSERT INTO platform_settings (setting_key, setting_value) VALUES
        ('email_notifications', 'true'),
        ('auto_approve_registrations', 'false'),
        ('chatbot_active', 'true')
      `);
    }

    tablesInitialized = true;
    console.log('✅ Settings tables initialized');
  } catch (err) {
    console.error('Settings tables init error:', err.message);
  }
}

// Initialize on module load
ensureSettingsTables();

// ==================== GET PLATFORM SETTINGS (Admin) ====================
router.get('/platform', authenticate, requireAdmin, async (req, res) => {
  try {
    await ensureSettingsTables();
    const [rows] = await pool.query('SELECT setting_key, setting_value FROM platform_settings');
    const settings = {};
    rows.forEach(r => { settings[r.setting_key] = r.setting_value === 'true'; });
    res.json({ settings });
  } catch (err) {
    console.error('Get platform settings error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ==================== UPDATE PLATFORM SETTINGS (Admin) ====================
router.put('/platform', authenticate, requireAdmin, async (req, res) => {
  try {
    await ensureSettingsTables();
    const { settings } = req.body;
    if (!settings || typeof settings !== 'object') {
      return res.status(400).json({ error: 'Settings object required' });
    }

    const allowedKeys = ['email_notifications', 'auto_approve_registrations', 'chatbot_active'];
    for (const [key, value] of Object.entries(settings)) {
      if (allowedKeys.includes(key)) {
        await pool.query(
          'INSERT INTO platform_settings (setting_key, setting_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE setting_value = ?',
          [key, String(value), String(value)]
        );
      }
    }

    res.json({ message: 'Platform settings updated' });
  } catch (err) {
    console.error('Update platform settings error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ==================== GET PLATFORM SETTING (Public - for chatbot check etc.) ====================
router.get('/platform/:key', async (req, res) => {
  try {
    await ensureSettingsTables();
    const [rows] = await pool.query('SELECT setting_value FROM platform_settings WHERE setting_key = ?', [req.params.key]);
    if (rows.length === 0) {
      return res.json({ value: null });
    }
    res.json({ value: rows[0].setting_value === 'true' });
  } catch (err) {
    console.error('Get platform setting error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ==================== GET USER SETTINGS (Self) ====================
router.get('/user', authenticate, async (req, res) => {
  try {
    await ensureSettingsTables();
    const [rows] = await pool.query('SELECT setting_key, setting_value FROM user_settings WHERE user_id = ?', [req.user.id]);
    const settings = {};
    rows.forEach(r => {
      // Parse boolean-like values
      if (r.setting_value === 'true' || r.setting_value === 'false') {
        settings[r.setting_key] = r.setting_value === 'true';
      } else {
        settings[r.setting_key] = r.setting_value;
      }
    });
    res.json({ settings });
  } catch (err) {
    console.error('Get user settings error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ==================== UPDATE USER SETTINGS (Self) ====================
router.put('/user', authenticate, async (req, res) => {
  try {
    await ensureSettingsTables();
    const { settings } = req.body;
    if (!settings || typeof settings !== 'object') {
      return res.status(400).json({ error: 'Settings object required' });
    }

    const allowedKeys = [
      'email_notifications', 'registration_updates', 'new_event_alerts',
      'promo_emails', 'dark_mode', 'compact_view', 'profile_visible', 'two_factor'
    ];
    for (const [key, value] of Object.entries(settings)) {
      if (allowedKeys.includes(key)) {
        await pool.query(
          'INSERT INTO user_settings (user_id, setting_key, setting_value) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE setting_value = ?',
          [req.user.id, key, String(value), String(value)]
        );
      }
    }

    res.json({ message: 'Settings updated' });
  } catch (err) {
    console.error('Update user settings error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ==================== DELETE ACCOUNT (Self) ====================
router.delete('/account', authenticate, async (req, res) => {
  try {
    // Deactivate the account (soft delete)
    await pool.query("UPDATE users SET status = 'inactive' WHERE id = ?", [req.user.id]);

    // Clean up user settings
    await pool.query('DELETE FROM user_settings WHERE user_id = ?', [req.user.id]);

    res.json({ message: 'Account deactivated successfully' });
  } catch (err) {
    console.error('Delete account error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ==================== HELPER: Check if auto-approve is enabled ====================
// Export for use in registrations route
router.isAutoApproveEnabled = async function() {
  try {
    await ensureSettingsTables();
    const [rows] = await pool.query("SELECT setting_value FROM platform_settings WHERE setting_key = 'auto_approve_registrations'");
    return rows.length > 0 && rows[0].setting_value === 'true';
  } catch (err) {
    return false;
  }
};

router.isChatbotActive = async function() {
  try {
    await ensureSettingsTables();
    const [rows] = await pool.query("SELECT setting_value FROM platform_settings WHERE setting_key = 'chatbot_active'");
    return rows.length > 0 && rows[0].setting_value === 'true';
  } catch (err) {
    return true; // Default to active
  }
};

module.exports = router;
