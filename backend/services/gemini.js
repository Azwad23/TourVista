// =============================================
// Gemini AI Chatbot Service
// Provides context-aware, per-user conversations
// =============================================

const { GoogleGenerativeAI } = require('@google/generative-ai');
const pool = require('../config/db');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// System prompt that grounds the AI in TourVista context
const SYSTEM_PROMPT = `You are TourBot, the friendly and helpful AI assistant for TourVista — a group tour and event management platform based in Bangladesh.

Your role:
- Answer questions about TourVista events, tours, treks, outings, and cycling trips.
- Help users with registration, payments (bKash & Nagad), cancellations, and account issues.
- Provide travel tips related to destinations offered by TourVista.
- Be warm, conversational, and use occasional emojis to feel approachable.

Key platform info:
- Users browse events, click "Register Now", pay via bKash or Nagad, then wait for admin approval.
- Payment methods: bKash and Nagad (Bangladeshi mobile payment).
- Registration statuses: pending (awaiting admin approval), approved, rejected, waitlisted.
- Events have categories: tour, trek, cycling, outing.
- Each event has: title, description, destination, dates, cost, participant limit, difficulty level.
- Users can save events to a wishlist, view their registrations under "My Events".
- Support email: support@tourvista.com

Rules:
- Keep responses concise (2-4 sentences for simple questions, longer only when listing events or step-by-step guides).
- Use HTML formatting: <strong>, <br>, <em> for emphasis since responses render as HTML.
- If asked about specific current events, use the event data provided in the conversation context.
- Never make up event details that aren't provided to you.
- If you don't know something specific, suggest the user check the Events page or contact support.
- Stay on topic — politely redirect off-topic questions back to travel and TourVista.
- Do NOT use markdown formatting (no **, ##, etc.). Use HTML tags only.`;

// In-memory conversation history per session (keeps last N messages for context)
const conversationHistories = new Map();
const MAX_HISTORY = 20; // Keep last 20 messages per session
const HISTORY_TTL = 30 * 60 * 1000; // 30 minutes

/**
 * Fetches current event data from DB for AI context
 */
async function getEventContext() {
  try {
    const [events] = await pool.query(
      `SELECT e.title, e.category, e.destination, e.start_date, e.end_date, e.cost,
              e.participant_limit, e.difficulty, e.status, e.meeting_point,
              COALESCE((SELECT COUNT(*) FROM registrations r WHERE r.event_id = e.id AND r.status IN ('approved','pending')), 0) as current_participants
       FROM events e WHERE e.status IN ('open', 'full')
       ORDER BY e.start_date ASC LIMIT 10`
    );

    if (events.length === 0) return '';

    const eventList = events.map(e => {
      const spotsLeft = e.participant_limit - e.current_participants;
      return `- ${e.title} | ${e.category} | ${e.destination || 'TBA'} | ${new Date(e.start_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} to ${new Date(e.end_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} | ৳${e.cost} | ${spotsLeft > 0 ? spotsLeft + ' spots left' : 'FULL'} | ${e.difficulty} difficulty`;
    }).join('\n');

    return `\n\nCurrently available events on TourVista:\n${eventList}`;
  } catch (err) {
    console.error('Failed to fetch event context:', err.message);
    return '';
  }
}

/**
 * Gets or creates conversation history for a session
 */
function getHistory(sessionId) {
  if (!conversationHistories.has(sessionId)) {
    conversationHistories.set(sessionId, {
      messages: [],
      lastActivity: Date.now()
    });
  }
  const history = conversationHistories.get(sessionId);
  history.lastActivity = Date.now();
  return history;
}

// Models to try in order — spread across different model families for separate quotas
const MODELS = [
  'gemini-2.5-flash',        // Newest — separate quota pool
  'gemini-2.0-flash',        // Primary
  'gemini-2.0-flash-lite',   // Lighter variant
  'gemini-2.5-flash-lite',   // Newest lite
];

/**
 * Call Gemini with automatic retry and model fallback
 */
async function callGemini(contents, systemPrompt, retries = 1) {
  for (const modelName of MODELS) {
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const model = genAI.getGenerativeModel({
          model: modelName,
          systemInstruction: systemPrompt
        });
        const result = await model.generateContent({ contents });
        const text = result.response.text();
        if (text) return text;
      } catch (err) {
        const msg = err.message || '';
        const isRateLimit = msg.includes('429') || msg.includes('quota') || msg.includes('Resource has been exhausted');
        const isNotFound = msg.includes('404') || msg.includes('not found');

        if (isNotFound) {
          console.log(`Model ${modelName} not found, skipping...`);
          break; // skip to next model immediately
        }

        if (isRateLimit && attempt < retries) {
          const delay = (attempt + 1) * 3000;
          console.log(`Rate limited on ${modelName}, retrying in ${delay}ms...`);
          await new Promise(r => setTimeout(r, delay));
          continue;
        }

        if (isRateLimit) {
          console.log(`Rate limited on ${modelName}, trying next model...`);
          break;
        }

        // Non-rate-limit error — throw immediately
        throw err;
      }
    }
  }
  // Return null instead of throwing — lets caller use local fallback
  return null;
}

/**
 * Smart local fallback when AI is unavailable
 * Provides helpful keyword-based responses so users never see errors
 */
function localFallback(userMessage) {
  const msg = userMessage.toLowerCase();

  // Greetings
  if (/^(hi|hello|hey|assalamu|salam|howdy|greetings|sup)/.test(msg)) {
    return 'Hello! 👋 Welcome to TourVista! I\'m TourBot, your travel assistant. How can I help you today? You can ask me about <strong>events</strong>, <strong>registration</strong>, or <strong>payments</strong>!';
  }

  // Events & tours
  if (/event|tour|trek|trip|cycling|outing|adventure|travel|destination/.test(msg)) {
    return 'Great question about our events! 🌄 You can browse all available tours, treks, cycling trips, and outings on our <a href="events.html" style="color:var(--primary);font-weight:600;">Events page</a>. Each event shows the destination, dates, cost, and available spots. Want to know anything specific?';
  }

  // Registration
  if (/register|sign.?up|join|book|enroll|participate/.test(msg)) {
    return 'To register for an event:<br>1️⃣ Browse events on the <a href="events.html" style="color:var(--primary);font-weight:600;">Events page</a><br>2️⃣ Click on an event to see details<br>3️⃣ Click <strong>"Register Now"</strong><br>4️⃣ Complete payment via bKash or Nagad<br>5️⃣ Wait for admin approval!<br><br>You can track your registrations under <a href="my-events.html" style="color:var(--primary);font-weight:600;">My Events</a>.';
  }

  // Payment
  if (/pay|bkash|nagad|cost|price|fee|money|refund|transaction/.test(msg)) {
    return 'We accept payments via <strong>bKash</strong> and <strong>Nagad</strong> 💰. When you register for an event, you\'ll be redirected to the payment gateway to complete your payment. After successful payment, your registration goes to <em>pending</em> status until admin approval. For refund queries, please contact <strong>support@tourvista.com</strong>.';
  }

  // Account / Profile
  if (/account|profile|password|login|logout|setting/.test(msg)) {
    return 'You can manage your account from the <a href="profile.html" style="color:var(--primary);font-weight:600;">Profile page</a> and update preferences in <a href="settings.html" style="color:var(--primary);font-weight:600;">Settings</a>. If you\'re having login issues, try resetting your password or contact <strong>support@tourvista.com</strong>.';
  }

  // Wishlist
  if (/wishlist|save|favorite|bookmark/.test(msg)) {
    return 'You can save events to your wishlist by clicking the ❤️ heart icon on any event card! View your saved events on the <a href="wishlist.html" style="color:var(--primary);font-weight:600;">Wishlist page</a>.';
  }

  // Status check
  if (/status|pending|approved|rejected|waiting|approval/.test(msg)) {
    return 'After registering, your status will be one of:<br>🟡 <strong>Pending</strong> — Awaiting admin review<br>🟢 <strong>Approved</strong> — You\'re confirmed!<br>🔴 <strong>Rejected</strong> — Contact support for details<br>🟣 <strong>Waitlisted</strong> — You\'ll be notified if a spot opens<br><br>Check your status on the <a href="my-events.html" style="color:var(--primary);font-weight:600;">My Events</a> page.';
  }

  // Help / support
  if (/help|support|contact|problem|issue|stuck|question/.test(msg)) {
    return 'I\'m here to help! 😊 You can ask me about:<br>• <strong>Events & Tours</strong> — Available trips and details<br>• <strong>Registration</strong> — How to sign up<br>• <strong>Payments</strong> — bKash & Nagad info<br>• <strong>Account</strong> — Profile & settings<br><br>For urgent issues, email <strong>support@tourvista.com</strong>.';
  }

  // Thanks
  if (/thank|thanks|thx|dhonnobad|ধন্যবাদ/.test(msg)) {
    return 'You\'re welcome! 😊 Happy to help. If you have more questions, just ask! Have a wonderful time exploring with TourVista! 🌍';
  }

  // Default
  return 'Thanks for your message! 😊 I can help you with:<br>• 🗺️ <strong>Events & Tours</strong> — Browse available trips<br>• 📝 <strong>Registration</strong> — How to sign up<br>• 💰 <strong>Payments</strong> — bKash & Nagad info<br>• 👤 <strong>Account</strong> — Profile & settings<br><br>What would you like to know about? Or visit our <a href="events.html" style="color:var(--primary);font-weight:600;">Events page</a> to explore!';
}

/**
 * Send a message to Gemini and get a response
 * @param {string} userMessage - The user's message
 * @param {string} sessionId - Unique session identifier
 * @param {object} userInfo - Optional user info { name, email }
 * @returns {Promise<string>} The AI response
 */
async function chat(userMessage, sessionId, userInfo = null) {
  try {
    const history = getHistory(sessionId);

    // Build context with event data
    const eventContext = await getEventContext();
    const userContext = userInfo && userInfo.name
      ? `\nThe user's name is ${userInfo.name}.`
      : '';

    const fullSystemPrompt = SYSTEM_PROMPT + eventContext + userContext;

    // Build conversation contents for Gemini
    const contents = [];

    // Add conversation history
    for (const msg of history.messages) {
      contents.push({
        role: msg.role,
        parts: [{ text: msg.text }]
      });
    }

    // Add current user message
    contents.push({
      role: 'user',
      parts: [{ text: userMessage }]
    });

    // Try AI first, fall back to local if unavailable
    let botText = await callGemini(contents, fullSystemPrompt);

    if (!botText) {
      console.log('All AI models unavailable, using local fallback');
      botText = localFallback(userMessage);
    }

    // Store in history
    history.messages.push({ role: 'user', text: userMessage });
    history.messages.push({ role: 'model', text: botText });

    // Trim history if too long
    if (history.messages.length > MAX_HISTORY) {
      history.messages = history.messages.slice(-MAX_HISTORY);
    }

    return botText;
  } catch (err) {
    console.error('Gemini AI error:', err.message || err);

    // If API key is missing or invalid
    if (err.message && (err.message.includes('API_KEY') || err.message.includes('API key'))) {
      return 'I\'m having trouble connecting right now. Please make sure the Gemini API key is configured. You can get a free key at <a href="https://aistudio.google.com/apikey" target="_blank" style="color:var(--primary);font-weight:600;">Google AI Studio</a>.';
    }

    // Any other error — use local fallback instead of showing error
    console.log('Using local fallback due to error:', err.message);
    return localFallback(userMessage);
  }
}

// Clean up old sessions periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, session] of conversationHistories) {
    if (now - session.lastActivity > HISTORY_TTL) {
      conversationHistories.delete(key);
    }
  }
}, 5 * 60 * 1000);

module.exports = { chat };
