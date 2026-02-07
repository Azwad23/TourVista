const express = require('express');
const pool = require('../config/db');
const { authenticate, requireAdmin } = require('../middleware/auth');
const { v4: uuidv4 } = require('uuid');
const gemini = require('../services/gemini');

const router = express.Router();

// ==================== SEND MESSAGE (AI-powered) ====================
router.post('/message', async (req, res) => {
  try {
    const { message, session_id } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    const sessionId = session_id || uuidv4();
    const userId = req.user ? req.user.id : null;

    // Find or create conversation
    let [convos] = await pool.query(
      'SELECT id FROM chatbot_conversations WHERE session_id = ? AND status = "active"',
      [sessionId]
    );

    let conversationId;
    if (convos.length === 0) {
      const [result] = await pool.query(
        'INSERT INTO chatbot_conversations (user_id, session_id) VALUES (?, ?)',
        [userId, sessionId]
      );
      conversationId = result.insertId;
    } else {
      conversationId = convos[0].id;
    }

    // Save user message to DB
    await pool.query(
      'INSERT INTO chatbot_messages (conversation_id, sender, message) VALUES (?, "user", ?)',
      [conversationId, message]
    );

    // Get user info for personalization
    let userInfo = null;
    if (userId) {
      try {
        const [users] = await pool.query('SELECT first_name, last_name, email FROM users WHERE id = ?', [userId]);
        if (users.length > 0) {
          userInfo = { name: `${users[0].first_name} ${users[0].last_name}`, email: users[0].email };
        }
      } catch (e) { /* ignore */ }
    }

    // Get AI response from Gemini
    const botResponse = await gemini.chat(message, sessionId, userInfo);

    // Save bot response to DB
    await pool.query(
      'INSERT INTO chatbot_messages (conversation_id, sender, message) VALUES (?, "bot", ?)',
      [conversationId, botResponse]
    );

    res.json({
      session_id: sessionId,
      response: botResponse
    });
  } catch (err) {
    console.error('Chatbot message error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ==================== GET CONVERSATION HISTORY ====================
router.get('/conversation/:sessionId', async (req, res) => {
  try {
    const [convos] = await pool.query(
      'SELECT id FROM chatbot_conversations WHERE session_id = ?',
      [req.params.sessionId]
    );

    if (convos.length === 0) {
      return res.json({ messages: [] });
    }

    const [messages] = await pool.query(
      'SELECT sender, message, sent_at FROM chatbot_messages WHERE conversation_id = ? ORDER BY sent_at',
      [convos[0].id]
    );

    res.json({ messages });
  } catch (err) {
    console.error('Get conversation error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ==================== GET ALL CONVERSATIONS (Admin) ====================
router.get('/conversations', authenticate, requireAdmin, async (req, res) => {
  try {
    const [conversations] = await pool.query(`
      SELECT c.*, u.first_name, u.last_name, u.avatar,
        (SELECT COUNT(*) FROM chatbot_messages WHERE conversation_id = c.id) as message_count,
        (SELECT message FROM chatbot_messages WHERE conversation_id = c.id ORDER BY sent_at DESC LIMIT 1) as last_message,
        (SELECT sent_at FROM chatbot_messages WHERE conversation_id = c.id ORDER BY sent_at DESC LIMIT 1) as last_message_at
      FROM chatbot_conversations c
      LEFT JOIN users u ON c.user_id = u.id
      ORDER BY c.started_at DESC
    `);

    // Top questions - get most common user messages
    const [topQuestions] = await pool.query(`
      SELECT message, COUNT(*) as count
      FROM chatbot_messages
      WHERE sender = 'user'
      GROUP BY message
      ORDER BY count DESC
      LIMIT 10
    `);

    // Stats
    const [stats] = await pool.query(`
      SELECT
        (SELECT COUNT(*) FROM chatbot_conversations) as total_conversations,
        (SELECT COUNT(*) FROM chatbot_messages) as total_messages,
        (SELECT COUNT(*) FROM chatbot_conversations WHERE status = 'active') as active_conversations
    `);

    res.json({ conversations, topQuestions, stats: stats[0] });
  } catch (err) {
    console.error('Get conversations error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ==================== GET CONVERSATION DETAIL (Admin) ====================
router.get('/conversations/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    const [messages] = await pool.query(
      'SELECT sender, message, sent_at FROM chatbot_messages WHERE conversation_id = ? ORDER BY sent_at',
      [req.params.id]
    );

    res.json({ messages });
  } catch (err) {
    console.error('Get conversation detail error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
